import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import type { RuntimeConfig } from "@media/shared/config";

type UploadInput = {
  remotePath: string;
  body: Readable | Buffer | string;
  contentType?: string;
};

export type NextcloudClient = ReturnType<typeof createNextcloudClient>;

export function createNextcloudClient(config: RuntimeConfig) {
  const { webdavUrl, username, password } = config.nextcloud;

  if (!webdavUrl || !username || !password) {
    throw new Error("NEXTCLOUD_WEBDAV_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_PASSWORD are required");
  }

  const baseUrl = webdavUrl.replace(/\/+$/, "");
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  async function upload({ remotePath, body, contentType = "application/octet-stream" }: UploadInput) {
    const response = await webdavRequest(baseUrl, remotePath, authorization, {
      method: "PUT",
      headers: {
        "content-type": contentType
      },
      body,
      duplex: "half"
    } as RequestInit & { duplex: "half" });

    if (![200, 201, 204].includes(response.status)) {
      throw new Error(`Failed to upload Nextcloud file ${remotePath}: ${response.status} ${await response.text()}`);
    }
  }

  return {
    async ensureFolder(remotePath: string) {
      const segments = cleanPath(remotePath).split("/").filter(Boolean);
      let current = "";

      for (const segment of segments) {
        current = `${current}/${segment}`;
        const response = await webdavRequest(baseUrl, current, authorization, {
          method: "MKCOL"
        });

        if (![201, 405].includes(response.status)) {
          throw new Error(`Failed to create Nextcloud folder ${current}: ${response.status} ${await response.text()}`);
        }
      }
    },
    upload,
    async uploadFile(remotePath: string, filePath: string, contentType?: string) {
      await upload({
        remotePath,
        body: createReadStream(filePath),
        contentType
      });
    }
  };
}

async function webdavRequest(baseUrl: string, remotePath: string, authorization: string, init: RequestInit) {
  const path = cleanPath(remotePath)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  const headers = new Headers(init.headers);
  headers.set("authorization", authorization);

  return fetch(`${baseUrl}/${path}`, {
    ...init,
    headers
  });
}

function cleanPath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}
