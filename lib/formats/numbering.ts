import { alphaUpper, romanUpper } from "@/lib/utils";
import type { FormatConfig, HeadingStyle, NumberingStyle, OutlineSectionSpec } from "./types";

export interface SectionLabel {
  key: string;
  /** e.g. "I", "A", "1.1", "1)" — empty string when the section is unnumbered. */
  numberingText: string;
  /** numberingText + separator, ready to prefix the heading. */
  label: string;
  /** Heading text after applying upper/small-caps transformation. */
  displayTitle: string;
  level: 1 | 2 | 3;
  isNumbered: boolean;
}

/**
 * Compute heading labels for an outline under a given format.
 *
 * Handles the two conventions that matter in practice:
 *   IEEE      -> "I. INTRODUCTION", "A. Subsection", "1) Sub-subsection"
 *   Springer  -> "1 Introduction",   "1.1 Subsection", "1.1.1 Sub-subsection"
 *
 * Abstract, keywords and references never consume a section counter and are
 * never numbered (their labels come from format.abstract / references config).
 */
export function computeSectionLabels(
  sections: readonly OutlineSectionSpec[],
  format: FormatConfig,
): SectionLabel[] {
  const counters = { 1: 0, 2: 0, 3: 0 };

  return sections.map((section) => {
    const level = clampLevel(section.level);
    const countable = section.kind === "body" || section.kind === "appendix";

    if (countable) {
      counters[level] += 1;
      for (const deeper of [2, 3] as const) if (deeper > level) counters[deeper] = 0;
    }

    const numberingEnabled = countable && format.headings.numberingEnabled;
    const style = headingStyleFor(format, level);

    const numberingText = numberingEnabled
      ? computeNumber(style.numbering, counters, format)
      : "";

    const separator = numberingText ? style.numberSeparator : "";
    const suffix = numberingText ? style.numberingSuffix : "";

    return {
      key: section.key,
      numberingText,
      label: numberingText ? `${numberingText}${separator}${suffix}` : "",
      displayTitle: applyTitleCase(section.title, style),
      level,
      isNumbered: Boolean(numberingText),
    };
  });
}

export function headingStyleFor(format: FormatConfig, level: number): HeadingStyle {
  if (level <= 1) return format.headings.level1;
  if (level === 2) return format.headings.level2;
  return format.headings.level3;
}

export function applyTitleCase(title: string, style: HeadingStyle): string {
  if (style.uppercase) return title.toUpperCase();
  return title;
}

function clampLevel(level: number): 1 | 2 | 3 {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  return 3;
}

function computeNumber(
  style: NumberingStyle,
  counters: { 1: number; 2: number; 3: number },
  format: FormatConfig,
): string {
  const { 1: l1, 2: l2, 3: l3 } = counters;

  switch (style) {
    case "none":
      return "";
    case "arabic":
      return String(counters[3] || counters[2] || counters[1]);
    case "arabic_dotted": {
      // Level 2 always uses the dotted path ("1.1"). At level 3 the dotted path
      // is only used when the level-2 style is itself dotted (Springer);
      // otherwise the number restarts inside its parent (IEEE "1)").
      if (l2 > 0) {
        const parentDotted = format.headings.level2.numbering === "arabic_dotted";
        return parentDotted ? `${l1}.${l2}.${l3}` : String(l3);
      }
      return l1 > 0 ? `${l1}.${l2 || 1}` : String(counters[1]);
    }
    case "roman_upper":
      return romanUpper(counters[3] || counters[2] || counters[1]);
    case "roman_lower":
      return romanUpper(counters[3] || counters[2] || counters[1]).toLowerCase();
    case "alpha_upper":
      return alphaUpper(counters[3] || counters[2] || counters[1]);
    case "alpha_lower":
      return alphaUpper(counters[3] || counters[2] || counters[1]).toLowerCase();
    default:
      return "";
  }
}

/** Render a heading line exactly as it should appear in the document. */
export function renderHeading(label: SectionLabel): string {
  return label.label ? `${label.label}${label.displayTitle}`.trim() : label.displayTitle;
}
