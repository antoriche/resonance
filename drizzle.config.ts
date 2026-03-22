import { defineConfig } from "drizzle-kit";

const isDevelopment = process.env.NODE_ENV === "development";
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl! },
});
