import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";
import { getFileByFilename } from "@/lib/db/operations";
import { audioProcessor } from "./audio-processor";
import { ALLOWED_EXTENSIONS } from "@/lib/audio/constants";
import { storageBasePath } from "./storage";
import { createLogger } from "@/lib/logger";

// ── Configuration ────────────────────────────────────────────

const logger = createLogger("file-watcher");

const FILE_WATCHER_ENABLED = process.env.FILE_WATCHER_ENABLED === "true";

// ── File Watcher Service ─────────────────────────────────────────────

class FileWatcher {
  private watcher: FSWatcher | null = null;

  /**
   * Start watching the uploads directory for new audio files
   */
  start() {
    if (!FILE_WATCHER_ENABLED) {
      logger.info("Disabled (set FILE_WATCHER_ENABLED=true to enable)");
      return;
    }

    if (!storageBasePath) {
      logger.error(
        "File watcher only works with FileStorage (local storage). Current storage is cloud-based.",
      );
      return;
    }

    const allowedExtensions = Array.from(ALLOWED_EXTENSIONS);
    const globPattern = `${storageBasePath}/**/*{${allowedExtensions.join(",")}}`;

    logger.info({ uploadDir: storageBasePath }, `Starting watcher`);
    logger.info(
      { extensions: allowedExtensions.join(", ") },
      `Watching extensions`,
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
      logger.error({ error }, "Error");
    });

    logger.info("Watcher started successfully");
  }

  /**
   * Stop watching
   */
  async stop() {
    if (this.watcher) {
      logger.info("Stopping watcher...");
      await this.watcher.close();
      this.watcher = null;
      logger.info("Watcher stopped");
    }
  }

  /**
   * Handle new file detection
   */
  private async handleNewFile(filePath: string) {
    try {
      const filename = path.basename(filePath);
      logger.info({ filename }, `New file detected`);

      // Check if file is already in database
      const existing = await getFileByFilename(filename);

      if (existing) {
        logger.info({ filename }, `File already processed`);
        return;
      }

      // Extract ID from filename (format: <uuid>.ext)
      const filenameWithoutExt = path.parse(filename).name;
      const audioFileId = filenameWithoutExt;

      // Trigger processing
      logger.info({ filename }, `Triggering processing`);
      await audioProcessor.syncFileData(filePath);

      logger.info({ filename }, `Processing initiated`);
    } catch (error) {
      logger.error({ filePath, error }, `Failed to process file`);
    }
  }
}

// ── Export singleton ─────────────────────────────────────────────────

export const fileWatcher = new FileWatcher();

// ── Graceful shutdown ────────────────────────────────────────────────

process.on("SIGINT", async () => {
  logger.info("\nReceived SIGINT, shutting down gracefully...");
  await fileWatcher.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("\nReceived SIGTERM, shutting down gracefully...");
  await fileWatcher.stop();
  process.exit(0);
});
