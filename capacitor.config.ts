import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "resonance.app",
  appName: "Resonance.ai",
  webDir: "out",
  server: {
    url: "https://resonance-plum-five.vercel.app",
  },
};

export default config;
