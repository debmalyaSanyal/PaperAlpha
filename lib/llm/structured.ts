import type { ZodType, ZodTypeDef } from "zod";

import { LLMError, type GenerationOptions } from "./types";
import type { LLMService } from "./index";

/**
 * Structured-output helper (specification section 36).
 *
 * Asks the model for JSON, extracts it defensively, validates it against a Zod
 * schema, and on failure retries once or twice with a correction prompt that
 * contains the validator errors. Only validated data reaches the pipeline.
 */

export interface StructuredRequest<T> {
  schema: ZodType<T, ZodTypeDef, unknown>;
  /** Human-readable schema name used in prompts and error messages. */
  schemaName: string;
  prompt: string;
  options?: GenerationOptions;
  /** Additional repair attempts after the initial call. Defaults to 2. */
  maxRepairAttempts?: number;
  /** Called before each attempt, for progress reporting. */
  onAttempt?: (attempt: number, phase: "initial" | "repair") => void;
}

export interface StructuredResult<T> {
  value: T;
  raw: string;
  attempts: number;
  /** True when at least one repair round took place. */
  repaired: boolean;
}

export async function generateStructured<T>(
  llm: LLMService,
  request: StructuredRequest<T>,
): Promise<StructuredResult<T>> {
  const maxRepair = request.maxRepairAttempts ?? 2;
  let prompt = buildInitialPrompt(request.prompt, request.schemaName);
  let lastRaw = "";
  let lastIssues: string[] = [];
  let repaired = false;

  for (let attempt = 0; attempt <= maxRepair; attempt += 1) {
    const phase: "initial" | "repair" = attempt === 0 ? "initial" : "repair";
    request.onAttempt?.(attempt + 1, phase);
    if (phase === "repair") repaired = true;

    const result = await llm.generate(prompt, {
      ...request.options,
      json: true,
      promptKey: request.options?.promptKey,
    });
    lastRaw = result.text;

    const extracted = extractJson(result.text);
    if (extracted === null) {
      lastIssues = ["Response did not contain a JSON object or array."];
    } else {
      let candidate: unknown;
      try {
        candidate = JSON.parse(extracted);
      } catch (error) {
        lastIssues = [`JSON.parse failed: ${(error as Error).message}`];
        candidate = undefined;
      }

      if (candidate !== undefined) {
        const parsed = request.schema.safeParse(candidate);
        if (parsed.success) {
          return { value: parsed.data, raw: lastRaw, attempts: attempt + 1, repaired };
        }
        lastIssues = parsed.error.issues
          .slice(0, 25)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
    }

    if (attempt < maxRepair) prompt = buildRepairPrompt(request.schemaName, lastRaw, lastIssues);
  }

  throw new LLMError(
    `Structured output for "${request.schemaName}" failed validation after ${maxRepair + 1} attempt(s):\n${lastIssues
      .map((i) => `  - ${i}`)
      .join("\n")}`,
    "INVALID_JSON",
    false,
  );
}

function buildInitialPrompt(prompt: string, schemaName: string): string {
  return `${prompt}

Return ONLY a single JSON value matching the "${schemaName}" schema.
Do not wrap the JSON in prose, markdown fences, or commentary.
Use null for values that are unavailable rather than inventing values.`;
}

function buildRepairPrompt(schemaName: string, previous: string, issues: string[]): string {
  return `Your previous response was not valid JSON for the "${schemaName}" schema.

Validation errors:
${issues.map((i) => `- ${i}`).join("\n")}

Previous response (truncated):
"""
${previous.slice(0, 6000)}
"""

Return the corrected, complete JSON value only. No prose, no markdown fences.`;
}

/**
 * Extract the first JSON object or array from a model response.
 * Tolerates markdown fences and leading/trailing prose.
 */
export function extractJson(text: string): string | null {
  if (!text) return null;

  let candidate = text.trim();

  const fenceMatch = candidate.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) candidate = fenceMatch[1].trim();

  const startIndex = findFirstOf(candidate, ["{", "["]);
  if (startIndex < 0) return null;

  const opener = candidate[startIndex];
  const closer = opener === "{" ? "}" : "]";
  const endIndex = findBalancedEnd(candidate, startIndex, opener, closer);
  if (endIndex < 0) return candidate.slice(startIndex);
  return candidate.slice(startIndex, endIndex + 1);
}

function findFirstOf(text: string, chars: string[]): number {
  let best = -1;
  for (const char of chars) {
    const index = text.indexOf(char);
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }
  return best;
}

/** Walk the string tracking string/escape state so braces inside strings are ignored. */
function findBalancedEnd(text: string, start: number, opener: string, closer: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === opener) depth += 1;
    else if (char === closer) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
