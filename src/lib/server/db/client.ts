import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "path";
import { transcriptions, files, computed_speakers } from "./schema";
import { createLogger } from "@/lib/server/logger";

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

// Lazily initialised so importing this module at build time (when DATABASE_URL
// is not available) does not throw.  The error is deferred to the first
// actual database call at request time.
let _client: ReturnType<typeof createPgClient> | null = null;

function getClient(): ReturnType<typeof createPgClient> {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable was not set.");
    }
    _client = createPgClient(url);
  }
  return _client;
}

export const client = new Proxy({} as ReturnType<typeof createPgClient>, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const db = new Proxy({} as ReturnType<typeof createPgClient>["db"], {
  get(_target, prop) {
    return (getClient().db as unknown as Record<string | symbol, unknown>)[
      prop
    ];
  },
});
