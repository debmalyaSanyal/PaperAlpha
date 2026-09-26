import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Prompt loading (specification section 35).
 *
 * Instructions live in /prompts/<name>.txt as individual, reviewable files
 * rather than inside one enormous system prompt. Templates use a minimal
 * `{{placeholder}}` syntax so the same files can be rendered by the Python
 * worker (backend/app/prompts.py) and by the TypeScript control plane.
 */

export const PROMPT_NAMES = [
  "research_understanding",
  "code_analysis",
  "literature_search",
  "literature_synthesis",
  "methodology",
  "results_analysis",
  "outline",
  "abstract",
  "introduction",
  "related_work",
  "discussion",
  "conclusion",
  "citation_verification",
  "quality_control",
  "formatting",
] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];

const cache = new Map<string, string>();

export function promptsRoot(): string {
  return process.env.PROMPTS_DIR ?? path.join(process.cwd(), "prompts");
}

export async function loadPrompt(name: PromptName | string): Promise<string> {
  const normalized = name.replace(/\.txt$/i, "");
  const cached = cache.get(normalized);
  if (cached !== undefined) return cached;

  const file = path.join(promptsRoot(), `${normalized}.txt`);
  try {
    const content = await readFile(file, "utf8");
    cache.set(normalized, content);
    return content;
  } catch (error) {
    throw new Error(
      `Prompt "${normalized}" could not be read from ${file}: ${(error as Error).message}`,
    );
  }
}

export async function listPromptFiles(): Promise<string[]> {
  const entries = await readdir(promptsRoot(), { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(".txt")).map((e) => e.name).sort();
}

/** Test helper. */
export function clearPromptCache(): void {
  cache.clear();
}

/**
 * Render `{{placeholder}}` occurrences.
 * Unknown placeholders are left visible so a missing variable is obvious in
 * the generated prompt rather than silently producing an empty string.
 */
export function renderTemplate(template: string, values: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = values[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

/** Load and render a prompt in one step. */
export async function buildPrompt(
  name: PromptName | string,
  values: Record<string, string | number | null | undefined> = {},
): Promise<string> {
  const template = await loadPrompt(name);
  return renderTemplate(template, values);
}
