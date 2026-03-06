import { randomUUID } from "node:crypto";
import type { Transcription, NewTranscription } from "@/lib/db/schema";
import {
  insertTranscription,
  updateTranscription,
  getTranscriptionById,
  getAllTranscriptions,
} from "@/lib/db/operations";

// ── Types ────────────────────────────────────────────────────────────

export interface AudioMetadata {
  id: string;
  filename: string;
}

export interface ProcessingResult {
  transcriptionId: string;
  status: "completed" | "failed";
  text?: string;
  duration?: number;
  error?: string;
}

// ── Audio Processor Service ──────────────────────────────────────────

class AudioProcessor {
  /**
   * Process an audio file: transcribe it and store results in DB
   */
  async processAudioFile(
    filePath: string,
    metadata: AudioMetadata,
  ): Promise<ProcessingResult> {
    const transcriptionId = randomUUID();

    try {
      // Create initial record with 'pending' status
      const newTranscription: NewTranscription = {
        id: transcriptionId,
        audioFileId: metadata.id,
        filename: metadata.filename,
        filePath,
        status: "pending",
        text: null,
        duration: null,
        error: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };

      await insertTranscription(newTranscription);
      console.log(
        `[audio-processor] Created transcription record: ${transcriptionId}`,
      );

      // Update status to 'processing'
      await updateTranscription(transcriptionId, { status: "processing" });

      // Perform transcription (stubbed for now)
      const result = await this.transcribeAudio(filePath);

      // Update record with successful result
      await updateTranscription(transcriptionId, {
        status: "completed",
        text: result.text,
        duration: result.duration,
        completedAt: new Date().toISOString(),
      });

      console.log(
        `[audio-processor] Transcription completed: ${transcriptionId}`,
      );

      return {
        transcriptionId,
        status: "completed",
        text: result.text,
        duration: result.duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update record with failure
      await updateTranscription(transcriptionId, {
        status: "failed",
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });

      console.error(
        `[audio-processor] Transcription failed: ${transcriptionId}`,
        error,
      );

      return {
        transcriptionId,
        status: "failed",
        error: errorMessage,
      };
    }
  }

  /**
   * Get transcription by ID
   */
  async getTranscription(id: string): Promise<Transcription | null> {
    return await getTranscriptionById(id);
  }

  /**
   * Get all transcriptions
   */
  async getAllTranscriptions(): Promise<Transcription[]> {
    return await getAllTranscriptions();
  }

  /**
   * Stub transcription function
   * TODO: Replace with actual transcription service (Whisper API, local Whisper, etc.)
   */
  private async transcribeAudio(
    filePath: string,
  ): Promise<{ text: string; duration: number }> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Return stub result
    return {
      text: `[Transcription pending - service not implemented for ${filePath}]`,
      duration: 0,
    };
  }
}

// ── Export singleton ─────────────────────────────────────────────────

export const audioProcessor = new AudioProcessor();
