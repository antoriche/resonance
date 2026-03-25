"use client";

import {
  useRecordingStatus,
  useRecordingError,
  useRecordingControls,
  useWaveformData,
} from "@/hooks/recording";

import viewStyles from "./views.module.css";
import styles from "./RecordView.module.css";

const WAVEFORM_BARS = 48;

export default function RecordView() {
  const status = useRecordingStatus();
  const error = useRecordingError();
  const { toggle, pause, resume } = useRecordingControls();
  const waveform = useWaveformData();

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isActive = isRecording || isPaused;

  return (
    <div className={viewStyles.viewContainer}>
      <div className={`${viewStyles.viewContent} ${styles.container}`}>
        {/* Status */}
        <div className={styles.statusArea}>
          <div
            className={`${styles.statusDot} ${isRecording ? styles.statusDotRecording : ""} ${isPaused ? styles.statusDotPaused : ""}`}
          />
          <span className={`${styles.statusLabel} ${isActive ? styles.active : ""}`}>
            {isRecording ? "Recording" : isPaused ? "Paused" : "Ready"}
          </span>
        </div>

        {/* Central record area */}
        <div className={styles.recordArea}>
          {/* Waveform ring */}
          <div className={`${styles.waveformRing} ${isActive ? styles.waveformRingActive : ""}`}>
            <WaveformRing data={waveform} isRecording={isRecording} />
          </div>

          {/* Record / Stop button */}
          <button
            className={`${styles.recordButton} ${isRecording ? styles.recording : ""} ${isPaused ? styles.paused : ""}`}
            onClick={toggle}
            aria-label={isActive ? "Stop recording" : "Start recording"}
          >
            <span className={styles.pulseRing} />
            <span className={styles.buttonInner}>
              {isActive ? (
                <span className={styles.stopIcon} />
              ) : (
                <span className={styles.micIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Pause / Resume */}
        {isActive && (
          <button
            className={styles.secondaryButton}
            onClick={isRecording ? pause : resume}
          >
            {isRecording ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
            {isRecording ? "Pause" : "Resume"}
          </button>
        )}

        {/* Error */}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

// ── Circular waveform ────────────────────────────────────────────────

function WaveformRing({
  data,
  isRecording,
}: {
  data: Uint8Array | null;
  isRecording: boolean;
}) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const baseRadius = 90;

  const bars = new Array(WAVEFORM_BARS).fill(0).map((_, i) => {
    const value = data ? (data[i % data.length] ?? 0) : 0;
    const amplitude = data ? (value / 255) * 28 : 2;
    const angle = (i / WAVEFORM_BARS) * Math.PI * 2 - Math.PI / 2;
    const r1 = baseRadius;
    const r2 = baseRadius + Math.max(2, amplitude);
    return {
      x1: cx + Math.cos(angle) * r1,
      y1: cy + Math.sin(angle) * r1,
      x2: cx + Math.cos(angle) * r2,
      y2: cy + Math.sin(angle) * r2,
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={styles.waveformSvg}
    >
      {bars.map((bar, i) => (
        <line
          key={i}
          x1={bar.x1}
          y1={bar.y1}
          x2={bar.x2}
          y2={bar.y2}
          className={`${styles.waveformLine} ${isRecording ? styles.waveformLineRecording : ""}`}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
