import {
  LLMError,
  estimateCost,
  type GenerationOptions,
  type GenerationResult,
  type LLMProvider,
} from "../types";

export interface AnthropicProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  /** Required by the Anthropic API. */
  anthropicVersion?: string;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
}

const DEFAULT_MODEL = "claude-3-5-haiku-latest";

/** Anthropic Messages API provider (plain HTTP, no vendor SDK). */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  readonly defaultModel: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly version: string;

  constructor(options: AnthropicProviderOptions) {
    if (!options.apiKey) {
      throw new LLMError("ANTHROPIC_API_KEY is not configured.", "AUTH");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
    this.defaultModel = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.version = options.anthropicVersion ?? "2023-06-01";
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    const model = options.model ?? this.defaultModel;
    const started = Date.now();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.version,
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxOutputTokens ?? 8000,
          temperature: options.temperature ?? 0.2,
          messages: [{ role: "user", content: prompt }],
          ...(options.stopSequences?.length ? { stop_sequences: options.stopSequences } : {}),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
      });
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new LLMError(`Anthropic request timed out after ${options.timeoutMs ?? this.timeoutMs} ms.`, "TIMEOUT", true);
      }
      throw new LLMError(`Anthropic request failed: ${(error as Error).message}`, "PROVIDER_ERROR", true);
    }

    if (!response.ok) {
      const detail = await safeText(response);
      const message = `Anthropic API error ${response.status}: ${truncate(detail, 400)}`;
      if (response.status === 401 || response.status === 403) throw new LLMError(message, "AUTH", false, response.status);
      if (response.status === 429) throw new LLMError(message, "RATE_LIMIT", true, response.status);
      if (response.status === 400) throw new LLMError(message, "BAD_REQUEST", false, response.status);
      throw new LLMError(message, "PROVIDER_ERROR", response.status >= 500, response.status);
    }

    const json = (await response.json()) as AnthropicResponse;
    const text = (json.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new LLMError("Anthropic returned an empty completion.", "PROVIDER_ERROR", true, response.status);
    }

    const inputTokens = json.usage?.input_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = json.usage?.output_tokens ?? Math.ceil(text.length / 4);

    return {
      text,
      provider: this.name,
      model,
      usage: { inputTokens, outputTokens, costUsd: estimateCost(model, { inputTokens, outputTokens }) },
      latencyMs: Date.now() - started,
      cacheHit: false,
      finishReason: json.stop_reason,
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
