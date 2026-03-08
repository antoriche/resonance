// ── Centralized Logger ─────────────────────────────────────────────

import pino from "pino";

/**
 * Create the base pino logger instance
 * In development, use pino-pretty for readable logs
 * In production, use JSON format for structured logging
 */
const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

/**
 * Create a contextualized logger with a namespace/module name
 * This replaces the [tag] prefix pattern used with console.log
 *
 * @param context - The context/module name (e.g., 'speech-to-text', 'audio-processor')
 * @returns Logger instance with context
 *
 * @example
 * const logger = createLogger('audio-processor');
 * logger.info('Processing started', { fileId: '123' });
 * logger.error('Processing failed', { error, fileId: '123' });
 */
export function createLogger(context: string) {
  return baseLogger.child({ context });
}

/**
 * Default logger for general use
 */
export const logger = baseLogger;

/**
 * Type-safe logger interface for easier IDE autocomplete
 */
export type Logger = ReturnType<typeof createLogger>;
