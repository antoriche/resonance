import type { AutomaticSpeechRecognitionPipeline } from "@xenova/transformers";
import { WaveFile } from "wavefile";
import { readFileSync } from "fs";
import { createLogger } from "@/lib/server/logger";

// Lazily load @xenova/transformers to avoid loading the native onnxruntime
// binary at module evaluation time (which fails on Vercel serverless).
async function loadPipeline(
  ...args: Parameters<typeof import("@xenova/transformers").pipeline>
): Promise<AutomaticSpeechRecognitionPipeline> {
  const { pipeline, env } = await import("@xenova/transformers");
  // Force single-threaded WASM — SharedArrayBuffer is not available in
  // Vercel serverless, which breaks the threaded WASM backend.
  (env.backends as any).onnx.wasm.numThreads = 1;
  return (await pipeline(...args)) as AutomaticSpeechRecognitionPipeline;
}

// ── Transformers Service ────────────────────────────────────────────

const logger = createLogger("transformers-service");

export interface TranscriptionOptions {
  language?: string;
  task?: "transcribe" | "translate";
  chunk_length_s?: number;
  stride_length_s?: number;
}

export interface TranscriptionResult {
  text: string;
  duration: number;
  language?: string;
}

class TransformersService {
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null;
  private modelName: string;
  private isInitializing: boolean = false;

  constructor(modelName?: string) {
    const defaultModel = process.env.WHISPER_MODEL || "base";
    this.modelName = modelName || `Xenova/whisper-${defaultModel}`;
    logger.info(`Initialized with model: ${this.modelName}`);
  }

  /**
   * Initialize the speech recognition pipeline
   */
  private async initialize(): Promise<void> {
    if (this.transcriber) {
      return;
    }

    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;
    logger.info(`Loading model: ${this.modelName}`);

    try {
      this.transcriber = await loadPipeline(
        "automatic-speech-recognition",
        this.modelName,
      );
      logger.info(`Model loaded successfully`);
    } catch (error) {
      logger.error({ error }, "Failed to load model");
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Load and decode audio file to raw audio data
   */
  private loadAudioData(audioFilePath: string): Float32Array | null {
    try {
      // Read the audio file
      const buffer = readFileSync(audioFilePath);

      // Decode WAV file
      const wav = new WaveFile(buffer);

      // Type assertion for fmt object
      const fmt = wav.fmt as any;

      logger.info(
        `Original audio: ${fmt.sampleRate}Hz, ${fmt.numChannels} channel(s), ${fmt.bitsPerSample}-bit`,
      );

      // Try to get samples
      const samples = wav.getSamples(true, Float32Array) as
        | Float32Array
        | Float64Array;

      // Check if WAV file is empty
      if (!samples || samples.length === 0) {
        logger.warn({ audioFilePath }, `Empty WAV file detected, skipping`);
        return null;
      }

      // Convert to 16kHz if needed (Whisper expects 16kHz)
      if (fmt.sampleRate !== 16000) {
        wav.toSampleRate(16000);
        logger.info(`Resampled to 16kHz`);
      }

      let audioData: Float32Array;

      // Ensure samples is Float32Array
      const samplesFloat32 =
        samples instanceof Float32Array ? samples : new Float32Array(samples);

      // For mono, samples is already what we need
      // For stereo with interleaved=true, we need to extract only one channel
      if (fmt.numChannels === 1) {
        audioData = samplesFloat32;
      } else {
        // Stereo interleaved: samples = [L, R, L, R, L, R, ...]
        // Extract only left channel
        const numSamples = Math.floor(samplesFloat32.length / fmt.numChannels);
        audioData = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          audioData[i] = samplesFloat32[i * fmt.numChannels];
        }
      }

      // Normalize audio data to [-1.0, 1.0] range
      // WaveFile returns samples in their original scale (e.g., 16-bit = -32768 to +32767)
      // Whisper expects normalized float values
      const maxValue = Math.pow(2, fmt.bitsPerSample - 1);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = audioData[i] / maxValue;
      }

      logger.info(
        `Loaded audio: ${audioData.length} samples at 16kHz (${(audioData.length / 16000).toFixed(2)}s)`,
      );

      return audioData;
    } catch (error) {
      logger.error({ error }, "Failed to load audio data");
      throw new Error(`Failed to decode audio file: ${error}`);
    }
  }

  /**
   * Transcribe an audio file using Transformers.js
   */
  async transcribe(
    audioFilePath: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    logger.info({ audioFilePath }, `Transcribing`);

    try {
      // Ensure model is loaded
      await this.initialize();

      if (!this.transcriber) {
        throw new Error("Transcriber not initialized");
      }

      // Load and decode audio data
      const audioData = this.loadAudioData(audioFilePath);

      // Skip empty audio files
      if (!audioData || audioData.length === 0) {
        logger.warn(`Skipping empty audio file`);
        return {
          text: "",
          duration: (Date.now() - startTime) / 1000,
        };
      }

      // Configure transcription options
      const transcribeOptions: any = {
        chunk_length_s: options?.chunk_length_s || 30,
        stride_length_s: options?.stride_length_s || 5,
        task: options?.task || "transcribe",
      };

      // Only set language if explicitly provided (otherwise auto-detect)
      if (options?.language) {
        transcribeOptions.language = options.language;
      }

      logger.info({ transcribeOptions }, `Transcription options`);

      // Calculate min/max without spread operator to avoid stack overflow on large arrays
      let min = audioData[0];
      let max = audioData[0];
      for (let i = 1; i < audioData.length; i++) {
        if (audioData[i] < min) min = audioData[i];
        if (audioData[i] > max) max = audioData[i];
      }

      logger.info(
        `Audio data stats: length=${audioData.length}, min=${min.toFixed(3)}, max=${max.toFixed(3)}`,
      );

      // Run transcription with raw audio data
      const output = await this.transcriber(audioData, transcribeOptions);

      const duration = Date.now() - startTime;
      logger.info(`Transcription completed in ${duration}ms`);
      logger.info({ output }, `Output`);

      // Extract text from output
      let text = "";
      if (typeof output === "string") {
        text = output;
      } else if (Array.isArray(output)) {
        // If output is an array, concatenate all text chunks
        text = output.map((chunk: any) => chunk.text || "").join(" ");
      } else if (output && typeof output === "object") {
        // Check for text property
        if ("text" in output) {
          text = output.text || "";
        } else {
          throw new Error(
            `Unexpected output format: ${JSON.stringify(output)}`,
          );
        }
        // Check for chunks with timestamps
        // else if ("chunks" in output && Array.isArray(output.chunks)) {
        //   text = output.chunks.map((chunk: any) => chunk.text || "").join(" ");
        // }
      }

      logger.info(`Extracted text: "${text}"`);
      logger.info(`Text length: ${text.length} characters`);

      return {
        text: text.trim(),
        duration: duration / 1000, // Convert to seconds
      };
    } catch (error) {
      logger.error({ error }, "Transcription failed");
      throw error;
    }
  }

  /**
   * Change the model (useful for switching between model sizes)
   */
  async setModel(modelName: string): Promise<void> {
    logger.info({ modelName }, `Switching to model`);
    this.modelName = modelName;
    this.transcriber = null; // Force re-initialization
    await this.initialize();
  }
}

// ── Export singleton ─────────────────────────────────────────────────

export const transformersService = new TransformersService();
