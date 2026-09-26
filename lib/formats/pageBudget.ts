import { wordsPerPage } from "./loader";
import type { FormatConfig, OutlineSectionSpec } from "./types";

/**
 * Page-count budgeting and estimation (specification sections 16 and 25).
 *
 * The constants below are documented heuristics calibrated from real typeset
 * papers, not guarantees. They let the pipeline (a) split a word budget across
 * sections before writing and (b) decide whether a generated document needs a
 * compression or expansion revision pass.
 */

export interface BudgetInput {
  format: FormatConfig;
  targetPages: number;
  targetWords?: number | null;
  sections: readonly OutlineSectionSpec[];
  figureCount?: number;
  tableCount?: number;
  /** Fraction of a page consumed by the title/authors block. */
  titleBlockPages?: number;
}

export interface SectionBudget {
  key: string;
  title: string;
  level: number;
  kind: OutlineSectionSpec["kind"];
  weight: number;
  words: number;
}

export interface WordBudget {
  totalWords: number;
  proseWords: number;
  reservedForFigures: number;
  reservedForTables: number;
  referencesWords: number;
  wordsPerPage: number;
  contentPages: number;
  sections: SectionBudget[];
  notes: string[];
}

export const HEURISTICS = {
  /** A full-width figure plus caption, as a fraction of a text page. */
  figurePageFraction: { singleColumn: 0.42, twoColumn: 0.55 },
  /** A table plus caption, as a fraction of a text page. */
  tablePageFraction: { singleColumn: 0.3, twoColumn: 0.35 },
  /** Words attributed to a single reference entry in the reference list. */
  wordsPerReference: 30,
  /** Reference entries that fit on one page at typical reference font sizes. */
  referencesPerPage: 42,
  /** Assumption used when the caller does not supply a reference count. */
  defaultReferenceCount: 30,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function figurePageFraction(format: FormatConfig): number {
  return format.page.columns > 1
    ? HEURISTICS.figurePageFraction.twoColumn
    : HEURISTICS.figurePageFraction.singleColumn;
}

export function tablePageFraction(format: FormatConfig): number {
  return format.page.columns > 1
    ? HEURISTICS.tablePageFraction.twoColumn
    : HEURISTICS.tablePageFraction.singleColumn;
}

/** Convert a target page count into a per-section word allocation. */
export function allocateWordBudget(input: BudgetInput): WordBudget {
  const { format, sections, figureCount = 0, tableCount = 0 } = input;

  const notes: string[] = [];
  const targetPages = clamp(Math.round(input.targetPages || 8), 2, 60);
  const wpp = wordsPerPage(format);

  const titleBlockPages = input.titleBlockPages ?? (format.page.columns > 1 ? 0.22 : 0.16);
  const referenceCount = HEURISTICS.defaultReferenceCount;
  const referencesPages = referenceCount / HEURISTICS.referencesPerPage;
  const referencesWords = referenceCount * HEURISTICS.wordsPerReference;

  const figureReserve = figureCount * figurePageFraction(format);
  const tableReserve = tableCount * tablePageFraction(format);

  const contentPages = Math.max(0.5, targetPages - titleBlockPages - referencesPages);
  const capacityPages = contentPages - figureReserve - tableReserve;
  if (capacityPages <= 0.25) {
    notes.push(
      "Figures and tables reserve more space than the target page count allows; raise the page target or reduce artwork.",
    );
  }

  const capacityWords = Math.max(120, capacityPages) * wpp;
  let totalWords = Math.round(capacityWords);

  if (input.targetWords && input.targetWords > 0) {
    const requested = Math.round(input.targetWords);
    const plausibleMax = Math.round((contentPages + 0.5) * wpp);
    const plausibleMin = Math.round(Math.max(0.4, contentPages - 0.6) * wpp);
    if (requested > plausibleMax) {
      notes.push(
        `Requested ${requested} words exceeds what ${targetPages} ${format.name} pages can hold (~${plausibleMax}); the document may run longer than requested.`,
      );
    } else if (requested < plausibleMin) {
      notes.push(
        `Requested ${requested} words is below the ${targetPages}-page capacity; sections will be concise.`,
      );
    }
    totalWords = requested;
  }

  const budgeted = sections.filter((s) => s.kind !== "references");
  const weightSum = budgeted.reduce((acc, s) => acc + Math.max(0, s.weight), 0) || 1;

  const sectionBudgets: SectionBudget[] = budgeted.map((section) => {
    const weight = Math.max(0, section.weight) / weightSum;
    let words = Math.round(totalWords * weight);
    if (section.kind === "abstract") words = Math.min(words, format.abstract.maxWords);
    if (section.kind === "keywords") words = Math.min(words, 40);
    return {
      key: section.key,
      title: section.title,
      level: section.level,
      kind: section.kind,
      weight: round2(weight),
      words: Math.max(0, words),
    };
  });

  return {
    totalWords,
    proseWords: totalWords,
    reservedForFigures: Math.round(figureReserve * wpp),
    reservedForTables: Math.round(tableReserve * wpp),
    referencesWords,
    wordsPerPage: wpp,
    contentPages: round2(capacityPages),
    sections: sectionBudgets,
    notes,
  };
}

export interface EstimateInput {
  format: FormatConfig;
  wordCount: number;
  figureCount?: number;
  tableCount?: number;
  referenceCount?: number;
  titleBlockPages?: number;
}

export interface PageEstimate {
  pages: number;
  breakdown: {
    titleBlock: number;
    prose: number;
    figures: number;
    tables: number;
    references: number;
  };
}

/** Estimate the rendered page count of a document from its content volumes. */
export function estimatePageCount(input: EstimateInput): PageEstimate {
  const { format } = input;
  const wpp = wordsPerPage(format);
  const titleBlock = input.titleBlockPages ?? (format.page.columns > 1 ? 0.22 : 0.16);

  const breakdown = {
    titleBlock: round2(titleBlock),
    prose: round2(Math.max(0, input.wordCount) / wpp),
    figures: round2((input.figureCount ?? 0) * figurePageFraction(format)),
    tables: round2((input.tableCount ?? 0) * tablePageFraction(format)),
    references: round2((input.referenceCount ?? 0) / HEURISTICS.referencesPerPage),
  };

  const pages =
    breakdown.titleBlock +
    breakdown.prose +
    breakdown.figures +
    breakdown.tables +
    breakdown.references;

  return { pages: round2(pages), breakdown };
}

export type LengthVerdict = "ok" | "too_short" | "too_long";

export interface LengthAssessment {
  verdict: LengthVerdict;
  targetPages: number;
  estimatedPages: number;
  deltaPages: number;
  /** Fractional deviation from the target (0.12 == 12% off). */
  deviation: number;
  message: string;
}

/** Decide whether a generated document needs to be expanded or compressed. */
export function assessLength(
  estimate: PageEstimate,
  targetPages: number,
  tolerance = 0.12,
): LengthAssessment {
  const target = Math.max(1, targetPages);
  const deviation = (estimate.pages - target) / target;
  const deltaPages = round2(estimate.pages - target);

  if (deviation > tolerance) {
    return {
      verdict: "too_long",
      targetPages: target,
      estimatedPages: estimate.pages,
      deltaPages,
      deviation: round2(deviation),
      message: `Estimated ${estimate.pages} pages against a ${target}-page target: compress sections by roughly ${Math.round(
        (deviation / (1 + deviation)) * 100,
      )}% without dropping evidence.`,
    };
  }
  if (deviation < -tolerance) {
    return {
      verdict: "too_short",
      targetPages: target,
      estimatedPages: estimate.pages,
      deltaPages,
      deviation: round2(deviation),
      message: `Estimated ${estimate.pages} pages against a ${target}-page target: expand substantive sections by roughly ${Math.round(
        Math.abs(deviation) * 100,
      )}% without repeating content.`,
    };
  }
  return {
    verdict: "ok",
    targetPages: target,
    estimatedPages: estimate.pages,
    deltaPages,
    deviation: round2(deviation),
    message: `Estimated ${estimate.pages} pages, within tolerance of the ${target}-page target.`,
  };
}
