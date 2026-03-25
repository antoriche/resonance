// ── OpenAI Whisper API Speech-to-Text Implementation ───────────────

import fs from "fs";
import OpenAI from "openai";
import { createLogger } from "@/lib/server/logger";
import { isSilentAudio } from "@/lib/server/audio/is-silent";
import { extractAudioSegment } from "../utils/extract-segment";

const logger = createLogger("speech-to-text");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function speachToText(
  filePath: string,
  options: {
    offset: number;
    duration: number;
  },
): Promise<{
  text: string;
}> {
  logger.info(
    `Processing segment via OpenAI API: ${filePath} (${options.offset}s - ${options.offset + options.duration}s)`,
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
    // Skip silent audio segments to avoid wasting an API call
    if (isSilentAudio(segment.path)) {
      logger.warn(`Silent audio segment, skipping API call`);
      return { text: "" };
    }

    // Transcribe the segment using OpenAI Whisper API
    const transcribeStartTime = Date.now();
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(segment.path),
      model: process.env.WHISPER_MODEL || "whisper-1",
    });
    const transcriptionTime = Date.now() - transcribeStartTime;

    logger.info(
      `Transcription took ${transcriptionTime}ms to process ${options.duration}ms of audio`,
    );

    return {
      text: response.text,
    };
  } finally {
    // Always cleanup temp file
    await segment.cleanup();
  }
}
