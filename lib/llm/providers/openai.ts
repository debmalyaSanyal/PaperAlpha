import {
  LLMError,
  estimateCost,
  type GenerationOptions,
  type GenerationResult,
  type LLMProvider,
} from "../types";

export interface OpenAIProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_MODEL = "gpt-4o-mini";

/** OpenAI Chat Completions provider (plain HTTP, no vendor SDK). */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  readonly defaultModel: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAIProviderOptions) {
    if (!options.apiKey) {
      throw new LLMError("OPENAI_API_KEY is not configured.", "AUTH");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.defaultModel = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    const model = options.model ?? this.defaultModel;
    const started = Date.now();

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0.2,
    };

    const maxTokens = options.maxOutputTokens ?? 8000;
    if (/^(o\d|gpt-5)/.test(model)) body.max_completion_tokens = maxTokens;
    else body.max_tokens = maxTokens;

    if (options.json) body.response_format = { type: "json_object" };
    if (options.stopSequences?.length) body.stop = options.stopSequences.slice(0, 4);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
      });
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new LLMError(`OpenAI request timed out after ${options.timeoutMs ?? this.timeoutMs} ms.`, "TIMEOUT", true);
      }
      throw new LLMError(`OpenAI request failed: ${(error as Error).message}`, "PROVIDER_ERROR", true);
    }

    if (!response.ok) {
      const detail = await safeText(response);
      throw mapOpenAIError(response.status, detail);
    }

    const json = (await response.json()) as OpenAIChatResponse;
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text) {
      throw new LLMError("OpenAI returned an empty completion.", "PROVIDER_ERROR", true, response.status);
    }

    const inputTokens = json.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = json.usage?.completion_tokens ?? Math.ceil(text.length / 4);

    return {
      text,
      provider: this.name,
      model,
      usage: { inputTokens, outputTokens, costUsd: estimateCost(model, { inputTokens, outputTokens }) },
      latencyMs: Date.now() - started,
      cacheHit: false,
      finishReason: json.choices?.[0]?.finish_reason,
    };
  }

  async embed(texts: string[], options: { model?: string } = {}): Promise<number[][]> {
    const model = options.model ?? "text-embedding-3-small";
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, input: texts }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw mapOpenAIError(response.status, await safeText(response));
    const json = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    return (json.data ?? []).map((d) => d.embedding);
  }
}

function mapOpenAIError(status: number, detail: string): LLMError {
  const message = `OpenAI API error ${status}: ${truncate(detail, 400)}`;
  if (status === 401 || status === 403) return new LLMError(message, "AUTH", false, status);
  if (status === 429) return new LLMError(message, "RATE_LIMIT", true, status);
  if (status === 400 || status === 422) return new LLMError(message, "BAD_REQUEST", false, status);
  if (status >= 500) return new LLMError(message, "PROVIDER_ERROR", true, status);
  return new LLMError(message, "PROVIDER_ERROR", false, status);
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
