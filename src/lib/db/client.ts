import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "path";
import { transcriptions, files, computed_speakers } from "./schema";
import { createLogger } from "@/lib/logger";

const logger = createLogger("db");

export function createPgClient(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool);

  return {
    type: "postgres" as const,
    db,
    files,
    transcriptions,
    computed_speakers,
  };
}

export type PgClient = ReturnType<typeof createPgClient>;

// ── Database initialization ──────────────────────────────────────────

/**
 * For development, create a database instance using embedded-postgres.
 * @returns {Promise<string>} The connection string for the embedded PostgreSQL instance.
 */
async function setupLocalDatabase() {
  logger.info("Starting embedded PostgreSQL for development...");

  const port = 5433;
  const username = "postgres";
  const password = "postgres";

  // not working
  const { PostgresInstance } = await import("pg-embedded");

  const embeddedPg = new PostgresInstance({
    dataDir: path.join(process.cwd(), "data", "embedded-pg"),
    username,
    password,
    port,
    persistent: true,
  });

  await embeddedPg.start();

  // Construct connection string from configuration
  const embeddedUrl = `postgresql://${username}:${password}@localhost:${port}/postgres`;
  logger.info("Embedded PostgreSQL started successfully");

  // Graceful shutdown
  process.on("beforeExit", async () => {
    if (embeddedPg) {
      logger.info("Stopping embedded PostgreSQL...");
      await embeddedPg.stop();
    }
  });

  process.on("SIGINT", async () => {
    if (embeddedPg) {
      logger.info("Stopping embedded PostgreSQL...");
      await embeddedPg.stop();
    }
    process.exit(0);
  });

  return embeddedUrl;
}

const isDevelopment = process.env.NODE_ENV === "development";
const databaseUrl = process.env.DATABASE_URL;
// ?? (isDevelopment ? await setupLocalDatabase() : undefined);

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable was not set.");
}

export const client = createPgClient(databaseUrl);
export const db = client.db;
