import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl as createSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { RuntimeConfig } from "@media/shared/config";
import type {
  StorageAdapter,
  StorageMetadata,
  StoredObjectMetadata,
  UploadOptions,
  UploadResult
} from "./adapter.js";

export function createS3StorageAdapter(config: RuntimeConfig): StorageAdapter {
  if (!config.s3.bucket) {
    throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
  }

  const bucket = config.s3.bucket;
  const signedUrlTtlSeconds = config.s3.signedUrlTtlSeconds;
  const uploadRetries = config.storageUploadRetries;
  const client = new S3Client({
    region: config.s3.region || "auto",
    endpoint: config.s3.endpoint,
    forcePathStyle: config.s3.forcePathStyle || Boolean(config.s3.endpoint),
    credentials: config.s3.accessKeyId && config.s3.secretAccessKey
      ? {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey
        }
      : undefined
  });

  return {
    async putText(key, value, options = {}) {
      return uploadWithRetry({
        client,
        bucket,
        key,
        body: value,
        options: {
          contentType: options.contentType ?? "application/json",
          metadata: options.metadata
        },
        signedUrlTtlSeconds,
        uploadRetries
      });
    },
    async putFile(key, filePath, options = {}) {
      const normalized = normalizeOptions(options);

      return uploadWithRetry({
        client,
        bucket,
        key,
        bodyFactory: () => createReadStream(filePath),
        options: normalized,
        signedUrlTtlSeconds,
        uploadRetries
      });
    },
    async putStream(key, stream, options = {}) {
      return uploadWithRetry({
        client,
        bucket,
        key,
        body: stream,
        options,
        signedUrlTtlSeconds,
        uploadRetries
      });
    },
    async getSignedUrl(key, expiresInSeconds = signedUrlTtlSeconds) {
      return createSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        }),
        { expiresIn: expiresInSeconds }
      );
    },
    async getMetadata(key) {
      const result = await client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      }));

      return {
        key,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        etag: result.ETag,
        lastModified: result.LastModified?.toISOString(),
        metadata: result.Metadata ?? {}
      } satisfies StoredObjectMetadata;
    }
  };
}

async function uploadWithRetry(input: {
  client: S3Client;
  bucket: string;
  key: string;
  body?: string | Uint8Array | Buffer | Readable;
  bodyFactory?: () => Readable;
  options: UploadOptions;
  signedUrlTtlSeconds: number;
  uploadRetries: number;
}): Promise<UploadResult> {
  const attempts = Math.max(1, input.uploadRetries);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await input.client.send(new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.bodyFactory ? input.bodyFactory() : input.body,
        ContentType: input.options.contentType,
        Metadata: normalizeMetadata(input.options.metadata)
      }));

      return {
        key: input.key,
        signedUrl: await createSignedUrl(
          input.client,
          new GetObjectCommand({
            Bucket: input.bucket,
            Key: input.key
          }),
          { expiresIn: input.signedUrlTtlSeconds }
        ),
        metadata: input.options.metadata ?? {}
      };
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await sleep(backoffMs(attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function normalizeOptions(options: UploadOptions | string): UploadOptions {
  return typeof options === "string" ? { contentType: options } : options;
}

function normalizeMetadata(metadata: StorageMetadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      value
    ])
  );
}

function backoffMs(attempt: number) {
  return Math.min(30000, 1000 * 2 ** (attempt - 1));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
