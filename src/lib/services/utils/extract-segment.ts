import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { unlink } from "fs/promises";

// ── Audio Segment Extraction ────────────────────────────────────────

export interface SegmentExtractionResult {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Extract an audio segment from a file using ffmpeg
 * Prepares audio in Whisper-compatible format (16kHz, mono, WAV)
 *
 * @param audioPath - Path to source audio file
 * @param offset - Start time in seconds
 * @param duration - Segment duration in seconds
 * @returns Path to extracted segment and cleanup function
 */
export async function extractAudioSegment(
  audioPath: string,
  offset: number,
  duration: number,
): Promise<SegmentExtractionResult> {
  // Generate unique temp file path
  const tempFilename = `whisper-segment-${randomBytes(8).toString("hex")}.wav`;
  const tempPath = join(tmpdir(), tempFilename);

  return new Promise((resolve, reject) => {
    ffmpeg(audioPath)
      .setStartTime(offset)
      .setDuration(duration)
      .audioFrequency(16000) // Whisper expects 16kHz
      .audioChannels(1) // Mono
      .format("wav")
      .on("start", (commandLine) => {
        console.log(
          `[extract-segment] Extracting segment: ${offset}s - ${offset + duration}s`,
        );
        console.log(`[extract-segment] FFmpeg command: ${commandLine}`);
      })
      .on("end", () => {
        console.log(`[extract-segment] Segment extracted to: ${tempPath}`);
        resolve({
          path: tempPath,
          cleanup: async () => {
            try {
              await unlink(tempPath);
              console.log(`[extract-segment] Cleaned up: ${tempPath}`);
            } catch (error) {
              console.warn(
                `[extract-segment] Failed to cleanup ${tempPath}:`,
                error,
              );
            }
          },
        });
      })
      .on("error", (err) => {
        console.error("[extract-segment] FFmpeg error:", err);
        reject(new Error(`Failed to extract audio segment: ${err.message}`));
      })
      .save(tempPath);
  });
}
