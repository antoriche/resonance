// ── Platform-agnostic microphone access ──────────────────────────────

import { Capacitor } from "@capacitor/core";

/**
 * On Capacitor native platforms, ensure the WebView bridge is ready
 * and that getUserMedia is available. On Android, Capacitor's
 * BridgeActivity handles the runtime RECORD_AUDIO permission prompt
 * automatically when getUserMedia is called — as long as the permission
 * is declared in AndroidManifest.xml.
 */
async function ensureCapacitorMicPermissions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // On iOS 14.3+ WKWebView and Android Capacitor WebView,
  // getUserMedia should be available. Verify it exists before
  // attempting to use it, and provide a clear error if not.
  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    throw new MicAccessError(
      "Microphone access is not available on this device. " +
        "Please ensure the app has microphone permissions in your device settings.",
    );
  }
}

/**
 * Request microphone access and return a MediaStream.
 *
 * On Capacitor native platforms, native permission declarations
 * (NSMicrophoneUsageDescription on iOS, RECORD_AUDIO on Android)
 * allow the WebView to prompt for mic access via getUserMedia.
 */
export async function getMicStream(): Promise<MediaStream> {
  // Ensure native permissions are available on Capacitor
  await ensureCapacitorMicPermissions();
  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    throw new MicAccessError(
      "Microphone access is not supported in this browser.",
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (err) {
    if (err instanceof DOMException) {
      switch (err.name) {
        case "NotAllowedError":
          throw new MicAccessError(
            Capacitor.isNativePlatform()
              ? "Microphone permission was denied. Please allow access in your device settings."
              : "Microphone permission was denied. Please allow access in your browser settings.",
          );
        case "NotFoundError":
          throw new MicAccessError(
            "No microphone found. Please connect a microphone and try again.",
          );
        case "NotReadableError":
          throw new MicAccessError(
            "Microphone is already in use by another application.",
          );
        case "AbortError":
        case "SecurityError":
          throw new MicAccessError(
            Capacitor.isNativePlatform()
              ? "Microphone access was blocked by the system. Check app permissions in Settings."
              : `Microphone error: ${err.message}`,
          );
        default:
          throw new MicAccessError(`Microphone error: ${err.message}`);
      }
    }
    throw new MicAccessError("Failed to access microphone.");
  }
}

/**
 * Stop all tracks on a MediaStream (releases the microphone).
 */
export function releaseMicStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

// ── Custom error ─────────────────────────────────────────────────────

export class MicAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicAccessError";
  }
}
