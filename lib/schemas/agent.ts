import { z } from "zod";

import {
  CLAIM_VERDICTS,
  EVIDENCE_KINDS,
  LITERATURE_PROVIDER_IDS,
  NOT_AVAILABLE,
} from "./common";

/**
 * Schemas for every structured payload exchanged between agents.
 *
 * These are the contract for LLM structured output (validated with retry, see
 * lib/llm/structured.ts) and between the TypeScript control plane and the
 * Python worker. The Python side mirrors them in backend/app/schemas.py.
 */

/** Where a statement came from. */
export const EvidenceRefSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  /** Human-readable provenance, e.g. "notebook:model.ipynb cell 14". */
  source: z.string().min(1).max(300),
  /** Verbatim or near-verbatim supporting text. */
  quote: z.string().max(1200).optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const FieldWithEvidenceSchema = z.object({
  value: z.string().max(4000),
  evidence: z.array(EvidenceRefSchema).default([]),
});

/** Research Understanding Agent output (specification section 8). */
export const ResearchUnderstandingSchema = z.object({
  research_problem: z.string().min(1).max(4000),
  research_domain: z.string().min(1).max(300),
  research_gap: z.string().max(4000),
  proposed_solution: z.string().max(6000),
  methodology: z.string().max(8000),
  dataset: z.string().max(4000),
  experiments: z
    .array(
      z.object({
        name: z.string().min(1).max(300),
        description: z.string().max(2000),
        evidence: z.array(EvidenceRefSchema).default([]),
      }),
    )
    .default([]),
  main_findings: z.array(FieldWithEvidenceSchema).default([]),
  limitations: z.array(z.string().max(1000)).default([]),
  potential_contributions: z.array(FieldWithEvidenceSchema).default([]),
  keywords: z.array(z.string().max(60)).max(12).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  missing_information: z.array(z.string().max(500)).default([]),
});
export type ResearchUnderstanding = z.infer<typeof ResearchUnderstandingSchema>;

/** Code Analysis Agent output (specification section 7). */
export const CodeAnalysisSchema = z.object({
  language: z.string().max(60).default(NOT_AVAILABLE),
  frameworks: z.array(z.string().max(80)).default([]),
  libraries: z.array(z.string().max(80)).default([]),
  datasets: z.array(z.string().max(200)).default([]),
  preprocessing: z.string().max(4000).default(NOT_AVAILABLE),
  feature_engineering: z.string().max(4000).default(NOT_AVAILABLE),
  model_architecture: z.string().max(6000).default(NOT_AVAILABLE),
  layers: z
    .array(
      z.object({
        name: z.string().max(120),
        type: z.string().max(120),
        output_shape: z.string().max(120).optional(),
        parameters: z.number().int().nullable().optional(),
        activation: z.string().max(80).optional(),
        notes: z.string().max(400).optional(),
        evidence: z.array(EvidenceRefSchema).default([]),
      }),
    )
    .default([]),
  loss_function: z.string().max(300).default(NOT_AVAILABLE),
  optimizer: z.string().max(300).default(NOT_AVAILABLE),
  learning_rate: z.string().max(120).default(NOT_AVAILABLE),
  batch_size: z.string().max(120).default(NOT_AVAILABLE),
  epochs: z.string().max(120).default(NOT_AVAILABLE),
  data_split: z.string().max(300).default(NOT_AVAILABLE),
  augmentation: z.string().max(2000).default(NOT_AVAILABLE),
  regularization: z.string().max(2000).default(NOT_AVAILABLE),
  metrics: z.array(z.string().max(80)).default([]),
  baselines: z.array(z.string().max(200)).default([]),
  hyperparameters: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  random_seeds: z.string().max(200).default(NOT_AVAILABLE),
  hardware: z.string().max(400).default(NOT_AVAILABLE),
  training_procedure: z.string().max(6000).default(NOT_AVAILABLE),
  entry_points: z.array(z.string().max(200)).default([]),
  /** Fields the agent could not determine from the supplied material. */
  unavailable_fields: z.array(z.string().max(120)).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});
