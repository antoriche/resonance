import type { File } from "@/lib/server/db/schema";
import { upsertTranscription, upsertFile } from "@/lib/server/db/operations";
import { diarizeSpeaker } from "@/lib/server/services/speaker-diarization";
import { speachToText } from "@/lib/server/services/speech-to-text";
import { writeFile, unlink, stat, readFile } from "fs/promises";
import { parseFile } from "music-metadata";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { createLogger } from "@/lib/server/logger";
import { Embedding } from "@/types/embedding";
import storage from "@/lib/server/services/storage";
// ── Audio Processor Service ──────────────────────────────────────

const logger = createLogger("audio-processor");

class AudioProcessor {
  /**
   * Fetch the file from storage into a temp path, run processing, clean up.
   */
  async syncFileData(key: string): Promise<{
    fileId: string;
  }> {
    const fileId = key;
    const tempPath = join(
      tmpdir(),
      `resonance-${randomBytes(8).toString("hex")}-${key}`,
    );

    try {
      const buffer = await storage.getFile(key);
      await writeFile(tempPath, buffer);

      // Validate the file is a recognisable audio container before
      // passing it to FFmpeg. WebM chunks recorded with MediaRecorder
      // timeslice may be missing the EBML header if the client didn't
      // prepend the init segment.
      if (key.endsWith(".webm")) {
        const header = Buffer.alloc(4);
        const fd = await import("fs").then((fs) =>
          fs.promises.open(tempPath, "r"),
        );
        try {
          await fd.read(header, 0, 4, 0);
        } finally {
          await fd.close();
        }
        // EBML magic bytes: 0x1A 0x45 0xDF 0xA3
        if (
          header[0] !== 0x1a ||
          header[1] !== 0x45 ||
          header[2] !== 0xdf ||
          header[3] !== 0xa3
        ) {
          logger.warn(
            { fileId },
            "WebM file missing EBML header — skipping (likely a chunk without init segment)",
          );
          return { fileId };
        }
      }

      const recordingTimestamp = await this.getRecordingTimestamp(tempPath);

      const newFile: File = {
        id: fileId,
        filePath: key,
        recordingTimestamp,
      };

      logger.info({ fileId }, `Created file record`);

      const segments = await this.processFile(tempPath);

      await upsertFile(newFile);

      await Promise.all(
        segments.map(async (chunk) => {
          await upsertTranscription({
            id: `${fileId}-${chunk.timestamp}`,
            fileId,
            offset: chunk.timestamp,
            duration: chunk.duration,
            text: chunk.text,
            embedding: chunk.embedding,
          });
        }),
      );

      logger.info({ fileId }, `Transcription completed`);

      return {
        fileId,
      };
    } catch (error) {
      logger.error({ fileId, error }, `Transcription failed`);
      throw error;
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  }

  /**
   * Stub transcription function that yields text chunks
   * TODO: Replace with actual transcription service (Whisper API, local Whisper, etc.)
   */
  private async processFile(filePath: string): Promise<
    Array<{
      timestamp: number;
      duration: number;
      embedding: Embedding;
      text: string;
    }>
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

    const transcribedSegments = await Promise.all(
      segments.map(async (segment) => {
        return speachToText(filePath, {
          offset: segment.offset,
          duration: segment.duration,
        }).then((res) => ({
          timestamp: segment.offset,
          duration: segment.duration,
          text: res.text,
          embedding: segment.embedding,
        }));
      }),
    );

    // Filter out segments with empty text
    return transcribedSegments.filter(
      (chunk) => chunk.text && chunk.text.trim() !== "",
    );
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
