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
  serverExternalPackages: [
    "pg-embedded",
    "@ffmpeg-installer/ffmpeg",
    "fluent-ffmpeg",
    "onnxruntime-web",
    "wavefile",
    "music-metadata",
  ],
  outputFileTracingIncludes: {
    "/api/audio/upload": [
      "./src/lib/server/services/speaker-diarization/segmentation.onnx",
      "./src/lib/server/services/speaker-diarization/embedding.onnx",
    ],
  },
  outputFileTracingExcludes: {
    "/api/*": [
      "./node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/sharp",
    ],
  },
  // Empty turbopack config to silence Next.js 16 warning
  // turbopack: {},
};

export default nextConfig;
