/**
 * Mock implementation of speech-to-text
 * Used as fallback when Whisper is not available
 */
import { createLogger } from "@/lib/server/logger";

const logger = createLogger("speech-to-text");

export async function speachToText(
  filePath: string,
  options: {
    offset: number;
    duration: number;
  },
): Promise<{
  text: string;
}> {
  logger.warn("Using mock implementation");
  return {
    text: `[MOCK] Transcription for ${filePath} (offset: ${options.offset}, duration: ${options.duration})`,
  };
}
