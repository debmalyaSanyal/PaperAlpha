import { FormatConfigSchema } from "./schema";
import type { DeepPartial, FormatConfig, FormatPatch, ResolvedFormat } from "./types";

/**
 * Deep-merge a patch onto a base configuration.
 *
 * Semantics:
 *  - plain objects are merged recursively
 *  - arrays are REPLACED wholesale (replacing the outline is intentional)
 *  - `undefined` never overwrites a defined base value
 *  - `null` is treated as "explicitly clear" and is written through
 */
export function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (patch === undefined) return cloneDeep(base);
  if (patch === null) return null as unknown as T;
  if (Array.isArray(patch)) return cloneDeep(patch) as unknown as T;
  if (!isPlainObject(patch) || !isPlainObject(base)) return cloneDeep(patch) as unknown as T;

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(value) && isPlainObject(current) ? deepMerge(current, value as never) : cloneDeep(value);
  }
  return out as unknown as T;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneDeep<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => cloneDeep(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = cloneDeep(v);
  return out as T;
}

/**
 * Merge a preset with an optional user patch and validate the result.
 * Throws a descriptive error when the merged configuration is invalid.
 */
export function resolveFormat(
  base: FormatConfig,
  patch?: FormatPatch,
  options: { basePreset?: string; isCustom?: boolean } = {},
): ResolvedFormat {
  const merged = deepMerge(base, patch);
  const parsed = FormatConfigSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Format configuration is invalid after merge:\n${issues}`);
  }
  return {
    ...parsed.data,
    isCustom: options.isCustom ?? false,
    basePreset: options.basePreset ?? base.id,
  };
}

/** Effective words-per-page for the format, based on its column count. */
export function wordsPerPage(format: FormatConfig): number {
  return format.page.columns > 1 ? format.wordsPerPage.twoColumn : format.wordsPerPage.singleColumn;
}

/** Effective text width available on a page, in inches. */
export function textWidthInches(format: FormatConfig): number {
  const available = format.page.widthInches - format.margins.left - format.margins.right;
  if (format.page.columns <= 1) return available;
  const totalSpacing = format.page.columnSpacingInches * (format.page.columns - 1);
  return (available - totalSpacing) / format.page.columns;
}

/** Format a human-readable one-line summary used in the UI and in prompts. */
export function describeFormat(format: FormatConfig): string {
  return [
    `${format.name} (${format.page.size}, ${format.page.columns === 1 ? "single" : `${format.page.columns}-column`})`,
    `${format.typography.bodyFontSize}pt ${format.typography.fontFamily}`,
    `margins ${format.margins.top}in/${format.margins.bottom}in/${format.margins.left}in/${format.margins.right}in`,
    `line spacing ${format.typography.lineSpacing}`,
    `${describeNumbering(format)} headings`,
    `${format.citationStyle} citation style`,
  ].join(", ");
}

function describeNumbering(format: FormatConfig): string {
  if (!format.headings.numberingEnabled) return "unnumbered";
  return format.headings.level1.numbering === "roman_upper" ? "Roman-numeral numbered" : "decimal numbered";
}
