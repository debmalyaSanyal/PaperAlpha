import { createHash } from "node:crypto";

import { getEnv } from "@/lib/env";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { MockProvider } from "./providers/mock";
import { OpenAIProvider } from "./providers/openai";
import {
  LLMError,
  type GenerationOptions,
  type GenerationResult,
  type LLMProvider,
  type LLMProviderName,
} from "./types";

export interface LLMServiceOptions {
  /** Hard cap on prompt characters; longer prompts are truncated before sending. */
  maxPromptChars?: number;
  /** Number of in-process cached responses to retain. */
  cacheSize?: number;
  /** Observer invoked after every call, used for token accounting in the DB. */
  onCall?: (record: { promptKey?: string; result: GenerationResult; ok: boolean; error?: string }) => void;
}

interface CacheEntry {
  result: GenerationResult;
  storedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

/** Resolve the configured provider exactly once per process. */
export function resolveProvider(name?: LLMProviderName): LLMProvider {
  const env = getEnv();
  const provider = name ?? env.LLM_PROVIDER;
  const common = { model: env.LLM_MODEL || undefined, timeoutMs: env.LLM_TIMEOUT_MS };

  switch (provider) {
    case "openai":
      return new OpenAIProvider({ apiKey: env.OPENAI_API_KEY ?? "", baseUrl: env.OPENAI_BASE_URL, ...common });
    case "anthropic":
      return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY ?? "", baseUrl: env.ANTHROPIC_BASE_URL, ...common });
    case "gemini":
      return new GeminiProvider({ apiKey: env.GOOGLE_API_KEY ?? "", baseUrl: env.GOOGLE_BASE_URL, ...common });
    case "mock":
      return new MockProvider({ model: env.LLM_MODEL || undefined });
    default:
      throw new LLMError(`Unknown LLM provider: ${String(provider)}`, "BAD_REQUEST");
  }
}

/**
 * Wraps a provider with retries, response caching and token accounting so
 * callers never deal with vendor behaviour directly (specification section 38).
 */
export class LLMService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxPromptChars: number;
  private readonly cacheSize: number;

  constructor(
    readonly provider: LLMProvider,
    private readonly options: LLMServiceOptions = {},
  ) {
    this.maxPromptChars = options.maxPromptChars ?? 400_000;
    this.cacheSize = options.cacheSize ?? 128;
  }

  /** True when the provider can actually serve requests (used to gate the UI). */
  static isConfigured(): boolean {
    const env = getEnv();
    if (env.LLM_PROVIDER === "mock") return true;
    if (env.LLM_PROVIDER === "openai") return Boolean(env.OPENAI_API_KEY);
    if (env.LLM_PROVIDER === "anthropic") return Boolean(env.ANTHROPIC_API_KEY);
    if (env.LLM_PROVIDER === "gemini") return Boolean(env.GOOGLE_API_KEY);
    return false;
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    const env = getEnv();
    const prepared = this.prepare(prompt);
    const cacheKey = this.cacheKey(prepared, options);

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return { ...cached.result, cacheHit: true };
    }

    let lastError: unknown;
    const attempts = Math.max(1, env.LLM_MAX_RETRIES + 1);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await this.provider.generate(prepared, {
          temperature: options.temperature ?? env.LLM_TEMPERATURE,
          maxOutputTokens: options.maxOutputTokens ?? env.LLM_MAX_OUTPUT_TOKENS,
          timeoutMs: options.timeoutMs ?? env.LLM_TIMEOUT_MS,
          ...options,
        });
        this.store(cacheKey, result);
        this.options.onCall?.({ promptKey: options.promptKey, result, ok: true });
        return result;
      } catch (error) {
        lastError = error;
        const retryable = error instanceof LLMError ? error.retryable : false;
        if (!retryable || attempt === attempts) break;
        await delay(Math.min(8000, 400 * 2 ** (attempt - 1)));
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    this.options.onCall?.({
      promptKey: options.promptKey,
      ok: false,
      error: message,
      result: {
        text: "",
        provider: this.provider.name,
        model: this.provider.defaultModel,
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        latencyMs: 0,
        cacheHit: false,
      },
    });
    throw lastError instanceof Error ? lastError : new LLMError(message, "PROVIDER_ERROR");
  }

  /** Convenience wrapper for system+user prompts; retry logic still lives here. */
  async generateChat(system: string, user: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    return this.generate(`${system}\n\n---\n\n${user}`, options);
  }

  clearCache(): void {
    this.cache.clear();
  }

  private prepare(prompt: string): string {
    if (prompt.length <= this.maxPromptChars) return prompt;
    const head = prompt.slice(0, Math.floor(this.maxPromptChars * 0.7));
    const tail = prompt.slice(-Math.floor(this.maxPromptChars * 0.25));
    return `${head}\n\n[... prompt truncated to respect the configured context limit ...]\n\n${tail}`;
  }

  private cacheKey(prompt: string, options: GenerationOptions): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          provider: this.provider.name,
          model: options.model ?? this.provider.defaultModel,
          temperature: options.temperature ?? null,
          json: options.json ?? false,
          prompt,
        }),
      )
      .digest("hex");
  }

  private store(key: string, result: GenerationResult): void {
    this.cache.set(key, { result, storedAt: Date.now() });
    while (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let service: LLMService | null = null;

/** Shared service instance used by route handlers and the worker. */
export function getLLM(options?: LLMServiceOptions): LLMService {
  if (!service) service = new LLMService(resolveProvider(), options);
  return service;
}

/** Test helper. */
export function resetLLMService(): void {
  service = null;
}

export * from "./types";
export { MockProvider } from "./providers/mock";
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";
export { GeminiProvider } from "./providers/gemini";
