/**
 * Mock implementation of speech-to-text
 * Used as fallback when Whisper is not available
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
  console.warn("[speech-to-text] Using mock implementation");
  return {
    text: `[MOCK] Transcription for ${filePath} (offset: ${options.offset}, duration: ${options.duration})`,
  };
}
