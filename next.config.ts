import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // serverExternalPackages: ["nodejs-whisper"],
  // Empty turbopack config to silence Next.js 16 warning
  // turbopack: {},
};

export default nextConfig;
