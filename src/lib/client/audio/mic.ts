// ── Platform-agnostic microphone access ──────────────────────────────

/**
 * Request microphone access and return a MediaStream.
 *
 * On both web and Capacitor WebView the native getUserMedia is used.
 * If a Capacitor mic plugin is installed in the future, permission
 * requests can go through it before falling back to getUserMedia.
 */
export async function getMicStream(): Promise<MediaStream> {
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
            "Microphone permission was denied. Please allow access in your browser settings.",
          );
        case "NotFoundError":
          throw new MicAccessError(
            "No microphone found. Please connect a microphone and try again.",
          );
        case "NotReadableError":
          throw new MicAccessError(
            "Microphone is already in use by another application.",
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
