import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { resolveProjectFormat } from "@/lib/formats/registry";
import { safeParseFormatPatch } from "@/lib/formats/schema";
import type { FormatPatch } from "@/lib/formats/types";
import type { PipelineFileRef, PipelineRequest } from "@/lib/backend/contract";
import { FULL_REBUILD_STAGES } from "./stages";

/**
 * Build the payload the Python worker executes.
 *
 * Only structured state travels: extracted artifacts are passed back on a
 * resume so the worker does not recompute stages that already succeeded
 * (specification sections 33 and 38).
 */
export async function buildPipelineRequest(
  projectId: string,
  options: {
    jobId: string;
    stages?: string[] | null;
    regenerate?: PipelineRequest["regenerate"];
  },
): Promise<PipelineRequest> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { researchInput: true, files: true, artifacts: true },
  });
  if (!project) throw new Error(`Project ${projectId} not found.`);

  const patch = resolveCustomPatch(project.customFormatPatch);
  const format = resolveProjectFormat(project.paperFormat, patch ?? undefined);

  const files: PipelineFileRef[] = project.files.map((file) => ({
    fileId: file.id,
    originalName: file.originalName,
    storageKey: file.storageKey,
    extension: file.extension,
    category: file.category,
    sizeBytes: file.sizeBytes,
    mimeType: file.mimeType,
  }));

  const resumeArtifacts = options.regenerate ? collectArtifacts(project.artifacts) : null;

  return {
    jobId: options.jobId,
    projectId: project.id,
    workspacePrefix: `projects/${project.id}`,
    language: project.language,
    research: {
      title: project.title,
      topic: project.topic,
      problem: project.problem,
      objectives: project.objectives ?? project.researchInput?.objectives ?? null,
      questions: project.questions ?? project.researchInput?.questions ?? null,
      notes: project.notes ?? project.researchInput?.notes ?? null,
      additionalInstructions: project.additionalInstructions ?? null,
      targetPages: project.targetPages,
      targetWords: project.targetWords,
    },
    format: {
      name: project.paperFormat,
      config: format as unknown as Record<string, unknown>,
      citationStyle: project.citationStyle,
      customDescription: project.customFormat,
    },
    files,
    stages: options.stages ?? [...FULL_REBUILD_STAGES],
    regenerate: options.regenerate ?? null,
    resumeArtifacts,
  };
}

function collectArtifacts(
  rows: Array<{ stage: string; key: string; payload: string }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const bucket = (out[row.stage] ??= {}) as Record<string, unknown>;
    try {
      bucket[row.key] = JSON.parse(row.payload);
    } catch {
      bucket[row.key] = row.payload;
    }
  }
  return out;
}

/**
 * The custom-format patch is stored as text on the project row. Older rows may
 * contain only a natural-language description, in which case no patch is
 * returned and the LLM formatting agent derives one.
 */
function resolveCustomPatch(raw: string | null | undefined): FormatPatch | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  const parsed = safeParseFormatPatch(JSON.parse(trimmed) as unknown);
  return parsed.ok ? parsed.patch : null;
}

export function workspacePrefix(projectId: string): string {
  return `projects/${projectId}`;
}

/** Root directory for local-storage mode, passed to the worker for diagnostics. */
export function storageRootHint(): string {
  return getEnv().STORAGE_LOCAL_ROOT;
}
