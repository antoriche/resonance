import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";

import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  type UploadResult,
} from "@/lib/shared/audio/constants";
import {
  streamToBuffer,
  MaxSizeExceededError,
} from "@/lib/server/audio/stream-to-buffer";
import { authenticate } from "@/lib/server/middleware/auth";
import { audioProcessor } from "@/lib/server/services/audio-processor";
import { createLogger } from "@/lib/server/logger";
import storage from "@/lib/server/services/storage";

const logger = createLogger("audio/upload");

// ── Helpers ──────────────────────────────────────────────────────────

function extensionForMime(mime: string): string | null {
  return ALLOWED_MIME_TYPES[mime] ?? null;
}

function extensionFromFilename(name: string): string | null {
  const ext = path.extname(name).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Trigger audio processing (fire-and-forget, kept alive on Vercel via waitUntil)
 */
function triggerProcessing(key: string, id: string) {
  logger.info({ id }, `Triggered async processing`);
  waitUntil(
    audioProcessor.syncFileData(key).catch((err) => {
      logger.error({ id, err }, `Background processing failed`);
    }),
  );
}

// ── Route handler ────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Auth gate (no-op for now)
  try {
    await authenticate(request);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const contentType = request.headers.get("content-type") ?? "";

  // ── Multipart form-data ──────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    return handleMultipart(request);
  }

  // ── Raw binary stream (audio/*) ──────────────────────────────────
  if (contentType.startsWith("audio/")) {
    return handleRawStream(request, contentType);
  }

  return jsonError(
    "Unsupported Content-Type. Use 'audio/*' for raw binary or 'multipart/form-data'.",
    400,
  );
}

// ── Raw binary upload ────────────────────────────────────────────────

async function handleRawStream(request: Request, contentType: string) {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const ext = extensionForMime(mime);

  if (!ext) {
    return jsonError(
      `Unsupported audio format: ${mime}. Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`,
      400,
    );
  }

  if (!request.body) {
    return jsonError("Request body is empty.", 400);
  }

  const id = randomUUID();
  const filename = `${id}${ext}`;

  try {
    // Stream to buffer with size limit
    const { buffer, bytesWritten } = await streamToBuffer(request.body);

    // Save to storage
    await storage.saveFile(filename, buffer);

    const result: UploadResult = {
      id,
      filename,
      size: bytesWritten,
      mimeType: mime,
      path: `/uploads/${filename}`,
      createdAt: new Date().toISOString(),
    };

    // Trigger audio processing
    triggerProcessing(filename, id);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleStreamError(error);
  }
}

// ── Multipart form-data upload ───────────────────────────────────────

async function handleMultipart(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Failed to parse multipart form data.", 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return jsonError(
      "Missing 'file' field in form data. Attach the audio file as 'file'.",
      400,
    );
  }

  // Determine MIME type — prefer the declared type, fall back to extension
  let mime = file.type?.toLowerCase() || "";
  let ext = extensionForMime(mime);

  if (!ext && file.name) {
    ext = extensionFromFilename(file.name);
    if (ext) {
      // Reverse-lookup a canonical MIME for the extension
      mime =
        Object.entries(ALLOWED_MIME_TYPES).find(([, e]) => e === ext)?.[0] ??
        mime;
    }
  }

  if (!ext) {
    return jsonError(
      `Unsupported audio format: ${mime || "unknown"}. Allowed extensions: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
      400,
    );
  }

  const id = randomUUID();
  const filename = `${id}${ext}`;

  try {
    const stream = file.stream() as unknown as ReadableStream<Uint8Array>;

    // Stream to buffer with size limit
    const { buffer, bytesWritten } = await streamToBuffer(stream);

    // Save to storage
    await storage.saveFile(filename, buffer);

    const result: UploadResult = {
      id,
      filename,
      size: bytesWritten,
      mimeType: mime,
      path: `/uploads/${filename}`,
      createdAt: new Date().toISOString(),
    };

    // Trigger audio processing
    triggerProcessing(filename, id);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleStreamError(error);
  }
}

// ── Error handling ───────────────────────────────────────────────────

function handleStreamError(error: unknown) {
  if (error instanceof MaxSizeExceededError) {
    return jsonError(error.message, 413);
  }

  logger.error({ error }, "Unexpected error");
  return jsonError("Internal server error while saving file.", 500);
}
