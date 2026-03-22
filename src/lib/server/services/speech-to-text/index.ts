// ── Speech-to-Text Service ──────────────────────────────────────────

import { speachToText as mockSpeachToText } from "./mock";
import { speachToText as transformersSpeachToText } from "./transformers";

export async function speachToText(
  filePath: string,
  options: { offset: number; duration: number },
): Promise<{ text: string }> {
  if (process.env.DISABLE_SPEECH_TO_TEXT === "true") {
    return mockSpeachToText(filePath, options);
  }
  return transformersSpeachToText(filePath, options);
}
