/** Canonical section keys used across the outline, writers and exporters. */
export const CANONICAL_SECTIONS = [
  "abstract",
  "keywords",
  "introduction",
  "related_work",
  "research_gap",
  "methodology",
  "architecture",
  "dataset",
  "experimental_setup",
  "results",
  "ablation",
  "discussion",
  "limitations",
  "conclusion",
  "future_work",
  "references",
  "appendix",
] as const;

export type CanonicalSectionKey = (typeof CANONICAL_SECTIONS)[number];

export type SectionKind = "abstract" | "keywords" | "body" | "references" | "appendix";

export const NUMBERING_STYLES = [
  "none",
  "arabic",
  "arabic_dotted",
  "roman_upper",
  "roman_lower",
  "alpha_upper",
  "alpha_lower",
] as const;
export type NumberingStyle = (typeof NUMBERING_STYLES)[number];

export interface OutlineSectionSpec {
  key: string;
  title: string;
  level: number;
  kind: SectionKind;
  required: boolean;
  /** Default share of the total content budget (heuristic, see pageBudget.ts). */
  weight: number;
}

export interface HeadingStyle {
  fontSize: number;
  bold: boolean;
  italic: boolean;
  alignment: "left" | "center" | "right" | "justify";
  numbering: NumberingStyle;
  numberSeparator: string;
  numberingSuffix: string;
  spacingBeforePt: number;
  spacingAfterPt: number;
  uppercase?: boolean;
  smallCaps?: boolean;
  pageBreakBefore?: boolean;
}

export interface FormatConfig {
  id: string;
  name: string;
  description: string;
  page: {
    size: string;
    widthInches: number;
    heightInches: number;
    orientation: "portrait" | "landscape";
    columns: number;
    columnSpacingInches: number;
  };
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    gutter: number;
  };
  typography: {
    fontFamily: string;
    bodyFontSize: number;
    titleFontSize: number;
    authorFontSize: number;
    abstractFontSize: number;
    lineSpacing: number;
    paragraphSpacingBeforePt: number;
    paragraphSpacingAfterPt: number;
    firstLineIndentInches: number;
    justify: boolean;
  };
  title: {
    fontSize: number;
    bold: boolean;
    alignment: "left" | "center" | "right" | "justify";
    textCase: "title_case" | "sentence_case" | "upper" | "as_is";
    spacingAfterPt: number;
  };
  authors: {
    fontSize: number;
    alignment: "left" | "center" | "right" | "justify";
    includeAffiliations: boolean;
    spacingAfterPt: number;
  };
  abstract: {
    headingText: string;
    headingNumbered: boolean;
    headingBold: boolean;
    headingItalic: boolean;
    bodyBold: boolean;
    fontSize: number;
    justify: boolean;
    maxWords: number;
  };
  keywords: {
    headingText: string;
    headingInSameParagraph: boolean;
    headingItalic: boolean;
    headingBold: boolean;
    separator: string;
    maxCount: number;
    wordAfterColon?: boolean;
  };
  headings: {
    numberingEnabled: boolean;
    level1: HeadingStyle;
    level2: HeadingStyle;
    level3: HeadingStyle;
  };
  references: {
    headingText: string;
    headingNumbered: boolean;
    fontSize: number;
    hangingIndentInches: number;
    sortOrder: "citation_order" | "alphabetical_author" | "year_desc";
    labelFormat: string;
    style: string;
    pageBreakBefore: boolean;
  };
  figures: {
    captionPosition: "above" | "below";
    labelFormat: string;
    fontSize: number;
    captionBold: boolean;
    captionItalic: boolean;
    centered: boolean;
    maxWidthInches: number;
  };
  tables: {
    captionPosition: "above" | "below";
    labelFormat: string;
    fontSize: number;
    captionBold: boolean;
    captionItalic: boolean;
    centered: boolean;
    borderStyle: "grid" | "booktabs" | "ieee" | "acm" | "apa" | "nature" | "none";
    headerBold: boolean;
  };
  equations: {
    fontFamily: string;
    fontSize: number;
    numbering: "none" | "parenthesized_right" | "right_aligned";
    numberLabelFormat: string;
    centered: boolean;
  };
  pageNumbers: {
    enabled: boolean;
    position: "header" | "footer";
    alignment: "left" | "center" | "right";
    format: string;
  };
  header: {
    enabled: boolean;
    text: string;
  };
  outline: {
    sections: OutlineSectionSpec[];
  };
  citationStyle: string;
  wordsPerPage: {
    singleColumn: number;
    twoColumn: number;
  };
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type FormatPatch = DeepPartial<FormatConfig>;

/** A user-defined format: either a full/partial config patch, or a natural-language brief. */
export interface CustomFormatInput {
  /** Raw JSON patch supplied by the user (optional). */
  patch?: FormatPatch;
  /** Natural-language brief interpreted by the formatting agent (optional). */
  description?: string;
}

export interface ResolvedFormat extends FormatConfig {
  /** True when the format contains user overrides on top of a venue preset. */
  isCustom: boolean;
  /** Base preset the custom format was derived from. */
  basePreset?: string;
}
