import { getEnv } from "@/lib/env";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";
import { StorageError, type StorageDriver } from "./types";

let cached: StorageDriver | null = null;

/**
 * Resolve the configured storage driver.
 *
 * The rest of the application only ever depends on the `StorageDriver`
 * interface, so swapping local filesystem storage for S3-compatible object
 * storage is a configuration change, not a code change.
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  const env = getEnv();

  if (env.STORAGE_DRIVER === "s3") {
    if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_BUCKET) {
      throw new StorageError(
        "STORAGE_DRIVER=s3 requires S3_ACCESS_KEY, S3_SECRET_KEY and S3_BUCKET.",
        "UNAVAILABLE",
      );
    }
    cached = new S3StorageDriver({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
      bucket: env.S3_BUCKET,
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
      publicBaseUrl: env.NEXT_PUBLIC_APP_URL,
    });
    return cached;
  }

  cached = new LocalStorageDriver(
    env.STORAGE_LOCAL_ROOT,
    env.AUTH_SECRET || env.WORKER_SHARED_SECRET,
    env.NEXT_PUBLIC_APP_URL,
  );
  return cached;
}

/** Test/dev helper: forget the memoized driver (e.g. after changing env). */
export function resetStorageCache(): void {
  cached = null;
}

export * from "./types";
export { LocalStorageDriver, signDownload, verifyDownloadSignature } from "./local";
export { S3StorageDriver } from "./s3";
