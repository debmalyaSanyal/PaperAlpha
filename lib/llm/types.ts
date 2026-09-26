/**
 * Provider-agnostic LLM interface (specification section 34).
 *
 * The application never imports a vendor SDK directly: it resolves an
 * `LLMProvider` from configuration and talks to this interface only.
 */

export type LLMProviderName = "openai" | "anthropic" | "gemini" | "mock";

export interface GenerationOptions {
  /** Overrides the configured default model. */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Stop sequences passed through to providers that support them. */
  stopSequences?: string[];
  /**
   * Prompt key used for observability and cost attribution, e.g.
   * "methodology" or "literature_synthesis".
   */
  promptKey?: string;
  /** Force JSON-only output where the provider supports a response-format knob. */
  json?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Estimated cost in USD, 0 when the price table has no entry. */
  costUsd: number;
}

export interface GenerationResult {
  text: string;
  provider: LLMProviderName;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  /** True when the response came from a local cache rather than the vendor. */
  cacheHit: boolean;
  finishReason?: string;
}

export interface LLMProvider {
  readonly name: LLMProviderName;
  readonly defaultModel: string;
  generate(prompt: string, options?: GenerationOptions): Promise<GenerationResult>;
  /** Embeddings are optional; not every provider or use case needs them. */
  embed?(texts: string[]): Promise<number[][]>;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions extends GenerationOptions {
  system?: string;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly code:
      | "AUTH"
      | "RATE_LIMIT"
      | "TIMEOUT"
      | "BAD_REQUEST"
      | "PROVIDER_ERROR"
      | "INVALID_JSON"
      | "UNAVAILABLE",
    readonly retryable = false,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/**
 * Approximate USD price per 1M tokens, used only for cost reporting.
 * Unknown models report 0 cost rather than guessing.
 */
export const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "claude-3-7-sonnet-latest": { input: 3, output: 15 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  mock: { input: 0, output: 0 },
};

export function estimateCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const price = PRICE_TABLE[model] ?? PRICE_TABLE[model.replace(/-\d{8}$/, "")];
  if (!price) return 0;
  const cost = (usage.inputTokens / 1_000_000) * price.input + (usage.outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1e6) / 1e6;
}
