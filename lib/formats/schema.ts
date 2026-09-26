import { z } from "zod";
import { NUMBERING_STYLES, type FormatConfig, type FormatPatch } from "./types";

/**
 * Zod validation for the format engine.
 *
 * `FormatConfigSchema` is the *strict* description of a fully-resolved format
 * and is used to validate `formats/_base.json` plus every venue preset, and
 * again after any merge, so a malformed config fails loudly at load time.
 *
 * `FormatPatchSchema` is its deep-partial shadow: the shape accepted from users
 * (custom format JSON) and from the LLM formatting agent.
 */

const alignment = z.enum(["left", "center", "right", "justify"]);
const hexOrName = z.string().min(1).max(64);

const HeadingStyleSchema = z.object({
  fontSize: z.number().min(6).max(36),
  bold: z.boolean(),
  italic: z.boolean(),
  alignment,
  numbering: z.enum(NUMBERING_STYLES),
  numberSeparator: z.string().max(8).default(". "),
  numberingSuffix: z.string().max(8).default(""),
  spacingBeforePt: z.number().min(0).max(72),
  spacingAfterPt: z.number().min(0).max(72),
  uppercase: z.boolean().optional(),
  smallCaps: z.boolean().optional(),
  pageBreakBefore: z.boolean().optional(),
});

const PageSchema = z.object({
  size: z.string().min(1).max(32),
  widthInches: z.number().min(4).max(20),
  heightInches: z.number().min(4).max(20),
  orientation: z.enum(["portrait", "landscape"]),
  columns: z.number().int().min(1).max(3),
  columnSpacingInches: z.number().min(0).max(2),
});

const MarginsSchema = z.object({
  top: z.number().min(0).max(3),
  bottom: z.number().min(0).max(3),
  left: z.number().min(0).max(3),
  right: z.number().min(0).max(3),
  gutter: z.number().min(0).max(2),
});

const TypographySchema = z.object({
  fontFamily: hexOrName,
  bodyFontSize: z.number().min(6).max(24),
  titleFontSize: z.number().min(8).max(40),
  authorFontSize: z.number().min(6).max(24),
  abstractFontSize: z.number().min(6).max(24),
  lineSpacing: z.number().min(1).max(3),
  paragraphSpacingBeforePt: z.number().min(0).max(72),
  paragraphSpacingAfterPt: z.number().min(0).max(72),
  firstLineIndentInches: z.number().min(0).max(2),
  justify: z.boolean(),
});

const TitleSchema = z.object({
  fontSize: z.number().min(8).max(40),
  bold: z.boolean(),
  alignment,
  textCase: z.enum(["title_case", "sentence_case", "upper", "as_is"]),
  spacingAfterPt: z.number().min(0).max(72),
});

const AuthorsSchema = z.object({
  fontSize: z.number().min(6).max(24),
  alignment,
  includeAffiliations: z.boolean(),
  spacingAfterPt: z.number().min(0).max(72),
});

const AbstractSchema = z.object({
  headingText: z.string().min(1).max(40),
  headingNumbered: z.boolean(),
  headingBold: z.boolean(),
  headingItalic: z.boolean(),
  bodyBold: z.boolean(),
  fontSize: z.number().min(6).max(24),
  justify: z.boolean(),
  maxWords: z.number().int().min(50).max(600),
});

const KeywordsSchema = z.object({
  headingText: z.string().min(1).max(40),
  headingInSameParagraph: z.boolean(),
  headingItalic: z.boolean(),
  headingBold: z.boolean(),
  separator: z.string().max(8),
  maxCount: z.number().int().min(1).max(20),
  wordAfterColon: z.boolean().optional(),
});

const OutlineSectionSchema = z.object({
  key: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  level: z.number().int().min(1).max(3),
  kind: z.enum(["abstract", "keywords", "body", "references", "appendix"]),
  required: z.boolean(),
  weight: z.number().min(0).max(1),
});

