import { getEnv } from "@/lib/env";
import { DbJobQueue } from "./db-driver";
import { RedisJobQueue } from "./redis-driver";
import type { JobQueue } from "./types";

let cached: JobQueue | null = null;

/**
 * Resolve the configured queue driver.
 *
 * `db` (default) needs no additional infrastructure and is used for local
 * development and single-instance deployments. `redis` uses BullMQ-compatible
 * list semantics for horizontal scaling.
 */
export function getQueue(): JobQueue {
  if (cached) return cached;
  const env = getEnv();

  if (env.QUEUE_DRIVER === "redis") {
    cached = new RedisJobQueue({
      url: env.REDIS_URL ?? "",
      queueName: env.QUEUE_NAME,
      pollIntervalMs: env.QUEUE_POLL_INTERVAL_MS,
    });
    return cached;
  }

  cached = new DbJobQueue();
  return cached;
}

/** Cast helper so callers can reach DB-driver extras such as `recoverStalled`. */
export function getDbQueue(): DbJobQueue {
  return getQueue() as DbJobQueue;
}

export function resetQueueCache(): void {
  cached = null;
}

export * from "./types";
export { DbJobQueue } from "./db-driver";
export { RedisJobQueue } from "./redis-driver";
