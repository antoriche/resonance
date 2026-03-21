"use client";

import {
  useRecordingStatus,
  useRecordingElapsedTime,
  useRecordingError,
  useRecordingControls,
  useWaveformData,
  formatElapsedTime,
} from "@/hooks/recording";

import viewStyles from "./views.module.css";
import styles from "./RecordView.module.css";

// Number of bars to render in the waveform
const WAVEFORM_BARS = 64;

export default function RecordView() {
  const status = useRecordingStatus();
  const elapsed = useRecordingElapsedTime();
  const error = useRecordingError();
  const { toggle, pause, resume } = useRecordingControls();
  const waveform = useWaveformData();

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isActive = isRecording || isPaused;

  return (
    <div className={viewStyles.viewContainer}>
      <div className={`${viewStyles.viewContent} ${styles.container}`}>
        {/* Status label */}
        <span
          className={`${styles.statusLabel} ${isActive ? styles.active : ""}`}
        >
          {isRecording ? "Recording" : isPaused ? "Paused" : "Tap to record"}
        </span>

        {/* Timer */}
        <div className={`${styles.timer} ${!isActive ? styles.timerIdle : ""}`}>
          {formatElapsedTime(elapsed)}
        </div>

        {/* Waveform visualizer */}
        <Waveform data={waveform} isRecording={isRecording} />

        {/* Record / Stop button */}
        <button
          className={`${styles.recordButton} ${isRecording ? styles.recording : ""} ${isPaused ? styles.paused : ""}`}
          onClick={toggle}
          aria-label={isActive ? "Stop recording" : "Start recording"}
        >
          <span className={styles.pulseRing} />
          {isActive ? (
            <span className={styles.stopSquare} />
          ) : (
            <span className={styles.recordDot} />
          )}
        </button>

        {/* Pause / Resume (visible only while active) */}
        {isActive && (
          <div className={styles.secondaryControls}>
            {isRecording ? (
              <button className={styles.secondaryButton} onClick={pause}>
                Pause
              </button>
            ) : (
              <button className={styles.secondaryButton} onClick={resume}>
                Resume
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

// ── Waveform sub-component ───────────────────────────────────────────

function Waveform({
  data,
  isRecording,
}: {
  data: Uint8Array | null;
  isRecording: boolean;
}) {
  // When idle or no data, show flat placeholder bars
  const bars = new Array(WAVEFORM_BARS).fill(0).map((_, i) => {
    // Map frequency data to bar height (3–80 px)
    const value = data ? (data[i % data.length] ?? 0) : 0;
    const height = data ? Math.max(3, (value / 255) * 80) : 3;
    return height;
  });

  return (
    <div
      className={`${styles.waveformContainer} ${!data ? styles.waveformIdle : ""}`}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          className={`${styles.waveformBar} ${isRecording ? styles.recording : ""}`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