const ReferencesSchema = z.object({
  headingText: z.string().min(1).max(40),
  headingNumbered: z.boolean(),
  fontSize: z.number().min(6).max(24),
  hangingIndentInches: z.number().min(0).max(1.5),
  sortOrder: z.enum(["citation_order", "alphabetical_author", "year_desc"]),
  labelFormat: z.string().max(32),
  style: z.string().min(1).max(40),
  pageBreakBefore: z.boolean(),
});

const FiguresSchema = z.object({
  captionPosition: z.enum(["above", "below"]),
  labelFormat: z.string().min(1).max(40),
  fontSize: z.number().min(6).max(24),
  captionBold: z.boolean(),
  captionItalic: z.boolean(),
  centered: z.boolean(),
  maxWidthInches: z.number().min(1).max(9),
});

const TablesSchema = z.object({
  captionPosition: z.enum(["above", "below"]),
  labelFormat: z.string().min(1).max(40),
  fontSize: z.number().min(6).max(24),
  captionBold: z.boolean(),
  captionItalic: z.boolean(),
  centered: z.boolean(),
  borderStyle: z.enum(["grid", "booktabs", "ieee", "acm", "apa", "nature", "none"]),
  headerBold: z.boolean(),
});

const EquationsSchema = z.object({
  fontFamily: hexOrName,
  fontSize: z.number().min(6).max(24),
  numbering: z.enum(["none", "parenthesized_right", "right_aligned"]),
  numberLabelFormat: z.string().max(16),
  centered: z.boolean(),
});

const PageNumbersSchema = z.object({
  enabled: z.boolean(),
  position: z.enum(["header", "footer"]),
  alignment: z.enum(["left", "center", "right"]),
  format: z.string().max(16),
});

const HeaderSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(200),
});

export const FormatConfigSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  description: z.string().max(600),
  page: PageSchema,
  margins: MarginsSchema,
  typography: TypographySchema,
  title: TitleSchema,
  authors: AuthorsSchema,
  abstract: AbstractSchema,
  keywords: KeywordsSchema,
  headings: z.object({
    numberingEnabled: z.boolean(),
    level1: HeadingStyleSchema,
    level2: HeadingStyleSchema,
    level3: HeadingStyleSchema,
  }),
  references: ReferencesSchema,
  figures: FiguresSchema,
  tables: TablesSchema,
  equations: EquationsSchema,
  pageNumbers: PageNumbersSchema,
  header: HeaderSchema,
  outline: z.object({ sections: z.array(OutlineSectionSchema).min(1) }),
  citationStyle: z.string().min(1).max(40),
  wordsPerPage: z.object({
    singleColumn: z.number().int().min(100).max(2000),
    twoColumn: z.number().int().min(100).max(3000),
  }),
});

/** Shape accepted from users and from the LLM formatting agent. */
export const FormatPatchSchema = FormatConfigSchema.deepPartial();

/** Shape accepted for a fully custom user format. */
export const CustomFormatSchema = FormatPatchSchema;

export type ParsedFormatConfig = z.infer<typeof FormatConfigSchema>;

/**
 * Compile-time guarantee that the Zod schema and the hand-written
 * `FormatConfig` interface stay in agreement. If either drifts, this module
 * stops typechecking.
 */
type AssertSchemaMatchesType = ParsedFormatConfig extends FormatConfig
  ? FormatConfig extends ParsedFormatConfig
    ? true
    : ["FormatConfig has properties the schema does not define"]
  : ["schema output is missing properties required by FormatConfig"];
export const __schemaTypeCheck: AssertSchemaMatchesType = true;

export function parseFormatPatch(input: unknown): FormatPatch {
  return FormatPatchSchema.parse(input ?? {}) as unknown as FormatPatch;
}

