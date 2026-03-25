#!/usr/bin/env bash
set -e

TRANSFORMERS="node_modules/@xenova/transformers/src"

# Replace onnxruntime-node with onnxruntime-web
sed -i.bak "s/from 'onnxruntime-node'/from 'onnxruntime-web'/g" "$TRANSFORMERS/backends/onnx.js"
rm -f "$TRANSFORMERS/backends/onnx.js.bak"

# Disable sharp (not available on Vercel serverless)
sed -i.bak \
  -e "s/import sharp from 'sharp'/const sharp = null/g" \
  -e "s/throw new Error('Unable to load image processing library.')/loadImageFunction = async () => { throw new Error('Image processing not available'); }/g" \
  "$TRANSFORMERS/utils/image.js"
rm -f "$TRANSFORMERS/utils/image.js.bak"

# Add diagnostic logging for model class fallback errors
sed -i.bak 's/e = err;/e = err; console.error("[transformers] model class fallback error:", err);/g' \
  "$TRANSFORMERS/pipelines.js"
rm -f "$TRANSFORMERS/pipelines.js.bak"
