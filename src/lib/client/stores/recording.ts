// ── Recording state store (Zustand) ──────────────────────────────────

import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────

export type RecordingStatus = "idle" | "recording" | "paused";

export interface RecordingState {
  /** Current recording status */
  status: RecordingStatus;
  /** Elapsed recording time in seconds (paused time excluded) */
  elapsedTime: number;
  /** Index of the current chunk being recorded */
  chunkIndex: number;
  /** User-facing error message, if any */
  error: string | null;
  /** AnalyserNode connected to the mic stream (for waveform viz) */
  analyserNode: AnalyserNode | null;
}

export interface RecordingActions {
  /** Set the recording status */
  setStatus: (status: RecordingStatus) => void;
  /** Increment elapsed time by 1 second */
  tick: () => void;
  /** Set elapsed time to an exact value (used by native plugin sync) */
  setElapsedTime: (seconds: number) => void;
  /** Reset elapsed time to 0 */
  resetTime: () => void;
  /** Increment the chunk index */
  nextChunk: () => void;
  /** Set an error message */
  setError: (error: string | null) => void;
  /** Store the AnalyserNode reference for waveform visualization */
  setAnalyserNode: (node: AnalyserNode | null) => void;
  /** Full reset to initial state */
  reset: () => void;
}

// ── Initial state ────────────────────────────────────────────────────

const initialState: RecordingState = {
  status: "idle",
  elapsedTime: 0,
  chunkIndex: 0,
  error: null,
  analyserNode: null,
};

// ── Store ────────────────────────────────────────────────────────────

export const useRecordingStore = create<RecordingState & RecordingActions>()(
  (set) => ({
    ...initialState,

    setStatus: (status) => set({ status, error: null }),
    tick: () => set((s) => ({ elapsedTime: s.elapsedTime + 1 })),
    setElapsedTime: (seconds) => set({ elapsedTime: seconds }),
    resetTime: () => set({ elapsedTime: 0 }),
    nextChunk: () => set((s) => ({ chunkIndex: s.chunkIndex + 1 })),
    setError: (error) => set({ error }),
    setAnalyserNode: (analyserNode) => set({ analyserNode }),
    reset: () => set(initialState),
  }),
);
