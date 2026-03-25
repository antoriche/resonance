import { registerPlugin } from "@capacitor/core";

export interface RecordingResult {
  recordingId: string;
  status: "recording" | "paused" | "idle";
  elapsedSeconds?: number;
}

export interface ResonanceRecorderPlugin {
  startRecording(): Promise<RecordingResult>;
  stopRecording(): Promise<RecordingResult>;
  pauseRecording(): Promise<RecordingResult>;
  resumeRecording(): Promise<RecordingResult>;
  getRecordingStatus(): Promise<RecordingResult>;
  setAutoRecordEnabled(options: {
    enabled: boolean;
  }): Promise<{ enabled: boolean }>;
  getAutoRecordEnabled(): Promise<{ enabled: boolean }>;
  addListener(
    eventName: "recordingTick",
    listenerFunc: (data: { elapsedSeconds: number; status: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const ResonanceRecorder =
  registerPlugin<ResonanceRecorderPlugin>("ResonanceRecorder");

export default ResonanceRecorder;
