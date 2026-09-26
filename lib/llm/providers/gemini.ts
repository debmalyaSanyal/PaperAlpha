import {
  LLMError,
  estimateCost,
  type GenerationOptions,
  type GenerationResult,
  type LLMProvider,
} from "../types";

export interface GeminiProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const DEFAULT_MODEL = "gemini-2.5-flash";

/** Google Gemini generateContent provider (plain HTTP, no vendor SDK). */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;
  readonly defaultModel: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    if (!options.apiKey) {
      throw new LLMError("GOOGLE_API_KEY is not configured.", "AUTH");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
    this.defaultModel = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    const model = options.model ?? this.defaultModel;
    const started = Date.now();

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 8000,
        ...(options.json ? { responseMimeType: "application/json" } : {}),
        ...(options.stopSequences?.length ? { stopSequences: options.stopSequences.slice(0, 5) } : {}),
      },
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
      });
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new LLMError(`Gemini request timed out after ${options.timeoutMs ?? this.timeoutMs} ms.`, "TIMEOUT", true);
      }
      throw new LLMError(`Gemini request failed: ${(error as Error).message}`, "PROVIDER_ERROR", true);
    }

    if (!response.ok) {
      const detail = await safeText(response);
      const message = `Gemini API error ${response.status}: ${truncate(detail, 400)}`;
      if (response.status === 401 || response.status === 403) throw new LLMError(message, "AUTH", false, response.status);
      if (response.status === 429) throw new LLMError(message, "RATE_LIMIT", true, response.status);
      if (response.status === 400) throw new LLMError(message, "BAD_REQUEST", false, response.status);
      throw new LLMError(message, "PROVIDER_ERROR", response.status >= 500, response.status);
    }

    const json = (await response.json()) as GeminiResponse;
    const candidate = json.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      const blocked = candidate?.finishReason ?? "unknown";
      throw new LLMError(`Gemini returned no text (finish reason: ${blocked}).`, "PROVIDER_ERROR", false, response.status);
    }

    const inputTokens = json.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4);
    const outputTokens = json.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);

    return {
      text,
      provider: this.name,
      model,
      usage: { inputTokens, outputTokens, costUsd: estimateCost(model, { inputTokens, outputTokens }) },
      latencyMs: Date.now() - started,
      cacheHit: false,
      finishReason: candidate?.finishReason,
    };
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "(no response body)";
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}\u2026`;
}
