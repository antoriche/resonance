import { Readable } from "node:stream";
import { MAX_FILE_SIZE } from "@/lib/shared/audio/constants";

class MaxSizeExceededError extends Error {
  constructor(limit: number) {
    super(`File exceeds maximum allowed size of ${limit} bytes`);
    this.name = "MaxSizeExceededError";
  }
}

export { MaxSizeExceededError };

/**
 * Consume a Web ReadableStream into a Buffer while enforcing a size limit.
 *
 * @returns Buffer containing the stream data and the total bytes
 */
export async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
  maxSize: number = MAX_FILE_SIZE,
): Promise<{ buffer: Buffer; bytesWritten: number }> {
  const chunks: Uint8Array[] = [];
  let bytesWritten = 0;

  // Convert the Web ReadableStream into a Node.js Readable
  const nodeReadable = Readable.fromWeb(
    stream as import("stream/web").ReadableStream<Uint8Array>,
  );

  for await (const chunk of nodeReadable) {
    bytesWritten += chunk.length;
    if (bytesWritten > maxSize) {
      throw new MaxSizeExceededError(maxSize);
    }
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    bytesWritten,
  };
}
