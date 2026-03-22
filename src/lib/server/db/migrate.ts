import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger("migrate");

async function runMigrations() {
  logger.info("Running PostgreSQL database migrations...");

  try {
    // Enable pgvector extension before running migrations
    await (db as any).execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    logger.info("pgvector extension enabled");

    await migrate(db as any, { migrationsFolder: "./drizzle" });
    logger.info("Migrations completed successfully");
  } catch (error) {
    logger.error({ error }, "Migration failed");
    throw error;
  } finally {
    // Close connection if needed
    process.exit(0);
  }
}

runMigrations();
