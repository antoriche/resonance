// ── Client-side Recording Service ────────────────────────────────────
//
// Singleton that manages the full recording lifecycle.
//
// On iOS native: delegates to the ResonanceRecorder Capacitor plugin
//   (AVAudioRecorder + Live Activity / Dynamic Island).
// On web: uses MediaRecorder + getUserMedia (original path).
//
// Lives outside React; pushes state into the Zustand store so any
// component can subscribe.
// ─────────────────────────────────────────────────────────────────────

import axios from "axios";
import { Capacitor } from "@capacitor/core";

import {
  CHUNK_DURATION_MS,
  RECORDING_MIME_TYPE,
  RECORDING_MIME_FALLBACKS,
  FFT_SIZE,
} from "@/lib/shared/audio/constants";
import { getMicStream, releaseMicStream } from "@/lib/client/audio/mic";
import {
  extractWebmInitSegment,
  prependInitSegment,
} from "@/lib/client/audio/webm-header";
import { useRecordingStore } from "@/lib/client/stores/recording";
import ResonanceRecorder from "@/lib/client/plugins/resonance-recorder";

// ── Helpers ──────────────────────────────────────────────────────────

/** Pick the first supported MIME type for MediaRecorder */
function pickMimeType(): string {
  if (MediaRecorder.isTypeSupported(RECORDING_MIME_TYPE)) {
    return RECORDING_MIME_TYPE;
  }
  for (const fallback of RECORDING_MIME_FALLBACKS) {
    if (MediaRecorder.isTypeSupported(fallback)) {
      return fallback;
    }
  }
  // Let the browser pick its default
  return "";
}

// ── Service ──────────────────────────────────────────────────────────

