import { Readable } from "node:stream";

export function nodeReadableFromWeb(stream: ReadableStream<Uint8Array>) {
  return Readable.fromWeb(stream as unknown as Parameters<typeof Readable.fromWeb>[0]);
}
