import type { FormatConfig, FormatPatch } from "./types";

/**
 * Lightweight runtime shape guard for the zero-budget MVP.
 *
 * The previous implementation used Zod. PaperAlpha's active app only needs
 * preset loading for tests and future export styling, so this module keeps the
 * public API without adding a dependency that a fresh free deployment must
 * download.
 */
export const FormatConfigSchema = {
  parse(input: unknown): FormatConfig {
    if (!input || typeof input !== "object") {
      throw new Error("Format config must be an object.");
    }
    const config = input as Partial<FormatConfig>;
    if (!config.id || !config.name || !config.page || !config.typography) {
      throw new Error("Format config is missing required preset fields.");
    }
    return input as FormatConfig;
  },
  safeParse(input: unknown): { success: true; data: FormatConfig } | { success: false; error: { issues: Array<{ path: string[]; message: string }> } } {
    try {
      return { success: true, data: this.parse(input) };
    } catch (error) {
      return {
        success: false,
        error: {
          issues: [{ path: [], message: error instanceof Error ? error.message : "Invalid format config." }],
        },
      };
    }
  },
};

export const FormatPatchSchema = {
  parse(input: unknown): FormatPatch {
    return (input ?? {}) as FormatPatch;
  },
  safeParse(input: unknown): { success: true; data: FormatPatch } {
    return { success: true, data: (input ?? {}) as FormatPatch };
  },
};

export const CustomFormatSchema = FormatPatchSchema;
export type ParsedFormatConfig = FormatConfig;
export const __schemaTypeCheck = true;

export function parseFormatPatch(input: unknown): FormatPatch {
  return FormatPatchSchema.parse(input);
}

export function safeParseFormatPatch(input: unknown): { ok: true; patch: FormatPatch } {
  return { ok: true, patch: FormatPatchSchema.parse(input) };
}

export const FORMAT_PATCH_GUIDE = {
  page: { size: "A4|Letter", columns: "1|2|3" },
  margins: { top: "inches", bottom: "inches", left: "inches", right: "inches" },
  typography: { fontFamily: "string", bodyFontSize: "pt", lineSpacing: "number" },
  citationStyle: "string",
} as const;
