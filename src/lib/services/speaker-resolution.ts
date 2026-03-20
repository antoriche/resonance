import { randomUUID } from "crypto";
import { findNearestSpeaker, createSpeaker } from "@/lib/db/operations";
import { createLogger } from "@/lib/logger";
import { Embedding } from "@/types/embedding";

const logger = createLogger("speaker-resolution");

/**
 * Cosine similarity threshold for matching a segment embedding
 * to an existing global speaker. pgvector's `<=>` returns cosine
 * *distance* (0 = identical, 2 = opposite), so similarity = 1 - distance.
 */
export const SPEAKER_SIMILARITY_THRESHOLD = 0.7;

/**
 * Find or create a speaker that matches the given embedding.
 *
 * 1. Query the nearest speaker centroid using pgvector cosine distance.
 * 2. If similarity >= threshold, return the existing speaker ID.
 * 3. Otherwise create a new speaker row with this embedding as its centroid.
 */
export async function resolveSpeaker(embedding: Embedding): Promise<string> {
  const nearest = await findNearestSpeaker(embedding);

  logger.debug(
    { embedding, nearest },
    "Resolving speaker for segment embedding",
  );

  if (nearest) {
    const similarity = 1 - nearest.distance;
    logger.debug(
      { speakerId: nearest.id, similarity: similarity.toFixed(3) },
      "Nearest speaker match",
    );

    if (similarity >= SPEAKER_SIMILARITY_THRESHOLD) {
      return nearest.id;
    }
  }

  // No match — create a new speaker
  const newId = randomUUID();
  await createSpeaker(newId, embedding);
  logger.info({ speakerId: newId }, "Created new speaker");
  return newId;
}
