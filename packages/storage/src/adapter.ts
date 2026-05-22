import type { Readable } from "node:stream";

export type StorageMetadata = Record<string, string>;

export type UploadOptions = {
  contentType?: string;
  metadata?: StorageMetadata;
};

export type UploadResult = {
  key: string;
  signedUrl: string;
  metadata: StorageMetadata;
};

export type StoredObjectMetadata = {
  key: string;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
  metadata: StorageMetadata;
};

export type StorageAdapter = {
  putText(key: string, value: string, options?: UploadOptions): Promise<UploadResult>;
  putFile(key: string, filePath: string, options?: UploadOptions | string): Promise<UploadResult>;
  putStream(key: string, stream: Readable, options?: UploadOptions): Promise<UploadResult>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getMetadata(key: string): Promise<StoredObjectMetadata>;
};
