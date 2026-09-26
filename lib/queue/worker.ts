import { getBackendClient, BackendError } from "@/lib/backend/client";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { persistPipelineResult } from "@/lib/pipeline/persist";
import { buildPipelineRequest } from "@/lib/pipeline/request-builder";
import { getDbQueue, getQueue } from "./index";
import type { ClaimedJob } from "./types";

/**
 * Pipeline worker.
 *
 * The worker owns no AI logic: it claims a job, hands the structured request to
 * the Python agent service, mirrors the service's progress into the database so
 * the UI timeline advances, and persists the final structured result.
 * Everything needed to resume lives in the database.
 */

const POLL_INTERVAL_MS_DEFAULT = 1500;

export interface WorkerOptions {
  workerId?: string;
  /** Poll interval while waiting for pipeline status updates. */
  pollIntervalMs?: number;
  onLog?: (line: string) => void;
}

export function generateWorkerId(): string {
  return `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

type RegeneratePayload = NonNullable<Parameters<typeof buildPipelineRequest>[1]["regenerate"]>;

/** Process a single claimed job to completion. */
export async function processJob(job: ClaimedJob, options: WorkerOptions = {}): Promise<void> {
  const queue = getQueue();
  const backend = getBackendClient();
  const log = options.onLog ?? (() => {});
  const pollInterval = options.pollIntervalMs ?? POLL_INTERVAL_MS_DEFAULT;

  log(`Job ${job.id} (project ${job.projectId}) starting.`);
  await queue.progress(job.id, {
    stage: "UPLOADING",
    message: "Preparing research material for the agent pipeline.",
  });

  const stages = Array.isArray(job.payload.stages) ? (job.payload.stages as string[]) : null;
  const regenerate =
    job.payload.regenerate && typeof job.payload.regenerate === "object"
      ? (job.payload.regenerate as RegeneratePayload)
      : null;

  const request = await buildPipelineRequest(job.projectId, { jobId: job.id, stages, regenerate });
  await backend.startPipeline(request);
  log(`Pipeline accepted by the worker service for job ${job.id}.`);

  const deadline = Date.now() + getEnv().BACKEND_REQUEST_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) {
      throw new Error(`Pipeline ${job.id} exceeded BACKEND_REQUEST_TIMEOUT_MS.`);
    }

    const current = await prisma.generationJob.findUnique({ where: { id: job.id }, select: { status: true } });
    if (current?.status === "CANCELLED") {
      await backend.cancelPipeline(job.id);
      log(`Job ${job.id} cancelled; asked the worker service to stop.`);
      return;
    }

    const status = await backend.getStatus(job.id);
    await queue.progress(job.id, {
      stage: status.stage,
      progress: status.progress,
      message: status.message ?? undefined,
    });

    if (status.status === "SUCCEEDED" || status.status === "FAILED" || status.status === "CANCELLED") {
      const result = await backend.waitForCompletion(job.id, pollInterval);
      if (result.status === "FAILED") {
        await queue.fail(job.id, result.error ?? "Pipeline reported FAILED without a message.", true);
        log(`Job ${job.id} failed: ${result.error ?? "unknown error"}`);
        return;
      }

      const persisted = await persistPipelineResult(job.projectId, result, { jobId: job.id });
      await queue.complete(job.id, {
        version: persisted.version,
        pageEstimate: persisted.pageEstimate,
        warnings: result.warnings ?? [],
        llmUsage: result.llmUsage,
      });
      await prisma.project.update({
        where: { id: job.projectId },
        data: {
          statusDetail:
            result.warnings && result.warnings.length > 0
              ? `${result.warnings.length} warning(s) reported during generation.`
              : "Draft generated. Review the validation checklist before downloading.",
        },
      });
      log(`Job ${job.id} completed (paper version ${persisted.version}).`);
      return;
    }

    await sleep(pollInterval);
  }
}

/** Claim and process one queued job. Returns false when the queue was empty. */
export async function runOnce(options: WorkerOptions = {}): Promise<boolean> {
  const queue = getQueue();
  const workerId = options.workerId ?? generateWorkerId();
  const job = await queue.claim(workerId);
  if (!job) return false;

  try {
    await processJob(job, options);
  } catch (error) {
    const retryable = error instanceof BackendError ? error.retryable : true;
    const message = error instanceof Error ? error.message : String(error);
    await queue.fail(job.id, message, retryable);
    (options.onLog ?? (() => {}))(`Job ${job.id} failed: ${message}`);
  }
  return true;
}

/**
 * Run a job that has already been enqueued, in the current process.
 *
 * Used by the API routes so a single-process deployment (local development,
 * small self-hosted installs) does not need a second Node process. Production
 * deployments should run `npm run worker:dev` (or the compiled equivalent).
 */
export async function processJobById(jobId: string, options: WorkerOptions = {}): Promise<void> {
  const queue = getDbQueue();
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job ${jobId} not found.`);

  const reserved = await prisma.generationJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (reserved.count === 0) return; // another worker already took it

  const claimed: ClaimedJob = {
    id: job.id,
    projectId: job.projectId,
    type: job.type,
    payload: job.payloadJson ? (JSON.parse(job.payloadJson) as Record<string, unknown>) : {},
    attempts: job.attempts + 1,
    maxAttempts: job.maxAttempts,
  };

  try {
    await processJob(claimed, options);
  } catch (error) {
    const retryable = error instanceof BackendError ? error.retryable : true;
    await queue.fail(jobId, error instanceof Error ? error.message : String(error), retryable);
    throw error;
  }
}

let loopStarted = false;

/**
 * Start the background polling loop once per process (local development).
 */
export function ensureWorkerLoop(options: WorkerOptions = {}): void {
  if (loopStarted) return;
  loopStarted = true;
  const interval = getEnv().QUEUE_POLL_INTERVAL_MS;
  const workerId = options.workerId ?? generateWorkerId();
  const log = options.onLog ?? (() => {});

  void (async () => {
    const queue = getDbQueue();
    await queue.recoverStalled(getEnv().JOB_STAGE_TIMEOUT_MS * 3).catch(() => 0);
    for (;;) {
      try {
        const worked = await runOnce({ ...options, workerId });
        if (!worked) await sleep(interval);
      } catch (error) {
        log(`Worker loop error: ${(error as Error).message}`);
        await sleep(interval * 2);
      }
    }
  })();
}

/** Test helper. */
export function resetWorkerLoopState(): void {
  loopStarted = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