export function safeParseFormatPatch(
  input: unknown,
): { ok: true; patch: FormatPatch } | { ok: false; issues: string[] } {
  const result = FormatPatchSchema.safeParse(input ?? {});
  if (result.success) return { ok: true, patch: result.data as unknown as FormatPatch };
  return {
    ok: false,
    issues: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
}

/**
 * Compact description of the patch shape handed to the LLM when it must
 * translate a natural-language format brief into a validated patch.
 */
export const FORMAT_PATCH_GUIDE = {
  page: { size: "A4|Letter", widthInches: "number", heightInches: "number", orientation: "portrait|landscape", columns: "1|2|3", columnSpacingInches: "number" },
  margins: { top: "inches", bottom: "inches", left: "inches", right: "inches", gutter: "inches" },
  typography: {
    fontFamily: "e.g. Times New Roman",
    bodyFontSize: "pt",
    titleFontSize: "pt",
    authorFontSize: "pt",
    abstractFontSize: "pt",
    lineSpacing: "1.0-3.0",
    paragraphSpacingBeforePt: "pt",
    paragraphSpacingAfterPt: "pt",
    firstLineIndentInches: "inches",
    justify: "boolean",
  },
  title: { fontSize: "pt", bold: "boolean", alignment: "left|center|right|justify", textCase: "title_case|sentence_case|upper|as_is", spacingAfterPt: "pt" },
  authors: { fontSize: "pt", alignment: "left|center|right|justify", includeAffiliations: "boolean", spacingAfterPt: "pt" },
  abstract: { headingText: "string", headingNumbered: "boolean", headingBold: "boolean", headingItalic: "boolean", bodyBold: "boolean", fontSize: "pt", justify: "boolean", maxWords: "int" },
  keywords: { headingText: "string", headingInSameParagraph: "boolean", headingItalic: "boolean", headingBold: "boolean", separator: "string", maxCount: "int", wordAfterColon: "boolean" },
  headings: {
    numberingEnabled: "boolean",
    level1: "HeadingStyle",
    level2: "HeadingStyle",
    level3: "HeadingStyle",
    _HeadingStyle: {
      fontSize: "pt",
      bold: "boolean",
      italic: "boolean",
      alignment: "left|center|right|justify",
      numbering: "none|arabic|arabic_dotted|roman_upper|roman_lower|alpha_upper|alpha_lower",
      numberSeparator: 'e.g. ". " or " "',
      numberingSuffix: 'e.g. "" or ")"',
      spacingBeforePt: "pt",
      spacingAfterPt: "pt",
      uppercase: "boolean",
      smallCaps: "boolean",
      pageBreakBefore: "boolean",
    },
  },
  references: { headingText: "string", headingNumbered: "boolean", fontSize: "pt", hangingIndentInches: "inches", sortOrder: "citation_order|alphabetical_author|year_desc", labelFormat: 'e.g. "[{n}]"', style: "IEEE|APA|Vancouver|Harvard|Chicago|MLA|Springer|ACM|Nature", pageBreakBefore: "boolean" },
  figures: { captionPosition: "above|below", labelFormat: 'e.g. "Fig. {n}."', fontSize: "pt", captionBold: "boolean", captionItalic: "boolean", centered: "boolean", maxWidthInches: "inches" },
  tables: { captionPosition: "above|below", labelFormat: 'e.g. "TABLE {n}"', fontSize: "pt", captionBold: "boolean", captionItalic: "boolean", centered: "boolean", borderStyle: "grid|booktabs|ieee|acm|apa|nature|none", headerBold: "boolean" },
  equations: { fontFamily: "string", fontSize: "pt", numbering: "none|parenthesized_right|right_aligned", numberLabelFormat: 'e.g. "({n})"', centered: "boolean" },
  pageNumbers: { enabled: "boolean", position: "header|footer", alignment: "left|center|right", format: 'e.g. "{n}"' },
  header: { enabled: "boolean", text: "string" },
  outline: { sections: "array of { key, title, level, kind, required, weight }" },
  citationStyle: "string",
  wordsPerPage: { singleColumn: "int", twoColumn: "int" },
} as const;