export type CodeAnalysisPayload = z.infer<typeof CodeAnalysisSchema>;

/** Literature source metadata (specification section 9). */
export const LiteratureSourceSchema = z.object({
  citation_key: z.string().regex(/^REF\d{3,4}$/, "Citation keys look like REF001."),
  title: z.string().min(1).max(600),
  authors: z.array(z.string().max(200)).default([]),
  year: z.number().int().min(1600).max(2200).nullable().default(null),
  venue: z.string().max(300).nullable().default(null),
  doi: z.string().max(200).nullable().default(null),
  url: z.string().max(600).nullable().default(null),
  abstract: z.string().max(6000).nullable().default(null),
  source: z.enum([...LITERATURE_PROVIDER_IDS, "user"]),
  source_id: z.string().max(200).nullable().default(null),
  relevance: z.string().max(1000).nullable().default(null),
  key_method: z.string().max(1000).nullable().default(null),
  key_result: z.string().max(1000).nullable().default(null),
  limitation: z.string().max(1000).nullable().default(null),
  used_dataset: z.string().max(300).nullable().default(null),
  used_metric: z.string().max(200).nullable().default(null),
  theme: z.string().max(120).nullable().default(null),
  is_foundational: z.boolean().default(false),
  verified: z.boolean().default(false),
  verification_note: z.string().max(500).nullable().default(null),
});
export type LiteratureSourcePayload = z.infer<typeof LiteratureSourceSchema>;

export const LiteratureThemeSchema = z.object({
  theme: z.string().min(1).max(120),
  summary: z.string().max(4000),
  source_keys: z.array(z.string().regex(/^REF\d{3,4}$/)).default([]),
});

export const LiteratureMatrixRowSchema = z.object({
  citation_key: z.string().regex(/^REF\d{3,4}$/),
  method: z.string().max(400).nullable().default(null),
  dataset: z.string().max(300).nullable().default(null),
  metric: z.string().max(200).nullable().default(null),
  result: z.string().max(300).nullable().default(null),
  limitation: z.string().max(400).nullable().default(null),
});

/** Literature synthesis output - thematic, never a list of disconnected summaries (section 10). */
export const LiteratureReviewSchema = z.object({
  themes: z.array(LiteratureThemeSchema).default([]),
  synthesis: z.string().max(20000),
  research_gap: z.string().max(4000),
  matrix: z.array(LiteratureMatrixRowSchema).default([]),
  /** Providers actually queried, with result counts, for observability. */
  query_log: z
    .array(
      z.object({
        provider: z.string().max(60),
        query: z.string().max(300),
        results: z.number().int().min(0),
        from_cache: z.boolean().default(false),
      }),
    )
    .default([]),
});
export type LiteratureReviewPayload = z.infer<typeof LiteratureReviewSchema>;

/** Experiment / result extraction (specification section 13). */
export const ExperimentResultSchema = z.object({
  metric_name: z.string().min(1).max(80),
  metric_value: z.number().nullable().default(null),
  metric_text: z.string().max(120).nullable().default(null),
  split: z.enum(["train", "val", "test", "cv", "unspecified"]).default("unspecified"),
  std_dev: z.number().nullable().default(null),
  n: z.number().int().nullable().default(null),
  is_available: z.boolean().default(true),
  evidence: z.string().max(300).nullable().default(null),
});

export const ExperimentSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(2000).default(""),
  kind: z.enum(["main", "ablation", "baseline", "hyperparameter_search"]).default("main"),
  configuration: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  is_suggested: z.boolean().default(false),
  evidence: z.array(z.string().max(300)).default([]),
  results: z.array(ExperimentResultSchema).default([]),
});
export type ExperimentPayload = z.infer<typeof ExperimentSchema>;

