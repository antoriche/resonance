#!/usr/bin/env tsx
/**
 * Detects the local network IP address and writes capacitor.config.ts
 * with that IP so the mobile app points to the local dev server.
 *
 * Pass --prod to restore the production Vercel URL instead.
 */
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

// Load .env.local so this script works outside of Next.js context
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const PORT = process.env.PORT ?? "3000";
const PROD_URL = process.env.NEXT_PUBLIC_SITE_URL;
const isProd = process.argv.includes("--prod");

if (isProd && !PROD_URL) {
  console.error("Error: NEXT_PUBLIC_SITE_URL environment variable is not set.");
  process.exit(1);
}

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  throw new Error("Could not determine local IP address.");
}

const url = isProd ? PROD_URL! : `http://${getLocalIP()}:${PORT}`;

const envLocalPath = path.resolve(__dirname, "../.env.local");

// Read existing .env.local content (preserve other variables)
let envContent = "";
if (fs.existsSync(envLocalPath)) {
  envContent = fs.readFileSync(envLocalPath, "utf-8");
}

// Update or append CAPACITOR_SERVER_URL
if (envContent.match(/^CAPACITOR_SERVER_URL=.*$/m)) {
  envContent = envContent.replace(
    /^CAPACITOR_SERVER_URL=.*$/m,
    `CAPACITOR_SERVER_URL=${url}`,
  );
} else {
  envContent = envContent.trimEnd() + `\nCAPACITOR_SERVER_URL=${url}\n`;
}

fs.writeFileSync(envLocalPath, envContent, "utf-8");
console.log(`.env.local updated → CAPACITOR_SERVER_URL=${url}`);
