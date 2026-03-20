import { eq, desc, asc, and, lt, gt, or, gte, lte } from "drizzle-orm";
import { db, client } from "./client";
import type { Transcription, File } from "./schema";

const { transcriptions, files, computed_speakers } = client;

// ── Database Operations ──────────────────────────────────────────────

export async function upsertFile(data: File): Promise<void> {
  await db.insert(files).values(data).onConflictDoUpdate({
    target: files.id,
    set: data,
  });
}

export async function upsertTranscription(data: Transcription): Promise<void> {
  await db.insert(transcriptions).values(data).onConflictDoUpdate({
    target: transcriptions.id,
    set: data,
  });
}

export async function updateTranscription(
  id: string,
  data: Partial<Omit<Transcription, "id">>,
): Promise<void> {
  await db.update(transcriptions).set(data).where(eq(transcriptions.id, id));
}

export async function getTranscriptionById(
  id: string,
): Promise<Transcription | null> {
  const result = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getFileByFilename(
  filename: string,
): Promise<File | null> {
  const result = await db
    .select()
    .from(files)
    .where(eq(files.filePath, filename))
    .limit(1);
  return result[0] ?? null;
}

export async function getAllTranscriptions(): Promise<Transcription[]> {
  return await db.select().from(transcriptions);
}

// ── Pagination Utilities ─────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
}

export interface CursorData {
  timestamp: number;
  fileId: string;
  offset: number;
}

/**
 * Encode cursor data for URL-safe pagination
 */
export function encodeCursor(
  timestamp: Date,
  fileId: string,
  offset: number,
): string {
  const data = `${timestamp.getTime()}|${fileId}|${offset}`;
  return Buffer.from(data).toString("base64url");
}

/**
 * Decode cursor from base64url string
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const parts = decoded.split("|");
    if (parts.length !== 3) return null;

    const timestamp = parseInt(parts[0], 10);
    const fileId = parts[1];
    const offset = parseInt(parts[2], 10);

    if (isNaN(timestamp) || isNaN(offset)) return null;

    return { timestamp, fileId, offset };
  } catch {
    return null;
  }
}

// ── Paginated Queries ────────────────────────────────────────────────

export interface GetTranscriptionsPaginatedParams {
  limit?: number;
  cursor?: string;
  direction?: "next" | "prev";
  filters?: {
    fileId?: string;
    recordingDate?: Date;
    textSearch?: string;
  };
}

export interface TranscriptionWithSpeaker {
  id: string;
  fileId: string;
  offset: number;
  duration: number;
  text: string;
  speakerId: string | null;
  recordingTimestamp: Date;
  speakerName: string | null;
}

export async function getTranscriptionsPaginated(
  params: GetTranscriptionsPaginatedParams = {},
): Promise<PaginatedResult<TranscriptionWithSpeaker>> {
  const { limit = 10, cursor, direction = "next", filters } = params;

  // Validate limit
  const validLimit = Math.min(Math.max(1, limit), 100);

  // Build the query - exclude embedding to reduce payload size
  let query = db
    .select({
      transcription: {
        id: transcriptions.id,
        fileId: transcriptions.fileId,
        offset: transcriptions.offset,
        duration: transcriptions.duration,
        text: transcriptions.text,
        speakerId: computed_speakers.speakerId,
      },
      recordingTimestamp: files.recordingTimestamp,
    })
    .from(transcriptions)
    .innerJoin(files, eq(transcriptions.fileId, files.id))
    .leftJoin(
      computed_speakers,
      eq(transcriptions.id, computed_speakers.transcriptionId),
    )
    .$dynamic();

  // Apply cursor-based filtering
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (!cursorData) {
      throw new Error("Invalid cursor format");
    }

    const cursorTimestamp = new Date(cursorData.timestamp);

    if (direction === "next") {
      // For "next", we want items OLDER than the cursor (DESC ordering)
      query = query.where(
        or(
          lt(files.recordingTimestamp, cursorTimestamp),
          and(
            eq(files.recordingTimestamp, cursorTimestamp),
            or(
              gt(transcriptions.fileId, cursorData.fileId),
              and(
                eq(transcriptions.fileId, cursorData.fileId),
                gt(transcriptions.offset, cursorData.offset),
              ),
            ),
          ),
        ),
      );
    } else {
      // For "prev", we want items NEWER than the cursor (reverse logic)
      query = query.where(
        or(
          gt(files.recordingTimestamp, cursorTimestamp),
          and(
            eq(files.recordingTimestamp, cursorTimestamp),
            or(
              lt(transcriptions.fileId, cursorData.fileId),
              and(
                eq(transcriptions.fileId, cursorData.fileId),
                lt(transcriptions.offset, cursorData.offset),
              ),
            ),
          ),
        ),
      );
    }
  }

  // Apply additional filters if provided
  // Drizzle ORM automatically ANDs multiple .where() calls
  const additionalFilters = [];

  if (filters?.fileId) {
    additionalFilters.push(eq(transcriptions.fileId, filters.fileId));
  }

  if (filters?.recordingDate) {
    additionalFilters.push(
      gte(files.recordingTimestamp, filters.recordingDate),
    );
  }

  if (additionalFilters.length > 0) {
    query = query.where(and(...additionalFilters));
  }

  // Order: newest recordings first, then by offset within file
  if (direction === "prev") {
    // Reverse ordering for "prev" direction
    query = query
      .orderBy(asc(files.recordingTimestamp), desc(transcriptions.offset))
      .limit(validLimit);
  } else {
    query = query
      .orderBy(desc(files.recordingTimestamp), asc(transcriptions.offset))
      .limit(validLimit);
  }

  const results = await query;

  // Extract transcriptions including recordingTimestamp and speaker info
  const items = results.map((r) => ({
    ...r.transcription,
    recordingTimestamp: r.recordingTimestamp,
    speakerName: null as string | null,
  }));

  // If we got items in "prev" direction, reverse them back to normal order
  if (direction === "prev") {
    items.reverse();
  }

  // Generate cursors for next/prev pages
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (items.length > 0) {
    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    // Get the recording timestamps for cursor generation
    const firstResult = results.find(
      (r) => r.transcription.id === firstItem.id,
    );
    const lastResult = results.find((r) => r.transcription.id === lastItem.id);

    if (firstResult && lastResult) {
      // Only provide nextCursor if we got a full page (might be more data)
      if (items.length === validLimit) {
        nextCursor = encodeCursor(
          lastResult.recordingTimestamp,
          lastItem.fileId,
          lastItem.offset,
        );
      }

      // Always provide prevCursor if we have a cursor (means we're not on first page)
      if (cursor) {
        prevCursor = encodeCursor(
          firstResult.recordingTimestamp,
          firstItem.fileId,
          firstItem.offset,
        );
      }
    }
  }

  return {
    items,
    nextCursor,
    prevCursor,
  };
}