class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private mimeType = "";
  private tickListener: { remove: () => Promise<void> } | null = null;
  /** WebM init segment (EBML+Tracks) captured from the first chunk */
  private webmInitSegment: Uint8Array | null = null;
  private isFirstChunk = true;

  constructor() {
    // On iOS, listen for native state changes (auto-record start/stop)
    // so the Zustand store stays in sync even when JS didn't initiate recording.
    if (Capacitor.getPlatform() === "ios") {
      ResonanceRecorder.addListener("recordingStateChange", (data) => {
        const store = useRecordingStore.getState();
        if (data.status === "recording" && store.status !== "recording") {
          store.setStatus("recording");
          store.resetTime();
          this.ensureTickListener();
        } else if (data.status === "idle" && store.status !== "idle") {
          store.setStatus("idle");
          store.setElapsedTime(data.elapsedSeconds);
          this.removeTickListener();
        }
      });
    }
  }

  private async ensureTickListener(): Promise<void> {
    if (this.tickListener) return;
    this.tickListener = await ResonanceRecorder.addListener(
      "recordingTick",
      (data) => {
        useRecordingStore.getState().setElapsedTime(data.elapsedSeconds);
      },
    );
  }

  // ── Store shorthand ────────────────────────────────────────────

  private get store() {
    return useRecordingStore.getState();
  }

  private get isNativeIOS(): boolean {
    return Capacitor.getPlatform() === "ios";
  }

  // ── Public API ─────────────────────────────────────────────────

  async start(): Promise<void> {
    const { status } = this.store;
    if (status === "recording") return;

    if (this.isNativeIOS) {
      return this.startNative();
    }
    return this.startWeb();
  }

  stop(): void {
    if (this.isNativeIOS) {
      this.stopNative();
    } else {
      this.stopWeb();
    }
  }

  pause(): void {
    if (this.isNativeIOS) {
      this.pauseNative();
    } else {
      this.pauseWeb();
    }
  }

  resume(): void {
    if (this.isNativeIOS) {
      this.resumeNative();
    } else {
      this.resumeWeb();
    }
  }

  /** Toggle between start/stop */
  toggle(): void {
    const { status } = this.store;
    if (status === "idle") {
      this.start();
    } else {
      this.stop();
    }
  }

  // ── Native iOS (AVAudioRecorder + Live Activity) ───────────────

  private async startNative(): Promise<void> {
    // Update UI immediately for responsiveness
    this.store.setStatus("recording");
    this.store.resetTime();

    try {
      this.tickListener = await ResonanceRecorder.addListener(
        "recordingTick",
        (data) => {
          useRecordingStore.getState().setElapsedTime(data.elapsedSeconds);
        },
      );

      await ResonanceRecorder.startRecording();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start recording.";
      this.store.setError(message);
      this.store.setStatus("idle");
    }
  }

  private stopNative(): void {
    this.store.setStatus("idle");
    this.removeTickListener();
    ResonanceRecorder.stopRecording().catch((err) => {
      console.error(
        "[recording-service] Failed to stop native recording:",
        err,
      );
    });
  }

  private pauseNative(): void {
    this.store.setStatus("paused");
    ResonanceRecorder.pauseRecording().catch((err) => {
      console.error(
        "[recording-service] Failed to pause native recording:",
        err,
      );
    });
  }

  private resumeNative(): void {
    this.store.setStatus("recording");
    ResonanceRecorder.resumeRecording().catch((err) => {
      console.error(
        "[recording-service] Failed to resume native recording:",
        err,
      );
    });
  }

  private removeTickListener(): void {
    if (this.tickListener) {
      this.tickListener.remove();
      this.tickListener = null;
    }
  }

  // ── Web (MediaRecorder) ────────────────────────────────────────

  private async startWeb(): Promise<void> {
    try {
      // 1. Acquire microphone
      this.stream = await getMicStream();

      // 2. Verify MediaRecorder is available (not on all WebViews)
      if (typeof MediaRecorder === "undefined") {
        throw new Error(
          "Recording is not supported on this device. Please update your OS.",
        );
      }

      // 3. Set up AudioContext + AnalyserNode for waveform viz
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      this.store.setAnalyserNode(analyser);

      // 4. Create MediaRecorder with timeslice-based chunking
      this.mimeType = pickMimeType();
      const options: MediaRecorderOptions = {};
      if (this.mimeType) options.mimeType = this.mimeType;

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.handleChunk(event.data);
          this.store.nextChunk();
        }
      };

      this.mediaRecorder.onerror = () => {
        this.store.setError("Recording failed unexpectedly.");
        this.cleanup();
      };

      this.mediaRecorder.onstop = () => {
        // Final cleanup is handled in stopWeb()
      };

      // 5. Start recording with timeslice → fires ondataavailable every CHUNK_DURATION_MS
      this.mediaRecorder.start(CHUNK_DURATION_MS);

      // 6. Update store
      this.store.setStatus("recording");
      this.store.resetTime();

      // 7. Start elapsed-time ticker
      this.startTimer();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start recording.";
      this.store.setError(message);
      this.cleanup();
    }
  }

  private stopWeb(): void {
    if (!this.mediaRecorder) return;

    // requestData() flushes the final partial chunk before stopping
    if (this.mediaRecorder.state === "recording") {
      this.mediaRecorder.requestData();
    }
    if (this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    this.cleanup();
    this.store.setStatus("idle");
  }

  private pauseWeb(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.pause();
      this.stopTimer();
      this.store.setStatus("paused");
    }
  }

  private resumeWeb(): void {
    if (this.mediaRecorder?.state === "paused") {
      this.mediaRecorder.resume();
      this.startTimer();
      this.store.setStatus("recording");
    }
  }

  // ── Chunk handling ─────────────────────────────────────────────

  /**
   * On the first chunk, extract the WebM init segment (EBML header +
   * Segment info + Tracks). On subsequent chunks, prepend the init
   * segment so each upload is a valid standalone WebM file that
   * FFmpeg can parse independently.
   */
  private async handleChunk(blob: Blob): Promise<void> {
    if (this.isFirstChunk) {
      this.isFirstChunk = false;

      // Only relevant for WebM — other containers don't have this issue
      if (this.mimeType.includes("webm") || !this.mimeType) {
        this.webmInitSegment = await extractWebmInitSegment(blob);
      }

      // First chunk is always valid as-is
      return this.uploadChunk(blob);
    }

    // Subsequent WebM chunks need the init segment prepended
    if (this.webmInitSegment) {
      const completeBlob = prependInitSegment(this.webmInitSegment, blob);
      return this.uploadChunk(completeBlob);
    }

    return this.uploadChunk(blob);
  }

  // ── Chunk upload ───────────────────────────────────────────────

  private async uploadChunk(blob: Blob): Promise<void> {
    let extension = "webm";
    if (this.mimeType.includes("mp4")) {
      extension = "m4a";
    } else if (this.mimeType.includes("ogg")) {
      extension = "ogg";
    } else if (this.mimeType.includes("webm") || !this.mimeType) {
      extension = "webm";
    }
    const filename = `chunk-${Date.now()}.${extension}`;

    const formData = new FormData();
    formData.append("file", blob, filename);

    try {
      await axios.post("/api/audio/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (err) {
      // Retry once
      try {
        await axios.post("/api/audio/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch {
        console.error("[recording-service] Failed to upload chunk:", err);
        // Non-fatal — recording continues, failed chunk is lost
      }
    }
  }

  // ── Timer ──────────────────────────────────────────────────────

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.store.tick();
    }, 1_000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────

  private cleanup(): void {
    this.stopTimer();

    if (this.stream) {
      releaseMicStream(this.stream);
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.store.setAnalyserNode(null);
    this.mediaRecorder = null;
    this.webmInitSegment = null;
    this.isFirstChunk = true;
  }
}

// ── Singleton export ─────────────────────────────────────────────────

export const recordingService = new RecordingService();
