import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  vector,
  pgView,
} from "drizzle-orm/pg-core";
import { computedSpeakersSQL } from "./sql/dbscan";

// ── PostgreSQL schema ────────────────────────────────────────────────

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  filePath: text("file_path").notNull(),
  recordingTimestamp: timestamp("recording_timestamp").notNull(),
});

export const transcriptions = pgTable("transcriptions", {
  id: text("id").primaryKey(),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, {
      onDelete: "cascade",
    }),
  offset: integer("offset").notNull(),
  duration: integer("duration").notNull(),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: 256 }).notNull(),
});

export const computed_speakers = pgView("computed_speakers", {
  transcriptionId: text("transcription_id"),
  speakerId: text("speaker_id"),
}).as(sql.raw(computedSpeakersSQL().text));

// ── Export types ─────────────────────────────────────────────────────

export type File = typeof files.$inferSelect;
export type Transcription = typeof transcriptions.$inferSelect;
