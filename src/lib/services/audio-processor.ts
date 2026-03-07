import type { File } from "@/lib/db/schema";
import { upsertTranscription, upsertFile } from "@/lib/db/operations";
import { diarizeSpeaker } from "@/lib/services/speaker-diarization";
import { speachToText } from "@/lib/services/speech-to-text";
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
      // Create initial record with 'pending' status
      const newFile: File = {
        id: fileId,
        filePath,
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
}

// ── Export singleton ─────────────────────────────────────────────────

export const audioProcessor = new AudioProcessor();
