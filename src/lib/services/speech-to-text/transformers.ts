// ── Transformers Speech-to-Text Implementation ─────────────────────

import { createLogger } from "@/lib/logger";
import { extractAudioSegment } from "../utils/extract-segment";
import { transformersService } from "./transformers/index";

const logger = createLogger("speech-to-text");

/**
 * Transcribe an audio segment using Transformers.js
 * Note: Function name has typo "speach" for backward compatibility
 *
 * @param filePath - Path to the audio file
 * @param options - Transcription options (offset and duration in seconds)
 * @returns Transcription result with text
 */
export async function speachToText(
  filePath: string,
  options: {
    offset: number;
    duration: number;
  },
): Promise<{
  text: string;
}> {
  const startTime = Date.now();
  logger.info(
    `Processing segment: ${filePath} (${options.offset}s - ${options.offset + options.duration}s)`,
  );

  // Extract audio segment to temp file
  const segmentStartTime = Date.now();
  const segment = await extractAudioSegment(
    filePath,
    options.offset,
    options.duration,
  );
  const segmentExtractionTime = Date.now() - segmentStartTime;
  logger.info(`Segment extraction took ${segmentExtractionTime}ms`);

  try {
    // Transcribe the segment using Transformers
    const transcribeStartTime = Date.now();
    const result = await transformersService.transcribe(segment.path);
    const transcriptionTime = Date.now() - transcribeStartTime;

    logger.info(
      `Transcription took ${transcriptionTime}ms to process ${options.duration}ms of audio`,
    );

    return {
      text: result.text,
    };
  } finally {
    // Always cleanup temp file
    await segment.cleanup();
  }
}
