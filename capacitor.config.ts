/// <reference types="node" />
import type { CapacitorConfig } from "@capacitor/cli";
import * as fs from "fs";
import * as path from "path";

// Load .env.local when present (gitignored)
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "resonance.app",
  appName: "Resonance.ai",
  webDir: "out",
  ...(serverUrl && {
    server: {
      url: serverUrl,
      cleartext: serverUrl.startsWith("http://"),
    },
  }),
};

export default config;
