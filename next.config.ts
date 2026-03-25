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
    "nodejs-whisper",
    "@ffmpeg-installer/ffmpeg",
  ],
  outputFileTracingExcludes: {
    "/api/*": [
      // Native onnxruntime-node — postinstall patches onnx.js to use onnxruntime-web instead
      "./node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/sharp",
      "./node_modules/nodejs-whisper",
      // Webpack bundle not needed — @xenova/transformers runs from src/ as external
      "./node_modules/@xenova/transformers/dist",
      // Threaded WASM variants not needed (numThreads=1 in transformers service)
      "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
      "./node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm",
      "./node_modules/onnxruntime-web/dist/ort-wasm-threaded.js",
      "./node_modules/onnxruntime-web/dist/ort-wasm-threaded.worker.js",
    ],
  },
  // Empty turbopack config to silence Next.js 16 warning
  // turbopack: {},
};

export default nextConfig;
