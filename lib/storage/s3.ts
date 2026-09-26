import { createHash } from "node:crypto";

import {
  StorageError,
  normalizeKey,
  type PutOptions,
  type StorageDriver,
  type StoredObject,
} from "./types";

export interface S3DriverOptions {
  endpoint?: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
}

type S3Module = typeof import("@aws-sdk/client-s3");

/**
 * S3-compatible storage driver (AWS S3, Cloudflare R2, MinIO, Supabase
 * Storage S3 endpoint, ...).
 *
 * `@aws-sdk/client-s3` is imported lazily so local development never needs the
 * dependency. When it is absent the driver fails with an actionable message
 * instead of a module-resolution stack trace.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  private client: import("@aws-sdk/client-s3").S3Client | null = null;

  constructor(private readonly options: S3DriverOptions) {}

  private async sdk(): Promise<S3Module> {
    try {
      return (await import("@aws-sdk/client-s3")) as S3Module;
    } catch {
      throw new StorageError(
        "S3 storage driver requires '@aws-sdk/client-s3'. Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner",
        "UNAVAILABLE",
      );
    }
  }

  private async getClient(): Promise<import("@aws-sdk/client-s3").S3Client> {
    if (this.client) return this.client;
    const { S3Client } = await this.sdk();
    this.client = new S3Client({
      region: this.options.region || "us-east-1",
      endpoint: this.options.endpoint || undefined,
      forcePathStyle: this.options.forcePathStyle,
      credentials: {
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
      },
    });
    return this.client;
  }

  async put(key: string, data: Buffer | Uint8Array, options: PutOptions = {}): Promise<StoredObject> {
    const normalized = normalizeKey(key);
    const { PutObjectCommand } = await this.sdk();
    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
    try {
      await (await this.getClient()).send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: normalized,
          Body: body,
          ContentType: options.contentType,
          Metadata: options.metadata,
        }),
      );
    } catch (error) {
      throw new StorageError(`Failed to upload object ${normalized}: ${(error as Error).message}`, "IO_ERROR");
    }
    return {
      key: normalized,
      size: body.byteLength,
      contentType: options.contentType,
      checksum: createHash("sha256").update(body).digest("hex"),
    };
  }

  async get(key: string): Promise<Buffer> {
    const normalized = normalizeKey(key);
    const { GetObjectCommand } = await this.sdk();
    try {
      const response = await (await this.getClient()).send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: normalized }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new StorageError(`Empty body for object ${normalized}`, "NOT_FOUND");
      return Buffer.from(bytes);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      const name = (error as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound") {
        throw new StorageError(`Object not found: ${normalized}`, "NOT_FOUND");
      }
      throw new StorageError(`Failed to download object ${normalized}: ${(error as Error).message}`, "IO_ERROR");
    }
  }

  async delete(key: string): Promise<void> {
    const normalized = normalizeKey(key);
    const { DeleteObjectCommand } = await this.sdk();
    try {
      await (await this.getClient()).send(
        new DeleteObjectCommand({ Bucket: this.options.bucket, Key: normalized }),
      );
    } catch (error) {
      throw new StorageError(`Failed to delete object ${normalized}: ${(error as Error).message}`, "IO_ERROR");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.size(key);
      return true;
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") return false;
      throw error;
    }
  }

  async size(key: string): Promise<number> {
    const normalized = normalizeKey(key);
    const { HeadObjectCommand } = await this.sdk();
    try {
      const response = await (await this.getClient()).send(
        new HeadObjectCommand({ Bucket: this.options.bucket, Key: normalized }),
      );
      return response.ContentLength ?? 0;
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") {
        throw new StorageError(`Object not found: ${normalized}`, "NOT_FOUND");
      }
      throw new StorageError(`Failed to stat object ${normalized}: ${(error as Error).message}`, "IO_ERROR");
    }
  }

  async list(prefix: string): Promise<string[]> {
    const normalized = prefix ? normalizeKey(prefix) : "";
    const { ListObjectsV2Command } = await this.sdk();
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await (await this.getClient()).send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: normalized ? `${normalized}/` : undefined,
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of response.Contents ?? []) if (item.Key) keys.push(item.Key);
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  async getSignedDownloadUrl(key: string, ttlSeconds = 900): Promise<string> {
    const normalized = normalizeKey(key);
    const { GetObjectCommand } = await this.sdk();
    try {
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      return await getSignedUrl(
        await this.getClient(),
        new GetObjectCommand({ Bucket: this.options.bucket, Key: normalized }),
        { expiresIn: ttlSeconds },
      );
    } catch (error) {
      throw new StorageError(
        `Failed to presign object ${normalized}: ${(error as Error).message}. Presigning needs '@aws-sdk/s3-request-presigner'.`,
        "UNAVAILABLE",
      );
    }
  }
}