/** Paper Outline Agent output (specification section 15). */
export const OutlineSchema = z.object({
  title: z.string().min(5).max(300),
  sections: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        title: z.string().min(1).max(200),
        level: z.number().int().min(1).max(3).default(1),
        kind: z.enum(["abstract", "keywords", "body", "references", "appendix"]).default("body"),
        required: z.boolean().default(true),
        target_words: z.number().int().min(0).max(20000).default(0),
        /** Hints handed to the writing agent for this section. */
        writing_notes: z.string().max(1200).default(""),
      }),
    )
    .min(3),
  keywords: z.array(z.string().max(60)).max(12).default([]),
  notes: z.string().max(2000).default(""),
});
export type OutlinePayload = z.infer<typeof OutlineSchema>;

/** A single written section. */
export const SectionDraftSchema = z.object({
  key: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  /** Markdown body; equations as $...$ / $$...$$, citations as [REF001]. */
  content: z.string().min(1).max(60000),
  citations_used: z.array(z.string().regex(/^REF\d{3,4}$/)).default([]),
  figure_refs: z.array(z.number().int().positive()).default([]),
  table_refs: z.array(z.number().int().positive()).default([]),
  word_count: z.number().int().min(0).default(0),
  /** Self-reported list of statements that need evidence. */
  claims: z
    .array(
      z.object({
        text: z.string().max(1000),
        verdict: z.enum(CLAIM_VERDICTS).default("UNSUPPORTED"),
        basis: z.string().max(600).default(""),
      }),
    )
    .default([]),
});
export type SectionDraftPayload = z.infer<typeof SectionDraftSchema>;

/** Claim Verification Agent output (specification section 18). */
export const ClaimVerificationSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().max(1200),
        section_key: z.string().max(64),
        verdict: z.enum(CLAIM_VERDICTS),
        basis: z.string().max(800).default(""),
        action: z.enum(["keep", "weaken", "remove", "mark_as_hypothesis"]).default("keep"),
      }),
    )
    .default([]),
  summary: z.object({
    total: z.number().int().min(0).default(0),
    supported_by_user_data: z.number().int().min(0).default(0),
    supported_by_source: z.number().int().min(0).default(0),
    reasonable_inference: z.number().int().min(0).default(0),
    unsupported: z.number().int().min(0).default(0),
  }),
});
export type ClaimVerificationPayload = z.infer<typeof ClaimVerificationSchema>;

/** Reference / citation validation report (specification section 20). */
export const CitationValidationSchema = z.object({
  unresolved: z
    .array(
      z.object({
        citation_key: z.string().max(20),
        issue: z.enum([
          "missing_title",
          "missing_authors",
          "missing_year",
          "missing_source",
          "invalid_doi",
          "invalid_url",
          "not_cited",
          "no_source_record",
        ]),
        detail: z.string().max(400).default(""),
      }),
    )
    .default([]),
  cited_but_unlisted: z.array(z.string().max(20)).default([]),
  listed_but_uncited: z.array(z.string().max(20)).default([]),
  verified_count: z.number().int().min(0).default(0),
  total_count: z.number().int().min(0).default(0),
});
export type CitationValidationPayload = z.infer<typeof CitationValidationSchema>;

/** Quality Control Agent output (specification section 27). */
export const QualityReportSchema = z.object({
  quality_score: z.object({
    overall: z.number().min(0).max(100),
    technical_consistency: z.number().min(0).max(100),
    citation_integrity: z.number().min(0).max(100),
    formatting_consistency: z.number().min(0).max(100),
    academic_quality: z.number().min(0).max(100),
    length_target: z.number().min(0).max(100),
  }),
  issues: z.array(z.string().max(600)).default([]),
  warnings: z.array(z.string().max(600)).default([]),
  citation_issues: z.array(z.string().max(600)).default([]),
  technical_issues: z.array(z.string().max(600)).default([]),
  formatting_issues: z.array(z.string().max(600)).default([]),
  page_estimate: z.number().min(0).max(60).nullable().default(null),
  word_count: z.number().int().min(0).default(0),
  verdict: z.enum(["pass", "pass_with_warnings", "fail"]).default("pass_with_warnings"),
  disclaimer: z.string().max(600).default(""),
});
export type QualityReportPayload = z.infer<typeof QualityReportSchema>;