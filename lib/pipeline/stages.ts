/**
 * Canonical pipeline definition.
 *
 * Single source of truth for the project lifecycle shared by the UI progress
 * timeline, the control-plane API, the queue worker and the Python agent
 * orchestrator. The Python backend mirrors these keys in
 * backend/app/pipeline.py; a test asserts both lists stay identical.
 */

export const PIPELINE_STAGES = [
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
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type StageState = "pending" | "active" | "complete" | "failed" | "skipped";

export interface StageDefinition {
  key: PipelineStage;
  label: string;
  description: string;
  /** Share of total progress attributed to this stage. */
  weight: number;
  agents: string[];
  /** True when a failure may be retried without restarting the pipeline. */
  resumable: boolean;
}

export const STAGE_DEFINITIONS: readonly StageDefinition[] = [
  {
    key: "CREATED",
    label: "Project created",
    description: "Research metadata and paper configuration recorded.",
    weight: 1,
    agents: [],
    resumable: true,
  },
  {
    key: "UPLOADING",
    label: "Uploading research material",
    description: "Notebooks, source files, datasets, documents and figures are validated and stored.",
    weight: 4,
    agents: ["ingestion"],
    resumable: true,
  },
  {
    key: "PARSING",
    label: "Parsing files",
    description: "Notebook cells, Python AST, CSV/XLSX tables, PDF/DOCX text and image metadata extracted.",
    weight: 8,
    agents: ["ingestion"],
    resumable: true,
  },
  {
    key: "ANALYZING_CODE",
    label: "Analyzing code",
    description: "Architecture, hyperparameters, training procedure, metrics and baselines identified from the supplied implementation.",
    weight: 12,
    agents: ["code_analysis"],
    resumable: true,
  },
  {
    key: "UNDERSTANDING_RESEARCH",
    label: "Understanding the research",
    description: "Problem, gap, proposed solution, dataset, findings and limitations structured with evidence labels.",
    weight: 10,
    agents: ["research_analysis"],
    resumable: true,
  },
  {
    key: "LITERATURE_REVIEW",
    label: "Reviewing literature",
    description: "Scholarly sources retrieved from open APIs, verified and synthesised thematically.",
    weight: 14,
    agents: ["literature_search", "literature_synthesis"],
    resumable: true,
  },
  {
    key: "ANALYZING_RESULTS",
    label: "Analyzing experiments",
    description: "Metric values, comparisons and ablation configurations extracted from notebooks, CSVs and reports.",
    weight: 12,
    agents: ["results_analysis"],
    resumable: true,
  },
  {
    key: "BUILDING_OUTLINE",
    label: "Building the outline",
    description: "Format-specific section structure and word budget derived from the target page count.",
    weight: 5,
    agents: ["outline"],
    resumable: true,
  },
  {
    key: "WRITING",
    label: "Writing sections",
    description: "Abstract, introduction, related work, methodology, results, discussion and conclusion drafted section by section.",
    weight: 20,
    agents: ["writing"],
    resumable: true,
  },
  {
    key: "VERIFYING",
    label: "Verifying claims and citations",
    description: "Claims classified as user-data supported, source supported, reasonable inference or unsupported; references validated.",
    weight: 6,
    agents: ["claim_verification", "citation_verification"],
    resumable: true,
  },
  {
    key: "FORMATTING",
    label: "Applying format",
    description: "Venue formatting rules, heading numbering, figure/table captions and citation rendering applied.",
    weight: 3,
    agents: ["formatting"],
    resumable: true,
  },
  {
    key: "GENERATING_DOCX",
    label: "Generating DOCX",
    description: "Word document produced with styles, columns, captions, tables, figures and reference list.",
    weight: 4,
    agents: ["docx"],
    resumable: true,
  },
  {
    key: "QUALITY_CHECK",
    label: "Quality control",
    description: "Technical, citation, formatting and length checks plus a revision pass when the page target is missed.",
    weight: 3,
    agents: ["quality_control"],
    resumable: true,
  },
  {
    key: "COMPLETED",
    label: "Completed",
    description: "Draft ready for human review and download.",
    weight: 1,
    agents: [],
    resumable: false,
  },
];

export const STAGE_LABELS: Record<PipelineStage, string> = STAGE_DEFINITIONS.reduce(
  (acc, stage) => {
    acc[stage.key] = stage.label;
    return acc;
  },
  {} as Record<PipelineStage, string>,
);

export const TOTAL_STAGE_WEIGHT = STAGE_DEFINITIONS.reduce((acc, s) => acc + s.weight, 0);

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: string): number {
  return (PIPELINE_STAGES as readonly string[]).indexOf(stage as PipelineStage);
}

/** Progress percentage for a stage, accounting for fractional intra-stage progress. */
export function stageProgress(stage: string, fraction = 0): number {
  const index = stageIndex(stage);
  if (index < 0) return 0;
  const completed = STAGE_DEFINITIONS.slice(0, index).reduce((acc, s) => acc + s.weight, 0);
  const current = STAGE_DEFINITIONS[index].weight * Math.min(1, Math.max(0, fraction));
  return Math.min(100, Math.round(((completed + current) / TOTAL_STAGE_WEIGHT) * 100));
}

export interface StageView {
  key: PipelineStage;
  label: string;
  description: string;
  agents: string[];
  state: StageState;
  progress: number;
}

/** Build the per-stage view model used by the progress timeline component. */
export function buildStageTimeline(currentStage: string, failed = false): StageView[] {
  const currentIndex = stageIndex(currentStage);
  return STAGE_DEFINITIONS.map((stage, index) => {
    let state: StageState = "pending";
    if (currentIndex < 0) {
      state = index === 0 ? "active" : "pending";
    } else if (index < currentIndex) {
      state = "complete";
    } else if (index === currentIndex) {
      state = failed ? "failed" : currentStage === "COMPLETED" ? "complete" : "active";
    }

    return {
      key: stage.key,
      label: stage.label,
      description: stage.description,
      agents: [...stage.agents],
      state,
      progress: state === "complete" ? 100 : state === "active" ? 50 : 0,
    };
  });
}

/** The next stage in the pipeline, or null when finished. */
export function nextStage(stage: string): PipelineStage | null {
  const index = stageIndex(stage);
  if (index < 0 || index >= PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[index + 1];
}

/**
 * Stages re-run for a single-section regeneration: everything downstream of
 * writing, so the DOCX and quality report stay consistent.
 */
export const SECTION_REGENERATION_STAGES: readonly PipelineStage[] = [
  "VERIFYING",
  "FORMATTING",
  "GENERATING_DOCX",
  "QUALITY_CHECK",
];

/** Stages that must be re-run when the research input changes. */
export const FULL_REBUILD_STAGES: readonly PipelineStage[] = [
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
];

