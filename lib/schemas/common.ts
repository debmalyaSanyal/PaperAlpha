/**
 * Domain constants shared by schemas, prompts, the UI and the Python backend.
 * The same string literals appear in backend/app/constants.py - they are part
 * of the contract between the two services.
 */

export const CITATION_STYLES = [
  "IEEE",
  "APA",
  "Vancouver",
  "Harvard",
  "Chicago",
  "MLA",
  "Springer",
  "ACM",
  "Nature",
  "Custom",
] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];

/** Citation styles offered in the Create Project form (specification section 4). */
export const SELECTABLE_CITATION_STYLES = [
  "IEEE",
  "APA",
  "Vancouver",
  "Harvard",
  "Chicago",
  "MLA",
  "Custom",
] as const;

export const LANGUAGES = [
  "English",
  "Bengali",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Chinese",
  "Japanese",
] as const;

/**
 * Provenance labels. Every extracted statement carries one of these so the
 * paper never presents an inference as a measured result.
 */
export const EVIDENCE_KINDS = [
  "FACT",
  "INFERENCE",
  "USER_PROVIDED_CLAIM",
  "LLM_GENERATED_SUGGESTION",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Claim-verification outcomes (specification section 18). */
export const CLAIM_VERDICTS = [
  "SUPPORTED_BY_USER_DATA",
  "SUPPORTED_BY_SOURCE",
  "REASONABLE_INFERENCE",
  "UNSUPPORTED",
] as const;
export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number];

/** Explicit phrases required whenever evidence is missing (section 28). */
export const NOT_AVAILABLE = "Not available in supplied materials.";
export const NOT_REPORTED = "Not reported in the supplied experimental materials.";
export const SUGGESTED_EXPERIMENT_LABEL = "Suggested future experiment";

export const FILE_CATEGORIES = ["notebook", "python", "dataset", "document", "image", "other"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const EXTENSION_CATEGORY: Record<string, FileCategory> = {
  ".ipynb": "notebook",
  ".py": "python",
  ".csv": "dataset",
  ".xlsx": "dataset",
  ".xls": "dataset",
  ".json": "dataset",
  ".pdf": "document",
  ".docx": "document",
  ".txt": "document",
  ".md": "document",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
};

export function categorizeExtension(extension: string): FileCategory {
  return EXTENSION_CATEGORY[extension.toLowerCase()] ?? "other";
}

export const PROJECT_STATUSES = [
  "CREATED",
  "UPLOADING",
  "PARSING",
  "ANALYZING_CODE",
  "UNDERSTANDING_RESEARCH",
  "LITERATURE_REVIEW",
  "ANALYZING_RESULTS",
  "BUILDING_OUTLINE",
  "WRITING",
  "VERIFYING",
  "FORMATTING",
  "GENERATING_DOCX",
  "QUALITY_CHECK",
  "COMPLETED",
  "FAILED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const LITERATURE_PROVIDER_IDS = [
  "openalex",
  "crossref",
  "arxiv",
  "semantic_scholar",
  "pubmed",
] as const;
export type LiteratureProviderId = (typeof LITERATURE_PROVIDER_IDS)[number];

export const RESEARCH_INTEGRITY_NOTICE =
  "This tool generates research-paper drafts from user-provided materials and verified sources. Users are responsible for validating experimental results, citations, originality, authorship, and compliance with the target venue.";

export const HUMAN_REVIEW_WARNING =
  "Do not submit generated text without reviewing it. Verify that every experimental value, citation and architectural detail matches your own work.";
