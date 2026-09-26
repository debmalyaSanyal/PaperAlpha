import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  StorageError,
  normalizeKey,
  type PutOptions,
  type StorageDriver,
  type StoredObject,
} from "./types";

/**
 * Local-filesystem storage driver (development default).
 *
 * Every key is resolved inside `root` and re-checked after resolution, so a
 * crafted key cannot escape the storage directory.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  constructor(
    private readonly root: string,
    private readonly signingSecret: string,
    private readonly publicBaseUrl: string,
  ) {}

  private resolve(key: string): string {
    const normalized = normalizeKey(key);
    const rootResolved = path.resolve(this.root);
    const target = path.resolve(rootResolved, ...normalized.split("/"));
    const relative = path.relative(rootResolved, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new StorageError("Resolved path escapes the storage root.", "INVALID_KEY");
    }
    return target;
  }

  async put(key: string, data: Buffer | Uint8Array, options: PutOptions = {}): Promise<StoredObject> {
    const target = this.resolve(key);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
    } catch (error) {
      throw new StorageError(`Failed to write object ${key}: ${(error as Error).message}`, "IO_ERROR");
    }
    return {
      key: normalizeKey(key),
      size: data.byteLength,
      contentType: options.contentType,
      checksum: createHash("sha256").update(data).digest("hex"),
    };
  }

  async get(key: string): Promise<Buffer> {
    const target = this.resolve(key);
    try {
      return await readFile(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError(`Object not found: ${key}`, "NOT_FOUND");
      }
      throw new StorageError(`Failed to read object ${key}: ${(error as Error).message}`, "IO_ERROR");
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolve(key);
    try {
      await rm(target, { force: true });
    } catch (error) {
      throw new StorageError(`Failed to delete object ${key}: ${(error as Error).message}`, "IO_ERROR");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number> {
    try {
      return (await stat(this.resolve(key))).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError(`Object not found: ${key}`, "NOT_FOUND");
      }
      throw new StorageError(`Failed to stat object ${key}: ${(error as Error).message}`, "IO_ERROR");
    }
  }

  async list(prefix: string): Promise<string[]> {
    const normalized = prefix ? normalizeKey(prefix) : "";
    const base = this.resolve(normalized || ".");
    const results: string[] = [];

    const walk = async (dir: string, rel: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), childRel);
        else results.push(normalized ? `${normalized}/${childRel}` : childRel);
      }
    };

    await walk(base, "");
    return results;
  }

  /**
   * Local "signed" URL: an HMAC over the key and expiry, served by
   * GET /api/files/download. Mirrors the S3 presigned-URL contract.
   */
  async getSignedDownloadUrl(key: string, ttlSeconds = 900): Promise<string> {
    const normalized = normalizeKey(key);
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = signDownload(normalized, expires, this.signingSecret);
    const url = new URL("/api/files/download", this.publicBaseUrl);
    url.searchParams.set("key", normalized);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("signature", signature);
    return url.toString();
  }
}

export function signDownload(key: string, expires: number, secret: string): string {
  return createHmac("sha256", secret).update(`${key}\n${expires}`).digest("hex");
}

export function verifyDownloadSignature(
  key: string,
  expires: number,
  signature: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): { ok: true } | { ok: false; reason: "expired" | "invalid" } {
  if (!Number.isFinite(expires) || expires < now) return { ok: false, reason: "expired" };
  const expected = signDownload(key, expires, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature ?? "", "utf8");
  if (a.length !== b.length) return { ok: false, reason: "invalid" };
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "invalid" };
}
