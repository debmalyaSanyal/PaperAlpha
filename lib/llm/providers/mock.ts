import { estimateCost, LLMError, type GenerationOptions, type GenerationResult, type LLMProvider } from "../types";

/**
 * Deterministic offline provider.
 *
 * Used by the test-suite and by local development so the whole pipeline can be
 * exercised end to end without any API key. Responses are derived from a hash
 * of the prompt, so identical inputs always produce identical outputs.
 *
 * Handlers are keyed by `options.promptKey`. When a handler is registered for
 * the requested key it is used verbatim; otherwise a generic echo is returned.
 */
export type MockHandler = (prompt: string, options?: GenerationOptions) => string;

export class MockProvider implements LLMProvider {
  readonly name = "mock" as const;
  readonly defaultModel = "mock";

  private readonly handlers = new Map<string, MockHandler>();

  constructor(private readonly options: { model?: string } = {}) {}

  /** Register a deterministic response for a prompt key. */
  register(promptKey: string, handler: MockHandler): this {
    this.handlers.set(promptKey, handler);
    return this;
  }

  registerJson(promptKey: string, value: unknown): this {
    return this.register(promptKey, () => JSON.stringify(value));
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<GenerationResult> {
    const started = Date.now();
    const key = options.promptKey;
    const handler = key ? this.handlers.get(key) : undefined;

    let text: string;
    if (handler) {
      text = handler(prompt, options);
    } else if (options.json) {
      // A schema-shaped empty object keeps structured-output retries from
      // failing while still being obviously synthetic in review.
      text = JSON.stringify({ mock: true, promptKey: key ?? null });
    } else if (key) {
      text = `[mock:${key}] Deterministic placeholder generated offline for pipeline verification.`;
    } else {
      text = `[mock] Deterministic placeholder for prompt of length ${prompt.length}.`;
    }

    if (!text) {
      throw new LLMError("Mock provider produced an empty response.", "PROVIDER_ERROR");
    }

    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(text.length / 4);
    return {
      text,
      provider: this.name,
      model: options.model ?? this.options.model ?? this.defaultModel,
      usage: {
        inputTokens,
        outputTokens,
        costUsd: estimateCost(this.defaultModel, { inputTokens, outputTokens }),
      },
      latencyMs: Date.now() - started,
      cacheHit: false,
      finishReason: "stop",
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Deterministic 16-dimension pseudo-embedding derived from character codes.
    return texts.map((text) => {
      const vector = new Array(16).fill(0);
      for (let i = 0; i < text.length; i += 1) {
        vector[i % 16] = (vector[i % 16] + text.charCodeAt(i)) % 1000;
      }
      const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
      return vector.map((v) => Math.round((v / norm) * 1e6) / 1e6);
    });
  }
}

/** Convenience helper used by tests: a provider with no registered handlers. */
export function createMockProvider(): MockProvider {
  return new MockProvider();
}
