import { readFileSync } from "fs";
import { WaveFile } from "wavefile";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger("audio:silence-detection");

/** RMS threshold below which audio is considered silent (normalized [-1, 1] scale) */
const DEFAULT_RMS_THRESHOLD = 0.01;

/**
 * Check whether a WAV file contains only silence / near-silence.
 *
 * Computes the RMS (Root Mean Square) energy of the audio samples.
 * RMS is the standard measure of signal power in audio engineering —
 * it weights louder samples more than quiet ones, giving a meaningful
 * representation of perceived loudness.
 *
 * @param filePath  Path to a WAV file (16-bit PCM expected)
 * @param threshold RMS below this value → considered silent (default 0.01)
 * @returns `true` when the audio is effectively silent
 */
export function isSilentAudio(
  filePath: string,
  threshold = DEFAULT_RMS_THRESHOLD,
): boolean {
  const buffer = readFileSync(filePath);
  const wav = new WaveFile(buffer);
  const fmt = wav.fmt as { bitsPerSample: number; numChannels: number };

  const samples = wav.getSamples(true, Float32Array) as
    | Float32Array
    | Float64Array;

  if (!samples || samples.length === 0) {
    logger.warn({ filePath }, "No samples found, treating as silent");
    return true;
  }

  // Normalize to [-1, 1] (wavefile returns raw integer-scale values for PCM)
  const maxValue = Math.pow(2, fmt.bitsPerSample - 1);

  // For stereo, getSamples(true) interleaves [L, R, L, R, …] — use all samples,
  // the RMS over the interleaved stream is equivalent to overall energy.
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const normalized = samples[i] / maxValue;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / samples.length);

  logger.info(
    { filePath, rms: rms.toFixed(6), threshold },
    `Silence check: RMS=${rms.toFixed(6)}, threshold=${threshold}`,
  );

  return rms < threshold;
}
