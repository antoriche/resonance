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
      "./node_modules/onnxruntime-node/**",
    ],
  },
  outputFileTracingExcludes: {
    "/api/*": [
      // onnxruntime-node is now aliased to onnxruntime-web (pure JS/WASM),
      // so it must NOT be excluded — it needs to deploy alongside @xenova/transformers.
      // "./node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/onnxruntime-node",
      "./node_modules/@xenova/transformers/node_modules/sharp",
      "./node_modules/nodejs-whisper",
      // Exclude non-essential dist files (source is used, not the webpack bundle)
      "./node_modules/@xenova/transformers/dist",
      // WASM binaries must stay in the bundle for serverless (no CDN fallback)
      // "./node_modules/onnxruntime-web/dist/*.wasm",
    ],
  },
  // Empty turbopack config to silence Next.js 16 warning
  // turbopack: {},
};

export default nextConfig;
