import type { File } from "@/lib/db/schema";
import { upsertTranscription, upsertFile } from "@/lib/db/operations";
import { diarizeSpeaker } from "@/lib/services/speaker-diarization";
import { speachToText } from "@/lib/services/speech-to-text";
import { stat } from "fs/promises";
import { parseFile } from "music-metadata";
// ── Audio Processor Service ──────────────────────────────────────────

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

      console.log(`[audio-processor] Created file record: ${fileId}`);

      // Perform transcription (stubbed for now)
      const segments = await this.processFile(filePath);

      await upsertFile(newFile);

      await Promise.all(
        segments.map(async (segment) => {
          const chunk = await segment;
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

      console.log(`[audio-processor] Transcription completed: ${fileId}`);

      return {
        fileId,
      };
    } catch (error) {
      console.error(`[audio-processor] Transcription failed: ${fileId}`, error);
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
        embedding: number[];
        text: string;
      }>
    >
  > {
    // retreve audio regisration timestamp from file metadata
    const baseTimestamp = Date.now();
    const diarizationStart = performance.now();
    console.log(`[audio-processor] Starting diarization for file: ${filePath}`);

    const segments = await diarizeSpeaker(filePath);

    const diarizationEnd = performance.now();
    const diarizationDuration = (diarizationEnd - diarizationStart) / 1000; // Convert to seconds

    console.log(
      `[audio-processor] Diarization completed in ${diarizationDuration.toFixed(2)}s, ${segments.length} segments found for file: ${filePath}`,
      JSON.stringify(
        segments.map((s) => ({
          ...s,
          embedding: `[${s.embedding
            .slice(0, 5)
            .map((v) => v.toFixed(2))
            .join(", ")}...]`,
        })),
      ),
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
          console.log(
            `[audio-processor] Using metadata recording date: ${new Date(timestamp).toISOString()}`,
          );
          return new Date(timestamp);
        }
      }
    } catch (error) {
      console.warn(`[audio-processor] Could not read audio metadata: ${error}`);
    }

    // Fall back to file creation time
    const fileStats = await stat(filePath);
    console.log(
      `[audio-processor] Using file creation time: ${new Date(fileStats.birthtimeMs).toISOString()}`,
    );
    return new Date(fileStats.birthtimeMs);
  }
}

// ── Export singleton ─────────────────────────────────────────────────

export const audioProcessor = new AudioProcessor();
