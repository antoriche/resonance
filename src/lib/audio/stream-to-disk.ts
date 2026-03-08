import { createWriteStream } from "node:fs";
import { unlink, mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

import { MAX_FILE_SIZE } from "./constants";

class MaxSizeExceededError extends Error {
  constructor(limit: number) {
    super(`File exceeds maximum allowed size of ${limit} bytes`);
    this.name = "MaxSizeExceededError";
  }
}

export { MaxSizeExceededError };

/**
 * Pipe a Web ReadableStream to a file on disk while enforcing a size limit.
 *
 * Uses Node.js streams so memory stays constant regardless of file size.
 * Cleans up the partial file on failure.
 *
 * @returns Total bytes written.
 */
export async function streamToDisk(
  stream: ReadableStream<Uint8Array>,
  destPath: string,
  maxSize: number = MAX_FILE_SIZE,
): Promise<number> {
  // Ensure the upload directory exists
  const dir = path.dirname(destPath);
  await mkdir(dir, { recursive: true });

  let bytesWritten = 0;

  // Convert the Web ReadableStream into a Node.js Readable
  const nodeReadable = Readable.fromWeb(stream as import("stream/web").ReadableStream<Uint8Array>);

  // Create a transform that counts bytes and enforces the size limit
  const counter = new (await import("node:stream")).Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytesWritten += chunk.length;
      if (bytesWritten > maxSize) {
        callback(new MaxSizeExceededError(maxSize));
      } else {
        callback(null, chunk);
      }
    },
  });

  const fileStream = createWriteStream(destPath);

  try {
    await pipeline(nodeReadable, counter, fileStream);
  } catch (error) {
    // Clean up the partially-written file
    await unlink(destPath).catch(() => {
      /* ignore if already gone */
    });
    throw error;
  }

  return bytesWritten;
}
