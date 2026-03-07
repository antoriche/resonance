// ── Whisper Speech-to-Text Implementation ──────────────────────────

import { extractAudioSegment } from "../utils/extract-segment";
import { whisperService } from "./whisper/index";

/**
 * Transcribe an audio segment using local Whisper
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
  console.log(
    `[speech-to-text] Processing segment: ${filePath} (${options.offset}s - ${options.offset + options.duration}s)`,
  );

  // Extract audio segment to temp file
  const segment = await extractAudioSegment(
    filePath,
    options.offset,
    options.duration,
  );

  try {
    // Transcribe the segment using Whisper
    const result = await whisperService.transcribe(segment.path);

    return {
      text: result.text,
    };
  } finally {
    // Always cleanup temp file
    await segment.cleanup();
  }
}
