import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { unlink, stat, access } from "fs/promises";
import { constants } from "fs";
import { createLogger } from "@/lib/server/logger";

// ── Audio Segment Extraction ────────────────────────────────────────

const logger = createLogger("extract-segment");

export interface SegmentExtractionResult {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Extract an audio segment from a file using ffmpeg
 * Prepares audio in Whisper-compatible format (16kHz, mono, WAV)
 *
 * @param audioPath - Path to source audio file
 * @param offset - Start time in milliseconds
 * @param duration - Segment duration in milliseconds
 * @returns Path to extracted segment and cleanup function
 */
export async function extractAudioSegment(
  audioPath: string,
  offset: number,
  duration: number,
): Promise<SegmentExtractionResult> {
  // Validate source file exists and is readable
  try {
    await access(audioPath, constants.R_OK);
    const sourceStats = await stat(audioPath);
    logger.info(
      { audioPath, size: sourceStats.size },
      `Source file: ${sourceStats.size} bytes`,
    );

    if (sourceStats.size === 0) {
      throw new Error(`Source audio file is empty: ${audioPath}`);
    }
  } catch (error) {
    throw new Error(`Cannot access source audio file: ${audioPath} - ${error}`);
  }

  // Validate parameters
  if (offset < 0 || duration <= 0) {
    throw new Error(
      `Invalid segment parameters: offset=${offset}ms, duration=${duration}ms`,
    );
  }

  // Convert milliseconds to seconds for ffmpeg
  const offsetSeconds = offset / 1000;
  const durationSeconds = duration / 1000;

  logger.info(
    `Converting: ${offset}ms -> ${offsetSeconds}s, ${duration}ms -> ${durationSeconds}s`,
  );

  // Generate unique temp file path
  const tempFilename = `whisper-segment-${randomBytes(8).toString("hex")}.wav`;
  const tempPath = join(tmpdir(), tempFilename);

  return new Promise((resolve, reject) => {
    let stderrOutput = "";

    ffmpeg(audioPath)
      .setStartTime(offsetSeconds)
      .setDuration(durationSeconds)
      .audioFrequency(16000) // Whisper expects 16kHz
      .audioChannels(1) // Mono
      .format("wav")
      .on("start", (commandLine) => {
        logger.info(
          `Extracting segment: ${offsetSeconds}s - ${offsetSeconds + durationSeconds}s (${offset}ms - ${offset + duration}ms)`,
        );
        logger.info({ commandLine }, `FFmpeg command`);
      })
      .on("stderr", (stderrLine) => {
        // Capture stderr for debugging
        stderrOutput += stderrLine + "\n";
      })
      .on("end", async () => {
        logger.info(`FFmpeg process completed`);
        logger.info({ tempPath }, `Verifying output`);

        // Wait for file to be fully written and verify it has content
        // This prevents race conditions where 'end' fires before disk flush
        try {
          let attempts = 0;
          const maxAttempts = 10;
          const delayMs = 100;
          const minFileSize = 1024; // WAV header + at least some audio data

          while (attempts < maxAttempts) {
            try {
              const fileStats = await stat(tempPath);

              if (fileStats.size >= minFileSize) {
                logger.info(`File verified: ${fileStats.size} bytes`);
                resolve({
                  path: tempPath,
                  cleanup: async () => {
                    try {
                      await unlink(tempPath);
                      logger.info({ tempPath }, `Cleaned up`);
                    } catch (error) {
                      logger.warn({ tempPath, error }, `Failed to cleanup`);
                    }
                  },
                });
                return;
              }

              logger.info(
                `File too small (${fileStats.size} bytes), waiting... (attempt ${attempts + 1}/${maxAttempts})`,
              );
            } catch (statError) {
              logger.info(
                `File not ready, waiting... (attempt ${attempts + 1}/${maxAttempts})`,
              );
            }

            attempts++;
            await new Promise((res) => setTimeout(res, delayMs));
          }

          // If we get here, file never became valid - log stderr for debugging
          logger.error({ stderrOutput }, "FFmpeg stderr output");
          reject(
            new Error(
              `Extracted file at ${tempPath} is too small or empty after ${maxAttempts} attempts. Check FFmpeg stderr above.`,
            ),
          );
        } catch (validationError) {
          logger.error({ stderrOutput }, "FFmpeg stderr output");
          reject(
            new Error(`Failed to validate extracted file: ${validationError}`),
          );
        }
      })
      .on("error", (err) => {
        logger.error({ err }, "FFmpeg error");
        logger.error({ stderrOutput }, "FFmpeg stderr");
        reject(new Error(`Failed to extract audio segment: ${err.message}`));
      })
      .save(tempPath);
  });
}
