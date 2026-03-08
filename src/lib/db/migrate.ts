import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("migrate");

async function runMigrations() {
  logger.info("Running PostgreSQL database migrations...");

  try {
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
