import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";
import { getTranscriptionByFilename } from "@/lib/db/operations";
import { audioProcessor } from "./audio-processor";
import { UPLOAD_DIR, ALLOWED_EXTENSIONS } from "@/lib/audio/constants";

// ── Configuration ────────────────────────────────────────────────────

const FILE_WATCHER_ENABLED = process.env.FILE_WATCHER_ENABLED === "true";

// ── File Watcher Service ─────────────────────────────────────────────

class FileWatcher {
  private watcher: FSWatcher | null = null;

  /**
   * Start watching the uploads directory for new audio files
   */
  start() {
    if (!FILE_WATCHER_ENABLED) {
      console.log(
        "[file-watcher] Disabled (set FILE_WATCHER_ENABLED=true to enable)",
      );
      return;
    }

    const allowedExtensions = Array.from(ALLOWED_EXTENSIONS);
    const globPattern = `${UPLOAD_DIR}/**/*{${allowedExtensions.join(",")}}`;

    console.log(`[file-watcher] Starting watcher on: ${UPLOAD_DIR}`);
    console.log(
      `[file-watcher] Watching extensions: ${allowedExtensions.join(", ")}`,
    );

    this.watcher = chokidar.watch(globPattern, {
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Wait 2s after write stops
        pollInterval: 100,
      },
    });

    this.watcher.on("add", (filePath: string) => this.handleNewFile(filePath));
    this.watcher.on("error", (error: unknown) => {
      console.error("[file-watcher] Error:", error);
    });

    console.log("[file-watcher] Watcher started successfully");
  }

  /**
   * Stop watching
   */
  async stop() {
    if (this.watcher) {
      console.log("[file-watcher] Stopping watcher...");
      await this.watcher.close();
      this.watcher = null;
      console.log("[file-watcher] Watcher stopped");
    }
  }

  /**
   * Handle new file detection
   */
  private async handleNewFile(filePath: string) {
    try {
      const filename = path.basename(filePath);
      console.log(`[file-watcher] New file detected: ${filename}`);

      // Check if file is already in database
      const existing = await getTranscriptionByFilename(filename);

      if (existing) {
        console.log(`[file-watcher] File already processed: ${filename}`);
        return;
      }

      // Extract ID from filename (format: <uuid>.ext)
      const filenameWithoutExt = path.parse(filename).name;
      const audioFileId = filenameWithoutExt;

      // Trigger processing
      console.log(`[file-watcher] Triggering processing for: ${filename}`);
      await audioProcessor.processAudioFile(filePath, {
        id: audioFileId,
        filename,
      });

      console.log(`[file-watcher] Processing initiated for: ${filename}`);
    } catch (error) {
      console.error(
        `[file-watcher] Failed to process file: ${filePath}`,
        error,
      );
    }
  }
}

// ── Export singleton ─────────────────────────────────────────────────

export const fileWatcher = new FileWatcher();

// ── Graceful shutdown ────────────────────────────────────────────────

process.on("SIGINT", async () => {
  console.log("\n[file-watcher] Received SIGINT, shutting down gracefully...");
  await fileWatcher.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[file-watcher] Received SIGTERM, shutting down gracefully...");
  await fileWatcher.stop();
  process.exit(0);
});
