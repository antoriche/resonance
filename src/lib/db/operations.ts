import { eq } from "drizzle-orm";
import { db, client } from "./client";
import type { NewTranscription, Transcription } from "./schema";

const { transcriptions } = client;

// ── Database Operations ──────────────────────────────────────────────

export async function insertTranscription(
  data: NewTranscription,
): Promise<void> {
  await db.insert(transcriptions).values(data);
}

export async function updateTranscription(
  id: string,
  data: Partial<Omit<NewTranscription, "id">>,
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

export async function getTranscriptionByFilename(
  filename: string,
): Promise<Transcription | null> {
  const result = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.filename, filename))
    .limit(1);
  return result[0] ?? null;
}

export async function getAllTranscriptions(): Promise<Transcription[]> {
  return await db.select().from(transcriptions);
}
