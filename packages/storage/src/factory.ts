import type { RuntimeConfig } from "@media/shared/config";
import type { StorageAdapter } from "./adapter.js";
import { createLocalStorageAdapter } from "./local.js";
import { createS3StorageAdapter } from "./s3.js";

export function createStorageAdapter(config: RuntimeConfig): StorageAdapter {
  if (config.storageDriver === "s3") {
    return createS3StorageAdapter(config);
  }

  return createLocalStorageAdapter(config.localStorageRoot);
}

