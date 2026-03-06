import path from "node:path";

// ── Allowed audio formats ────────────────────────────────────────────
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/wave": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/webm": ".webm",
};

export const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".webm",
]);

// ── Upload constraints ───────────────────────────────────────────────
/** Maximum file size in bytes (100 MB) */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Directory where uploaded audio files are stored */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// ── Types ────────────────────────────────────────────────────────────
export interface UploadResult {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  path: string;
  createdAt: string;
}
