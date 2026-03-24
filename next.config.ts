import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    DATABASE_URL: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  },
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  serverExternalPackages: ["pg-embedded", "nodejs-whisper", "@ffmpeg-installer/ffmpeg"],
  outputFileTracingExcludes: {
    "/api/*": [
      "./node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/sharp",
      "./node_modules/nodejs-whisper",
      // Exclude non-essential dist files (source is used, not the webpack bundle)
      "./node_modules/@xenova/transformers/dist",
      // WASM binaries are fetched from CDN at runtime — no need to bundle them
      "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
  },
  // Empty turbopack config to silence Next.js 16 warning
  // turbopack: {},
};

export default nextConfig;
