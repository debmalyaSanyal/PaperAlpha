import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { stageProgress } from "@/lib/pipeline/stages";
import { JobQueueError, type ClaimedJob, type EnqueueJobInput, type JobProgressUpdate, type JobQueue } from "./types";

/**
 * Database-backed job queue.
 *
 * Requires no Redis, which keeps local development and small deployments to a
 * single process. Reservation uses a conditional update (`status: QUEUED`) so
 * concurrent workers cannot claim the same job: the update count acts as a
 * compare-and-swap.
 */
export class DbJobQueue implements JobQueue {
  readonly name = "db" as const;

  async enqueue(input: EnqueueJobInput): Promise<{ jobId: string }> {
    const env = getEnv();
    const job = await prisma.generationJob.create({
      data: {
        projectId: input.projectId,
        type: input.type ?? "full_pipeline",
        status: "QUEUED",
        stage: "CREATED",
        progress: 0,
        maxAttempts: input.maxAttempts ?? env.JOB_MAX_ATTEMPTS,
        payloadJson: input.payload ? JSON.stringify(input.payload) : null,
      },
    });
    return { jobId: job.id };
  }

  async claim(workerId: string): Promise<ClaimedJob | null> {
    const candidate = await prisma.generationJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) return null;

    const reserved = await prisma.generationJob.updateMany({
      where: { id: candidate.id, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 }, errorMessage: null },
    });
    if (reserved.count === 0) return null; // another worker won the race

    await this.log(candidate.id, candidate.projectId, "info", `Claimed by worker ${workerId}`, {
      stage: candidate.stage,
    });

    return {
      id: candidate.id,
      projectId: candidate.projectId,
      type: candidate.type,
      payload: safeParse(candidate.payloadJson),
      attempts: candidate.attempts + 1,
      maxAttempts: candidate.maxAttempts,
    };
  }

  async progress(jobId: string, update: JobProgressUpdate): Promise<void> {
    const progress = update.progress ?? (update.stage ? stageProgress(String(update.stage)) : undefined);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        ...(update.stage ? { stage: String(update.stage) } : {}),
        ...(progress !== undefined ? { progress } : {}),
      },
    });

    const job = await prisma.generationJob.findUnique({ where: { id: jobId }, select: { projectId: true } });
    if (job) {
      await prisma.project.update({
        where: { id: job.projectId },
        data: {
          ...(update.stage ? { status: String(update.stage) } : {}),
          ...(progress !== undefined ? { progress } : {}),
          statusDetail: update.message ?? null,
        },
      });
    }

    if (update.message) {
      await this.log(jobId, job?.projectId ?? null, "info", update.message, { stage: update.stage });
    }
  }

  async complete(jobId: string, result?: Record<string, unknown>): Promise<void> {
    const job = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        stage: "COMPLETED",
        progress: 100,
        finishedAt: new Date(),
        resultJson: result ? JSON.stringify(result) : null,
      },
    });
    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "COMPLETED", progress: 100, statusDetail: null, errorMessage: null },
    });
    await this.log(jobId, job.projectId, "info", "Pipeline completed");
  }

  async fail(jobId: string, error: string, retryable: boolean): Promise<void> {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new JobQueueError(`Job ${jobId} not found.`, "NOT_FOUND");

    const canRetry = retryable && job.attempts < job.maxAttempts;
    await prisma.generationJob.update({
      where: { id: jobId },
      data: canRetry
        ? { status: "QUEUED", errorMessage: error }
        : { status: "FAILED", finishedAt: new Date(), errorMessage: error },
    });

    if (!canRetry) {
      await prisma.project.update({
        where: { id: job.projectId },
        data: { status: "FAILED", errorMessage: error, statusDetail: null },
      });
    }

    await this.log(
      jobId,
      job.projectId,
      canRetry ? "warn" : "error",
      canRetry ? `Retrying after failure: ${error}` : `Failed: ${error}`,
      { stage: job.stage, attempt: job.attempts, maxAttempts: job.maxAttempts },
    );
  }

  async cancel(jobId: string): Promise<void> {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new JobQueueError(`Job ${jobId} not found.`, "NOT_FOUND");
    if (job.status === "SUCCEEDED" || job.status === "FAILED") return;

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
    await this.log(jobId, job.projectId, "warn", "Cancelled by user");
  }

  async depth(): Promise<number> {
    return prisma.generationJob.count({ where: { status: "QUEUED" } });
  }

  /**
   * Requeue jobs whose worker died mid-run. Called on worker start-up so a
   * crash does not leave a project stuck in RUNNING forever.
   */
  async recoverStalled(staleAfterMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - staleAfterMs);
    const stalled = await prisma.generationJob.findMany({
      where: { status: "RUNNING", startedAt: { lt: cutoff } },
      select: { id: true, projectId: true },
    });
    for (const job of stalled) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "QUEUED", errorMessage: "Requeued after worker interruption." },
      });
      await this.log(job.id, job.projectId, "warn", "Requeued after worker interruption");
    }
    return stalled.length;
  }

  /** Append an observability log line (specification section 39). */
  async log(
    jobId: string,
    projectId: string | null,
    level: "debug" | "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.jobLog.create({
      data: {
        jobId,
        projectId,
        level,
        message: message.slice(0, 2000),
        stage: typeof meta?.stage === "string" ? meta.stage : null,
        metaJson: meta ? JSON.stringify(meta) : null,
      },
    });
  }
}

function safeParse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
