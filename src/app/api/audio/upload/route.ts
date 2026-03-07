import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  UPLOAD_DIR,
  type UploadResult,
} from "@/lib/audio/constants";
import { streamToDisk, MaxSizeExceededError } from "@/lib/audio/stream-to-disk";
import { authenticate } from "@/lib/middleware/auth";
import { audioProcessor } from "@/lib/services/audio-processor";

export const runtime = "nodejs";

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
 * Trigger audio processing (fire-and-forget)
 */
async function triggerProcessing(
  destPath: string,
  id: string,
  filename: string,
) {
  try {
    console.log(`[audio/upload] Triggered async processing: ${id}`);

    audioProcessor.syncFileData(destPath, { id, filename }).catch((err) => {
      console.error(`[audio/upload] Background processing failed: ${id}`, err);
    });
  } catch (error) {
    // Don't fail the upload if processing initialization fails
    console.error(`[audio/upload] Failed to trigger processing: ${id}`, error);
  }
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
  const destPath = path.join(UPLOAD_DIR, filename);

  try {
    const size = await streamToDisk(request.body, destPath);

    const result: UploadResult = {
      id,
      filename,
      size,
      mimeType: mime,
      path: `/uploads/${filename}`,
      createdAt: new Date().toISOString(),
    };

    // Trigger audio processing
    await triggerProcessing(destPath, id, filename);

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
  const destPath = path.join(UPLOAD_DIR, filename);

  try {
    const stream = file.stream() as unknown as ReadableStream<Uint8Array>;
    const size = await streamToDisk(stream, destPath);

    const result: UploadResult = {
      id,
      filename,
      size,
      mimeType: mime,
      path: `/uploads/${filename}`,
      createdAt: new Date().toISOString(),
    };

    // Trigger audio processing
    await triggerProcessing(destPath, id, filename);

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

  console.error("[audio/upload] Unexpected error:", error);
  return jsonError("Internal server error while saving file.", 500);
}
