import type { File } from "@/lib/db/schema";
import {
  upsertTranscription,
  upsertFile,
  recomputeSpeakerCentroid,
} from "@/lib/db/operations";
import { resolveSpeaker } from "@/lib/services/speaker-resolution";
import { diarizeSpeaker } from "@/lib/services/speaker-diarization";
import { speachToText } from "@/lib/services/speech-to-text";
import { stat } from "fs/promises";
import { parseFile } from "music-metadata";
import { createLogger } from "@/lib/logger";
import { Embedding } from "@/types/embedding";
// ── Audio Processor Service ──────────────────────────────────────

const logger = createLogger("audio-processor");

class AudioProcessor {
  /**
   * Process an audio file: transcribe it and store results in DB
   */
  async syncFileData(filePath: string): Promise<{
    fileId: string;
  }> {
    const fileId = filePath;

    try {
      const recordingTimestamp = await this.getRecordingTimestamp(filePath);

      const newFile: File = {
        id: fileId,
        filePath,
        recordingTimestamp,
      };

      logger.info({ fileId }, `Created file record`);

      // Perform transcription (stubbed for now)
      const segments = await this.processFile(filePath);

      await upsertFile(newFile);

      const speakerIds = new Set<string>();

      await Promise.all(
        segments.map(async (segment) => {
          const chunk = await segment;
          const speakerId = await resolveSpeaker(chunk.embedding);
          speakerIds.add(speakerId);
          await upsertTranscription({
            id: `${fileId}-${chunk.timestamp}`,
            fileId,
            offset: chunk.timestamp,
            duration: chunk.duration,
            text: chunk.text,
            embedding: chunk.embedding,
            speakerId,
          });
        }),
      );

      // Recompute centroids for all speakers that were assigned segments
      await Promise.all(
        [...speakerIds].map((sid) => recomputeSpeakerCentroid(sid)),
      );

      logger.info(
        { fileId, speakerCount: speakerIds.size },
        `Transcription completed`,
      );

      return {
        fileId,
      };
    } catch (error) {
      logger.error({ fileId, error }, `Transcription failed`);
      throw error;
    }
  }

  /**
   * Stub transcription function that yields text chunks
   * TODO: Replace with actual transcription service (Whisper API, local Whisper, etc.)
   */
  private async processFile(filePath: string): Promise<
    Array<
      Promise<{
        timestamp: number;
        duration: number;
        embedding: Embedding;
        text: string;
      }>
    >
  > {
    // retreve audio regisration timestamp from file metadata
    const baseTimestamp = Date.now();
    const diarizationStart = performance.now();
    logger.info({ filePath }, `Starting diarization for file`);

    const segments = await diarizeSpeaker(filePath);

    const diarizationEnd = performance.now();
    const diarizationDuration = (diarizationEnd - diarizationStart) / 1000; // Convert to seconds

    logger.info(
      {
        filePath,
        duration: diarizationDuration.toFixed(2),
        segmentCount: segments.length,
        segments: segments.map((s) => ({
          ...s,
          embedding: `[${s.embedding
            .slice(0, 5)
            .map((v) => v.toFixed(2))
            .join(", ")}...]`,
        })),
      },
      `Diarization completed in ${diarizationDuration.toFixed(2)}s, ${segments.length} segments found`,
    );

    return segments.map(async (segment) => {
      return speachToText(filePath, {
        offset: segment.offset,
        duration: segment.duration,
      }).then((res) => ({
        timestamp: segment.offset,
        duration: segment.duration,
        text: res.text,
        embedding: segment.embedding,
      }));
    });
  }

  /**
   * Extract recording timestamp from audio metadata or fall back to file creation time
   */
  private async getRecordingTimestamp(filePath: string): Promise<Date> {
    try {
      // Try to read audio metadata
      const metadata = await parseFile(filePath);

      // Check for recording date in various metadata fields
      const recordingDate =
        metadata.common.date || // ISO date string
        metadata.native?.ID3v2?.find((tag) => tag.id === "TDRC")?.value || // ID3v2 Recording time
        metadata.native?.ID3v2?.find((tag) => tag.id === "TDAT")?.value || // ID3v2 Date
        metadata.native?.["iTunes"]?.find((tag) => tag.id === "©day")?.value; // iTunes date

      if (
        recordingDate &&
        (typeof recordingDate === "string" || typeof recordingDate === "number")
      ) {
        const timestamp = new Date(recordingDate).getTime();
        if (!isNaN(timestamp)) {
          logger.info(
            { timestamp: new Date(timestamp).toISOString() },
            `Using metadata recording date`,
          );
          return new Date(timestamp);
        }
      }
    } catch (error) {
      logger.warn({ error }, `Could not read audio metadata`);
    }

    // Fall back to file creation time
    const fileStats = await stat(filePath);
    logger.info(
      { timestamp: new Date(fileStats.birthtimeMs).toISOString() },
      `Using file creation time`,
    );
    return new Date(fileStats.birthtimeMs);
  }
}

// ── Export singleton ─────────────────────────────────────────────────

export const audioProcessor = new AudioProcessor();
