#!/usr/bin/env tsx

/**
 * File watcher script for processing audio files
 *
 * This script watches the uploads directory for new audio files and
 * automatically triggers transcription processing.
 *
 * Usage:
 *   npm run watch:uploads
 *
 * Or with environment variables:
 *   FILE_WATCHER_ENABLED=true npm run watch:uploads
 */

import { fileWatcher } from "../src/lib/services/file-watcher";

console.log("=".repeat(60));
console.log("Audio File Watcher");
console.log("=".repeat(60));
console.log("");

// Start the watcher
fileWatcher.start();

// Keep the process alive
console.log("\nPress Ctrl+C to stop watching...\n");
