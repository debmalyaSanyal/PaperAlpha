/** Storage abstraction: local filesystem in development, S3-compatible in production. */

export interface PutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType?: string;
  checksum?: string;
}

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, data: Buffer | Uint8Array, options?: PutOptions): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number>;
  list(prefix: string): Promise<string[]>;
  /** Returns a time-limited URL the browser can use to fetch the object. */
  getSignedDownloadUrl(key: string, ttlSeconds?: number): Promise<string>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_KEY"
      | "TOO_LARGE"
      | "UNAVAILABLE"
      | "IO_ERROR"
      | "SIGNATURE_INVALID",
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Normalize and validate an object key.
 *
 * Prevents path traversal: rejects absolute paths, drive letters, backslashes,
 * null bytes and any `..` segment. Keys are always POSIX-style and relative.
 */
export function normalizeKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== "string") {
    throw new StorageError("Storage key must be a non-empty string.", "INVALID_KEY");
  }
  if (rawKey.includes("\0")) {
    throw new StorageError("Storage key contains a null byte.", "INVALID_KEY");
  }
  const unixed = rawKey.replace(/\\/g, "/").trim();
  if (unixed.startsWith("/") || /^[a-zA-Z]:/.test(unixed)) {
    throw new StorageError(`Storage key must be relative: ${rawKey}`, "INVALID_KEY");
  }
  const segments = unixed.split("/").filter((s) => s.length > 0 && s !== ".");
  if (segments.some((s) => s === "..")) {
    throw new StorageError("Storage key must not contain '..' segments.", "INVALID_KEY");
  }
  if (segments.length === 0) {
    throw new StorageError("Storage key resolves to an empty path.", "INVALID_KEY");
  }
  return segments.join("/");
}

/** Deterministic key layout used by the whole application. */
export const StorageKeys = {
  projectFile: (projectId: string, storedName: string) => `projects/${projectId}/input/${storedName}`,
  projectArtifact: (projectId: string, stage: string, name: string) =>
    `projects/${projectId}/artifacts/${stage}/${name}`,
  projectFigure: (projectId: string, storedName: string) => `projects/${projectId}/figures/${storedName}`,
  projectDocument: (projectId: string, fileName: string) => `projects/${projectId}/output/${fileName}`,
  literatureCache: (provider: string, queryHash: string) => `cache/literature/${provider}/${queryHash}.json`,
} as const;
