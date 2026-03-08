import { nodewhisper } from "nodejs-whisper";
import { existsSync } from "fs";
import { resolve } from "path";
import { getWhisperConfig, type WhisperConfig } from "./config";
import { createLogger } from "@/lib/logger";

// ── Whisper Service ─────────────────────────────────────────

const logger = createLogger("whisper-service");

export interface TranscriptionOptions {
  language?: string;
  task?: "transcribe" | "translate";
  temperature?: number;
  modelPath?: string;
}

export interface TranscriptionResult {
  text: string;
  duration: number;
  language?: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

class WhisperService {
  private config: WhisperConfig;

  constructor(config?: Partial<WhisperConfig>) {
    const defaultConfig = getWhisperConfig();
    this.config = {
      ...defaultConfig,
      ...config,
    };
    logger.info(
      { model: this.config.modelName },
      `Initialized with model`,
    );
  }

  /**
   * Transcribe an audio file using local Whisper
   */
  async transcribe(
    audioFilePath: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    // Validate file exists
    if (!existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const startTime = Date.now();
    logger.info({ audioFilePath }, `Transcribing`);
    logger.info({ model: this.config.modelName }, `Using model`);

    try {
      // Resolve model path to absolute if provided
      const resolvedModelPath = this.config.modelPath
        ? resolve(process.cwd(), this.config.modelPath)
        : undefined;

      if (resolvedModelPath) {
        logger.info({ modelPath: resolvedModelPath }, `Using model path`);
        // Verify model file exists
        if (!existsSync(resolvedModelPath)) {
          throw new Error(`Model file not found at: ${resolvedModelPath}`);
        }
      }

      // Configure whisper options
      const whisperOptions: any = {
        modelName: this.config.modelName,
        // Only auto-download if no explicit model path is provided
        ...(!resolvedModelPath && {
          autoDownloadModelName: this.config.modelName,
        }),
        verbose: false,
        removeWavFileAfterTranscription: false,
        withCuda: false,
        // Use custom paths if provided
        ...(resolvedModelPath && { modelPath: resolvedModelPath }),
        ...(this.config.whisperPath && {
          executablePath: this.config.whisperPath,
        }),
        whisperOptions: {
          outputInText: false, // Get structured output
          outputInVtt: false,
          outputInSrt: false,
          outputInCsv: false,
          translateToEnglish: options?.task === "translate",
          language: options?.language || "auto",
          wordTimestamps: false,
          timestamps_length: 20,
          splitOnWord: true,
        },
      };

      // Call nodejs-whisper
      const output = await nodewhisper(audioFilePath, whisperOptions);

      const duration = Date.now() - startTime;
      logger.info({ duration }, `Transcription completed in ${duration}ms`);

      // Extract text from output
      const text = typeof output === "string" ? output : "";
      logger.info({ length: text.length }, `Text length: ${text.length} characters`);

      return {
        text: text.trim(),
        duration: duration / 1000, // Convert to seconds
      };
    } catch (error) {
      logger.error({ error }, "Transcription failed");

      if (
        error instanceof Error &&
        (error.message.includes("whisper: command not found") ||
          error.message.includes("not found"))
      ) {
        throw new Error(
          "Whisper not found. Please ensure nodejs-whisper is properly installed. Run: npx nodejs-whisper download",
        );
      }

      throw error;
    }
  }
}

// ── Export singleton ─────────────────────────────────────────────────

export const whisperService = new WhisperService();
