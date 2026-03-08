import type { Transcription } from "@/lib/db/schema";

// ── API Response Types ───────────────────────────────────────────────

export interface PaginationInfo {
  count: number;
  nextCursor: string | null;
  prevCursor: string | null;
  limit: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationInfo;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

// ── Transcriptions API Types ─────────────────────────────────────────

// Transcription without the embedding field (excluded to reduce payload size)
// but including recordingTimestamp from the files table for display purposes
export type TranscriptionListItem = Omit<Transcription, "embedding"> & {
  recordingTimestamp: Date;
};

export type TranscriptionsPaginatedResponse =
  | PaginatedResponse<TranscriptionListItem>
  | ErrorResponse;

export interface GetTranscriptionsParams {
  limit?: number;
  cursor?: string;
  direction?: "next" | "prev";
  date?: string; // ISO 8601 datetime string
  fileId?: string;
}
