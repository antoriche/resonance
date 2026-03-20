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

export const speakers = pgTable("speakers", {
  id: text("id").primaryKey(),
  name: text("name"),
  centroid: vector("centroid", { dimensions: 256 }).notNull(),
  segmentCount: integer("segment_count").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  speakerId: text("speaker_id").references(() => speakers.id, {
    onDelete: "set null",
  }),
});

export const computed_speakers = pgView("computed_speakers", {
  transcriptionId: text("transcription_id"),
  speakerId: text("speaker_id"),
}).as(sql.raw(computedSpeakersSQL().text));

// ── Export types ─────────────────────────────────────────────────────

export type File = typeof files.$inferSelect;
export type Speaker = typeof speakers.$inferSelect;
export type Transcription = typeof transcriptions.$inferSelect;
