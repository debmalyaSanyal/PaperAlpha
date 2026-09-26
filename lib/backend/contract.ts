/**
 * Contract between the Next.js control plane and the Python AI/DOCX worker.
 *
 * Mirrored by backend/app/contract.py. Both sides validate with their own
 * schema library before trusting a payload.
 */

export interface PipelineFileRef {
  fileId: string;
  originalName: string;
  storageKey: string;
  extension: string;
  category: string;
  sizeBytes: number;
  mimeType: string;
}

export interface PipelineFormatSpec {
  name: string;
  /** Fully resolved format configuration produced by lib/formats/registry. */
  config: Record<string, unknown>;
  citationStyle: string;
  /** Natural-language brief when the user selected "Custom". */
  customDescription?: string | null;
}

export interface PipelineRequest {
  jobId: string;
  projectId: string;
  /** Directory/prefix the worker may write to, i.e. `projects/<id>`. */
  workspacePrefix: string;
  language: string;
  research: {
    title: string;
    topic: string;
    problem: string;
    objectives?: string | null;
    questions?: string | null;
    notes?: string | null;
    additionalInstructions?: string | null;
    targetPages: number;
    targetWords?: number | null;
  };
  format: PipelineFormatSpec;
  files: PipelineFileRef[];
  /** Stages to execute; the worker skips the rest (used by resume/regenerate). */
  stages?: string[] | null;
  /** Present when regenerating a single section. */
  regenerate?: {
    sectionKey: string;
    instructions?: string | null;
    targetWords?: number | null;
  } | null;
  /** Prior artifacts so a resumed run does not recompute stable stages. */
  resumeArtifacts?: Record<string, unknown> | null;
}

export interface SectionResult {
  key: string;
  title: string;
  level: number;
  orderIndex: number;
  numberLabel?: string | null;
  content: string;
  wordCount: number;
  targetWords?: number | null;
  citationsUsed: string[];
  claims: Array<{ text: string; verdict: string; basis: string }>;
  isUserEdited?: boolean;
}

export interface CitationResult {
  citationKey: string;
  raw: string;
  style: string;
  orderIndex: number;
  inTextCount: number;
  isOrphanReference: boolean;
  isMissingSource: boolean;
  source?: {
    title: string;
    authors: string[];
    year: number | null;
    venue: string | null;
    doi: string | null;
    url: string | null;
    abstract: string | null;
    source: string;
    sourceId: string | null;
    relevance: string | null;
    keyMethod: string | null;
    keyResult: string | null;
    limitation: string | null;
    usedDataset: string | null;
    usedMetric: string | null;
    theme: string | null;
    isFoundational: boolean;
    verified: boolean;
    verificationNote: string | null;
  } | null;
}

export interface FigureResult {
  number: number;
  label: string;
  caption: string;
  storageKey: string | null;
  source: string;
  widthInches: number | null;
}

export interface TableResult {
  number: number;
  label: string;
  caption: string;
  headers: string[];
  rows: string[][];
  source: string;
  isSuggested: boolean;
  notes?: string | null;
}

export interface QualityReportResult {
  qualityScore: Record<string, number>;
  issues: string[];
  warnings: string[];
  citationIssues: string[];
  technicalIssues: string[];
  formattingIssues: string[];
  pageEstimate: number | null;
  wordCount: number;
  verdict: string;
  disclaimer: string;
}

export interface DocumentResult {
  storageKey: string;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  wordCount: number;
  isFinal: boolean;
  meta: Record<string, unknown>;
}

export interface PipelineResult {
  jobId: string;
  projectId: string;
  status: "COMPLETED" | "FAILED";
  title: string;
  abstract: string;
  keywords: string[];
  /** Structured per-stage artifacts, persisted to the Artifact table. */
  artifacts: Record<string, unknown>;
  sections: SectionResult[];
  citations: CitationResult[];
  figures: FigureResult[];
  tables: TableResult[];
  outline: { formatName: string; sections: Array<Record<string, unknown>>; wordBudget: unknown; notes: string } | null;
  codeAnalysis: Record<string, unknown> | null;
  datasetAnalyses: Array<Record<string, unknown>>;
  experiments: Array<Record<string, unknown>>;
  literatureReview: Record<string, unknown> | null;
  qualityReport: QualityReportResult | null;
  documents: DocumentResult[];
  researchUnderstanding: Record<string, unknown> | null;
  claimVerification: Record<string, unknown> | null;
  citationValidation: Record<string, unknown> | null;
  llmUsage: { provider: string; model: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number };
  warnings: string[];
  error?: string | null;
}

export interface PipelineStatus {
  jobId: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  stage: string;
  progress: number;
  message: string | null;
  updatedAt: string;
  logs?: Array<{ level: string; stage?: string | null; agent?: string | null; message: string; createdAt: string }>;
}

export function backendHeaders(sharedSecret: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Worker-Secret": sharedSecret,
  };
}
