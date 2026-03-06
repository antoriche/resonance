import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// ── PostgreSQL schema ────────────────────────────────────────────────

export const transcriptions = pgTable("transcriptions", {
  id: text("id").primaryKey(),
  audioFileId: text("audio_file_id").notNull(),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  text: text("text"),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"],
  }).notNull(),
  duration: integer("duration"),
  error: text("error"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: "string" }),
});

// ── Export types ─────────────────────────────────────────────────────

export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;
