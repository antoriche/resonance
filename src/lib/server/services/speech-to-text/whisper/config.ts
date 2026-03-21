// ── Whisper Configuration ───────────────────────────────────────────

export interface WhisperConfig {
  modelName: string;
  modelPath?: string;
  whisperPath?: string;
}

/**
 * Get Whisper configuration from environment variables
 */
export function getWhisperConfig(): WhisperConfig {
  if (!process.env.WHISPER_MODEL) {
    throw new Error(
      "WHISPER_MODEL environment variable is required. Please set it to the name of the Whisper model you want to use (e.g. 'large-v3-turbo').",
    );
  }
  return {
    modelName: process.env.WHISPER_MODEL,
    modelPath: process.env.WHISPER_MODEL_PATH || undefined,
    whisperPath: process.env.WHISPER_PATH || undefined,
  };
}
