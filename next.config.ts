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
    // Redirect onnxruntime-node → onnxruntime-web (WASM backend) so
    // @xenova/transformers works in Vercel serverless (no native binary).
    resolveAlias: {
      "onnxruntime-node": "onnxruntime-web",
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
  outputFileTracingIncludes: {
    "/api/*": [
      // onnxruntime-node is aliased to onnxruntime-web via npm — file tracer
      // doesn't follow the alias, so we force-include its dist files.
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/ort-web.node.js",
      // Single-threaded WASM variants only (numThreads=1 in transformers service).
      // ort-wasm-simd.wasm is preferred; ort-wasm.wasm as fallback if SIMD unavailable.
      "./node_modules/onnxruntime-node/dist/ort-wasm-simd.wasm",
      "./node_modules/onnxruntime-node/dist/ort-wasm.wasm",
      // Nested copy is symlinked to top-level via postinstall, but Vercel may
      // not follow symlinks — include these paths explicitly too.
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node/package.json",
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node/dist/ort-web.node.js",
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node/dist/ort-wasm-simd.wasm",
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node/dist/ort-wasm.wasm",
    ],
  },
  outputFileTracingExcludes: {
    "/api/*": [
      // sharp is not used for speech-to-text
      "./node_modules/@xenova/transformers/node_modules/sharp",
      "./node_modules/nodejs-whisper",
      // Webpack bundle not needed — @xenova/transformers runs from src/ as external
      "./node_modules/@xenova/transformers/dist",
      // Duplicate onnxruntime-web dist — runtime uses onnxruntime-node (aliased) instead
      "./node_modules/onnxruntime-web/dist",
      // Threaded WASM variants not needed (numThreads=1)
      "./node_modules/onnxruntime-node/dist/ort-wasm-simd-threaded.wasm",
      "./node_modules/onnxruntime-node/dist/ort-wasm-threaded.wasm",
      "./node_modules/onnxruntime-node/dist/ort-wasm-threaded.js",
      "./node_modules/onnxruntime-node/dist/ort-wasm-threaded.worker.js",
      // Source maps and browser bundles — not needed at runtime
      "./node_modules/onnxruntime-node/dist/*.map",
      "./node_modules/onnxruntime-node/dist/ort.js",
      "./node_modules/onnxruntime-node/dist/ort-web.js",
      "./node_modules/onnxruntime-node/dist/ort-web.node.js.map",
      "./node_modules/onnxruntime-node/dist/*.min.js",
      "./node_modules/onnxruntime-node/dist/*.min.js.map",
    ],
  },
  // Empty turbopack config to silence Next.js 16 warning
  // turbopack: {},
};

export default nextConfig;
