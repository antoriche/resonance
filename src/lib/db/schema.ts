import { foreignKey } from "drizzle-orm/gel-core";
import {
  pgTable,
  text,
  integer,
  timestamp,
  vector,
  PgTableWithColumns,
} from "drizzle-orm/pg-core";

// ── PostgreSQL schema ────────────────────────────────────────────────

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  filePath: text("file_path").notNull(),
});

export const transcriptions = pgTable("transcriptions", {
  // FK to file, offset, duration, text, diaryId
  // create foreign key to files table
  id: text("id").primaryKey(),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, {
      onDelete: "cascade",
    }),
  offset: integer("offset").notNull(),
  duration: integer("duration").notNull(),
  text: text("text").notNull(),
  embeddings: vector("embeddings", { dimensions: 256 }).notNull(),
});

// ── Export types ─────────────────────────────────────────────────────

export type File = typeof files.$inferSelect;
export type Transcription = typeof transcriptions.$inferSelect;
