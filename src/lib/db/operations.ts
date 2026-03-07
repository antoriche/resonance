import { eq } from "drizzle-orm";
import { db, client } from "./client";
import type { Transcription, File } from "./schema";

const { transcriptions, files } = client;

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
