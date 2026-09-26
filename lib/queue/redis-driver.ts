import path from "node:path";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { stageProgress } from "@/lib/pipeline/stages";
import {
  JobQueueError,
  type ClaimedJob,
  type EnqueueJobInput,
  type JobProgressUpdate,
  type JobQueue,
} from "./types";

/**
 * Redis queue driver.
 *
 * Uses a reliable-queue pattern over Redis lists:
 *   <queue>:wait    ready job ids
 *   <queue>:active  job ids currently reserved by a worker
 *
 * Job metadata stays in the database (`generation_jobs`), so Redis carries only
 * the scheduling signal and switching drivers never loses state.
 *
 * NOTE: provided for horizontal scaling; the automated test-suite exercises the
 * database driver only. Requires the optional `ioredis` dependency.
 */
export interface RedisQueueOptions {
  url: string;
  queueName: string;
  pollIntervalMs: number;
}

interface RedisLike {
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  lrem(key: string, count: number, value: string): Promise<number>;
  llen(key: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  quit(): Promise<unknown>;
}

export class RedisJobQueue implements JobQueue {
  readonly name = "redis" as const;
  private client: RedisLike | null = null;
  private readonly waitKey: string;
  private readonly activeKey: string;

  constructor(private readonly options: RedisQueueOptions) {
    if (!options.url) {
      throw new JobQueueError("QUEUE_DRIVER=redis requires REDIS_URL.", "UNAVAILABLE");
    }
    this.waitKey = `${options.queueName}:wait`;
    this.activeKey = `${options.queueName}:active`;
  }

  private async redis(): Promise<RedisLike> {
    if (this.client) return this.client;
    try {
      // `ioredis` is an optional peer: loaded lazily so the default database
      // driver never statically imports it (fixes the Netlify/Next build
      // "Module not found: Can't resolve 'ioredis'" warning) and the
      // dependency stays genuinely optional for local development.
      const mod = (await new Function("u", "return import(u)")("ioredis")) as unknown as {
        default?: new (url: string) => RedisLike;
      } & { [k: string]: unknown };
      const factory = (mod?.default ?? mod) as unknown as new (url: string) => RedisLike;
      this.client = new factory(this.options.url);
      return this.client;
    } catch {
      throw new JobQueueError(
        "The redis queue driver requires 'ioredis'. Install it with: npm install ioredis",
        "UNAVAILABLE",
      );
    }
  }

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
    await (await this.redis()).lpush(this.waitKey, job.id);
    return { jobId: job.id };
  }

  async claim(workerId: string): Promise<ClaimedJob | null> {
    const redis = await this.redis();
    const jobId = await redis.rpop(this.waitKey);
    if (!jobId) return null;

    const reserved = await prisma.generationJob.updateMany({
      where: { id: jobId, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 }, errorMessage: null },
    });
    if (reserved.count === 0) return null;

    await redis.lpush(this.activeKey, jobId);
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) return null;

    await prisma.jobLog.create({
      data: {
        jobId,
        projectId: job.projectId,
        level: "info",
        message: `Claimed by worker ${workerId} via redis driver`,
        stage: job.stage,
      },
    });

    return {
      id: job.id,
      projectId: job.projectId,
      type: job.type,
      payload: parsePayload(job.payloadJson),
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    };
  }

  async progress(jobId: string, update: JobProgressUpdate): Promise<void> {
    const progress = update.progress ?? (update.stage ? stageProgress(String(update.stage)) : undefined);
    const job = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        ...(update.stage ? { stage: String(update.stage) } : {}),
        ...(progress !== undefined ? { progress } : {}),
      },
    });
    await prisma.project.update({
      where: { id: job.projectId },
      data: {
        ...(update.stage ? { status: String(update.stage) } : {}),
        ...(progress !== undefined ? { progress } : {}),
        statusDetail: update.message ?? null,
      },
    });
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
    await (await this.redis()).lrem(this.activeKey, 0, jobId);
  }

  async fail(jobId: string, error: string, retryable: boolean): Promise<void> {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new JobQueueError(`Job ${jobId} not found.`, "NOT_FOUND");

    const redis = await this.redis();
    await redis.lrem(this.activeKey, 0, jobId);

    const canRetry = retryable && job.attempts < job.maxAttempts;
    await prisma.generationJob.update({
      where: { id: jobId },
      data: canRetry
        ? { status: "QUEUED", errorMessage: error }
        : { status: "FAILED", finishedAt: new Date(), errorMessage: error },
    });
    if (canRetry) {
      await redis.lpush(this.waitKey, jobId);
    } else {
      await prisma.project.update({
        where: { id: job.projectId },
        data: { status: "FAILED", errorMessage: error, statusDetail: null },
      });
    }
  }

  async cancel(jobId: string): Promise<void> {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new JobQueueError(`Job ${jobId} not found.`, "NOT_FOUND");
    const redis = await this.redis();
    await redis.lrem(this.waitKey, 0, jobId);
    await redis.lrem(this.activeKey, 0, jobId);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
  }

  async depth(): Promise<number> {
    return (await this.redis()).llen(this.waitKey);
  }

  /** Job ids currently reserved by workers; used by the health endpoint. */
  async active(): Promise<string[]> {
    return (await this.redis()).lrange(this.activeKey, 0, -1);
  }

  async close(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }
}

function parsePayload(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
