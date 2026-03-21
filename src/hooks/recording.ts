// ── Recording hooks ──────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FFT_SIZE } from "@/lib/audio/constants";
import { recordingService } from "@/lib/services/recording-service";
import { useRecordingStore } from "@/lib/stores/recording";

// ── Selector hooks ───────────────────────────────────────────────────

/** Current recording status */
export const useRecordingStatus = () => useRecordingStore((s) => s.status);

/** Elapsed recording time in seconds */
export const useRecordingElapsedTime = () =>
  useRecordingStore((s) => s.elapsedTime);

/** Current chunk index */
export const useRecordingChunkIndex = () =>
  useRecordingStore((s) => s.chunkIndex);

/** Error message (null when no error) */
export const useRecordingError = () => useRecordingStore((s) => s.error);

// ── Action hooks ─────────────────────────────────────────────────────

/** Recording controls bound to the RecordingService singleton */
export function useRecordingControls() {
  const start = useCallback(() => recordingService.start(), []);
  const stop = useCallback(() => recordingService.stop(), []);
  const pause = useCallback(() => recordingService.pause(), []);
  const resume = useCallback(() => recordingService.resume(), []);
  const toggle = useCallback(() => recordingService.toggle(), []);

  return { start, stop, pause, resume, toggle };
}

// ── Waveform data hook ───────────────────────────────────────────────

/**
 * Returns a Uint8Array of frequency-domain data (0–255 per bin)
 * updated at ~60 fps via requestAnimationFrame.
 *
 * The array length equals `analyser.frequencyBinCount` (FFT_SIZE / 2).
 * Returns `null` when not recording or no analyser is available.
 */
export function useWaveformData(): Uint8Array | null {
  const analyserNode = useRecordingStore((s) => s.analyserNode);
  const status = useRecordingStore((s) => s.status);
  const [data, setData] = useState<Uint8Array | null>(null);
  const rafRef = useRef<number>(0);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!analyserNode || status === "idle") {
      setData(null);
      return;
    }

    const binCount = analyserNode.frequencyBinCount; // FFT_SIZE / 2
    if (!bufferRef.current || bufferRef.current.length !== binCount) {
      bufferRef.current = new Uint8Array(binCount);
    }

    let active = true;

    const loop = () => {
      if (!active) return;
      analyserNode.getByteFrequencyData(bufferRef.current!);
      // Slice to trigger a new reference so React re-renders
      setData(new Uint8Array(bufferRef.current!));
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode, status]);

  return data;
}

// ── Formatted time ───────────────────────────────────────────────────

/** Format seconds into MM:SS */
export function formatElapsedTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
