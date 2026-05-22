import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Readable } from "node:stream";
import type {
  StorageAdapter,
  StorageMetadata,
  StoredObjectMetadata,
  UploadOptions,
  UploadResult
} from "./adapter.js";

export function createLocalStorageAdapter(root: string): StorageAdapter {
  return {
    async putText(key, value, options = {}) {
      const target = join(root, key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, value, "utf8");
      await persistMetadata(root, key, options);
      return uploadResult(root, key, options.metadata);
    },
    async putFile(key, filePath, options = {}) {
      const normalized = normalizeOptions(options);
      const target = join(root, key);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(filePath, target);
      await persistMetadata(root, key, normalized);
      return uploadResult(root, key, normalized.metadata);
    },
    async putStream(key, stream, options = {}) {
      const target = join(root, key);
      await mkdir(dirname(target), { recursive: true });
      await writeStream(target, stream);
      await persistMetadata(root, key, options);
      return uploadResult(root, key, options.metadata);
    },
    async getSignedUrl(key) {
      await readFile(join(root, key));
      return `file://${join(root, key)}`;
    },
    async getMetadata(key) {
      const target = join(root, key);
      const fileStat = await stat(target);
      const metadata = await readMetadata(root, key);

      return {
        key,
        contentType: metadata.contentType,
        contentLength: fileStat.size,
        lastModified: fileStat.mtime.toISOString(),
        metadata: metadata.metadata
      };
    }
  };
}

async function persistMetadata(root: string, key: string, options: UploadOptions) {
  const metadataKey = metadataPath(root, key);
  await mkdir(dirname(metadataKey), { recursive: true });
  await writeFile(metadataKey, JSON.stringify({
    contentType: options.contentType,
    metadata: options.metadata ?? {}
  }), "utf8");
}

async function readMetadata(root: string, key: string): Promise<{ contentType?: string; metadata: StorageMetadata }> {
  try {
    return JSON.parse(await readFile(metadataPath(root, key), "utf8"));
  } catch {
    return { metadata: {} };
  }
}

function metadataPath(root: string, key: string) {
  return join(root, `${key}.metadata.json`);
}

async function uploadResult(root: string, key: string, metadata: StorageMetadata = {}): Promise<UploadResult> {
  return {
    key,
    signedUrl: `file://${join(root, key)}`,
    metadata
  };
}

function normalizeOptions(options: UploadOptions | string): UploadOptions {
  return typeof options === "string" ? { contentType: options } : options;
}

async function writeStream(target: string, stream: Readable) {
  await new Promise<void>((resolve, reject) => {
    const writer = createWriteStream(target);
    stream.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
    stream.on("error", reject);
  });
}
