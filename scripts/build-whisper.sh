#!/bin/bash
# Build whisper.cpp for nodejs-whisper

set -e

WHISPER_DIR="node_modules/nodejs-whisper/cpp/whisper.cpp"

if [ ! -d "$WHISPER_DIR" ]; then
  echo "[postinstall] Whisper.cpp directory not found, skipping build"
  exit 0
fi

echo "[postinstall] Building whisper.cpp..."

cd "$WHISPER_DIR"

# Check if whisper-cli already exists
if [ -f "build/bin/whisper-cli" ]; then
  echo "[postinstall] whisper-cli already built, skipping"
  exit 0
fi

# Try to build with cmake if available
if command -v cmake &> /dev/null; then
  echo "[postinstall] Using cmake to build whisper.cpp"
  mkdir -p build
  cd build
  cmake .. -DCMAKE_BUILD_TYPE=Release
  cmake --build . --config Release
  cd ..
  echo "[postinstall] whisper.cpp built successfully"
else
  echo "[postinstall] cmake not found. Please install cmake to use nodejs-whisper:"
  echo "  macOS: brew install cmake"
  echo "  Ubuntu/Debian: sudo apt-get install cmake"
  echo "  Other: https://cmake.org/download/"
  exit 1
fi
