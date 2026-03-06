import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

async function runMigrations() {
  console.log("[migrate] Running PostgreSQL database migrations...");

  try {
    await migrate(db as any, { migrationsFolder: "./drizzle" });
    console.log("[migrate] Migrations completed successfully");
  } catch (error) {
    console.error("[migrate] Migration failed:", error);
    throw error;
  } finally {
    // Close connection if needed
    process.exit(0);
  }
}

runMigrations();
