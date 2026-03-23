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
    resolveAlias: {
      "onnxruntime-node": "onnxruntime-web",
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node": "onnxruntime-web",
    };
    return config;
  },
  serverExternalPackages: ["pg-embedded", "nodejs-whisper"],
  // Empty turbopack config to silence Next.js 16 warning
  // turbopack: {},
};

export default nextConfig;
