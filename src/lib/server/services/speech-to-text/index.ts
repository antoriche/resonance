// ── Speech-to-Text Service ──────────────────────────────────────────

import { speachToText as apiWhisperSpeachToText } from "./api-whisper";
import { speachToText as mockSpeachToText } from "./mock";
import { speachToText as transformersSpeachToText } from "./transformers";

export async function speachToText(
  filePath: string,
  options: { offset: number; duration: number },
): Promise<{ text: string }> {
  switch (process.env.SPEECH_TO_TEXT_ENGINE) {
    case "MOCK":
      return mockSpeachToText(filePath, options);
    case "LOCAL_WHISPER":
      return transformersSpeachToText(filePath, options);
    case "API_WHISPER":
      return apiWhisperSpeachToText(filePath, options);
    default:
      throw new Error(
        `Invalid SPEECH_TO_TEXT_ENGINE: "${process.env.SPEECH_TO_TEXT_ENGINE}". Must be "MOCK", "LOCAL_WHISPER", or "API_WHISPER".`,
      );
  }
}
