import { defineConfig } from "drizzle-kit";

const isDevelopment = process.env.NODE_ENV === "development";
const databaseUrl = process.env.DATABASE_URL;
const usePostgres = !!databaseUrl && !isDevelopment;

export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: usePostgres ? "postgresql" : "sqlite",
  dbCredentials: usePostgres
    ? { url: databaseUrl! }
    : { url: "./data/notetaker.db" },
});
