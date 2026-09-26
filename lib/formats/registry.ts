import acmJson from "@/formats/acm.json";
import apaJson from "@/formats/apa.json";
import baseJson from "@/formats/_base.json";
import elsevierJson from "@/formats/elsevier.json";
import ieeeJson from "@/formats/ieee.json";
import natureJson from "@/formats/nature.json";
import springerJson from "@/formats/springer.json";

import { deepMerge, resolveFormat } from "./loader";
import { FormatConfigSchema } from "./schema";
import type { FormatConfig, FormatPatch, ResolvedFormat } from "./types";

/**
 * Format registry.
 *
 * The JSON presets are imported statically (not read from disk at runtime) so
 * that they are always present in the Next.js server bundle on every host,
 * including Netlify's serverless functions.
 */

export const PRESET_NAMES = ["IEEE", "Springer", "Elsevier", "ACM", "APA", "Nature", "Custom"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export function parseBaseConfig(): FormatConfig {
  return FormatConfigSchema.parse(baseJson);
}

export const BASE_FORMAT: FormatConfig = parseBaseConfig();

const PRESET_JSON: Record<Exclude<PresetName, "Custom">, unknown> = {
  IEEE: ieeeJson,
  Springer: springerJson,
  Elsevier: elsevierJson,
  ACM: acmJson,
  APA: apaJson,
  Nature: natureJson,
};

const presetCache = new Map<string, FormatConfig>();

/** Get a validated venue preset merged onto the shared base. */
export function getPresetConfig(name: string): FormatConfig {
  const normalized = normalizePresetName(name);
  const cached = presetCache.get(normalized);
  if (cached) return cached;

  const json = PRESET_JSON[normalized as Exclude<PresetName, "Custom">] ?? {};
  const merged = resolveFormat(BASE_FORMAT, json as FormatPatch, { basePreset: normalized });
  const frozen: FormatConfig = { ...merged };
  presetCache.set(normalized, frozen);
  return frozen;
}

export function normalizePresetName(name: string | null | undefined): PresetName {
  if (!name) return "IEEE";
  const lower = name.trim().toLowerCase();
  const match = PRESET_NAMES.find((p) => p.toLowerCase() === lower);
  if (match) return match;
  // Tolerate common aliases users or LLMs may produce.
  const aliases: Record<string, PresetName> = {
    "ieee conference": "IEEE",
    "ieee journal": "IEEE",
    "springer llncs": "Springer",
    lncs: "Springer",
    "springer nature": "Springer",
    science_direct: "Elsevier",
    sciencedirect: "Elsevier",
    "elsevier journal": "Elsevier",
    "acm sigconf": "ACM",
    "acm conference": "ACM",
    "apa 7": "APA",
    "apa 7th": "APA",
    "nature research": "Nature",
    custom: "Custom",
  };
  return aliases[lower] ?? "IEEE";
}

/**
 * Resolve the effective format for a project.
 *
 * `formatName` selects a preset; `patch` applies user/LLM overrides on top.
 * When `formatName` is "Custom" the IEEE preset is used as the structural
 * baseline and the patch must carry the visual differences (this keeps a
 * sensible default outline and numbering when the user only specifies fonts,
 * margins and spacing).
 */
export function resolveProjectFormat(
  formatName: string | null | undefined,
  patch?: FormatPatch | null,
): ResolvedFormat {
  const name = normalizePresetName(formatName);
  const base = name === "Custom" ? getPresetConfig("IEEE") : getPresetConfig(name);
  const isCustom = name === "Custom" || Boolean(patch && Object.keys(patch).length > 0);
  return resolveFormat(base, patch ?? undefined, { basePreset: name, isCustom });
}

export interface PresetSummary {
  id: PresetName;
  name: string;
  description: string;
  columns: number;
  bodyFontSize: number;
  fontFamily: string;
  citationStyle: string;
}

export function listPresets(): PresetSummary[] {
  const summaries: PresetSummary[] = [];
  for (const name of PRESET_NAMES) {
    if (name === "Custom") {
      summaries.push({
        id: "Custom",
        name: "Custom",
        description: "Define your own format: font, size, margins, columns, spacing, heading and citation styles.",
        columns: BASE_FORMAT.page.columns,
        bodyFontSize: BASE_FORMAT.typography.bodyFontSize,
        fontFamily: BASE_FORMAT.typography.fontFamily,
        citationStyle: BASE_FORMAT.citationStyle,
      });
      continue;
    }
    const config = getPresetConfig(name);
    summaries.push({
      id: name,
      name: config.name,
      description: config.description,
      columns: config.page.columns,
      bodyFontSize: config.typography.bodyFontSize,
      fontFamily: config.typography.fontFamily,
      citationStyle: config.citationStyle,
    });
  }
  return summaries;
}

/** Merge a base config with a patch without validation (used only by tests). */
export function mergeFormat(base: FormatConfig, patch: FormatPatch): FormatConfig {
  return deepMerge(base, patch);
}
