import type { PipelineStage } from "@/lib/pipeline/stages";

/**
 * Job queue abstraction (specification section 32).
 *
 * Two drivers are provided: a database-backed driver that needs no extra
 * infrastructure (default, used in development and on single-instance hosts)
 * and a Redis/BullMQ driver for production fan-out. The API only depends on
 * this interface.
 */

export interface EnqueueJobInput {
  projectId: string;
  type?: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

export interface ClaimedJob {
  id: string;
  projectId: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export interface JobProgressUpdate {
  stage?: PipelineStage | string;
  progress?: number;
  message?: string;
}

export interface JobQueue {
  readonly name: "db" | "redis";
  enqueue(input: EnqueueJobInput): Promise<{ jobId: string }>;
  /** Atomically reserve the next queued job, or null when the queue is empty. */
  claim(workerId: string): Promise<ClaimedJob | null>;
  /** Record progress from a running worker so the UI timeline advances. */
  progress(jobId: string, update: JobProgressUpdate): Promise<void>;
  complete(jobId: string, result?: Record<string, unknown>): Promise<void>;
  fail(jobId: string, error: string, retryable: boolean): Promise<void>;
  cancel(jobId: string): Promise<void>;
  /** Number of queued jobs, used by the health endpoint. */
  depth(): Promise<number>;
}

export class JobQueueError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE") {
    super(message);
    this.name = "JobQueueError";
  }
}
