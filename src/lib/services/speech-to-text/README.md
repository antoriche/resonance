# Speech-to-Text Configuration

This project now uses **@xenova/transformers** (Transformers.js) for speech-to-text transcription instead of nodejs-whisper.

## Why the Change?

- ✅ Pure JavaScript implementation (no C++ compilation required)
- ✅ Cross-platform compatibility (works on macOS, Linux, Windows)
- ✅ Automatic model downloading and caching
- ✅ No external dependencies on whisper.cpp
- ✅ Better error handling and initialization

## Available Models

The default model is `Xenova/whisper-tiny` which provides a good balance between speed and accuracy.

### Model Options

You can change the model in `src/lib/services/speech-to-text/transformers/index.ts`:

```typescript
// Available models (from smallest to largest):
-Xenova / whisper -
  tiny - // ~150MB - Fast, good for testing
  Xenova / whisper -
  base - // ~290MB - Better accuracy
  Xenova / whisper -
  small - // ~970MB - Good balance
  Xenova / whisper -
  medium - // ~3GB   - High accuracy
  Xenova / whisper -
  large -
  v3; // ~6GB   - Best accuracy (requires more RAM)
```

### Changing the Model

Edit the constructor in `src/lib/services/speech-to-text/transformers/index.ts`:

```typescript
export const transformersService = new TransformersService(
  "Xenova/whisper-base",
);
```

## Switching Between Implementations

To switch between different speech-to-text implementations, edit `src/lib/services/speech-to-text/index.ts`:

```typescript
// For Transformers.js (default, recommended)
export { speachToText } from "./transformers";

// For nodejs-whisper (requires whisper.cpp compilation)
export { speachToText } from "./whisper";

// For mock/testing
export { speachToText } from "./mock";
```

## First Run

On the first transcription, the model will be automatically downloaded and cached in:

- `~/.cache/huggingface/transformers/` (Linux/macOS)
- `%USERPROFILE%\.cache\huggingface\transformers\` (Windows)

This may take a few minutes depending on your internet connection and the model size.

## Transcription Options

You can customize transcription behavior:

```typescript
const result = await transformersService.transcribe(audioFile, {
  language: "en", // Force language (or null for auto-detect)
  task: "transcribe", // "transcribe" or "translate" to English
  chunk_length_s: 30, // Process in 30-second chunks
  stride_length_s: 5, // 5-second overlap between chunks
});
```

## Performance Tips

1. **Use smaller models** for real-time transcription
2. **Use larger models** for better accuracy on long-form content
3. Models are cached after first download
4. First transcription initializes the model (may take a few seconds)

## Troubleshooting

### Model Download Issues

If model download fails, check your internet connection or manually download from:
https://huggingface.co/Xenova/whisper-tiny

### Out of Memory

Try a smaller model (e.g., `whisper-tiny` or `whisper-base`)

### Slow Transcription

- Use a smaller model
- Reduce `chunk_length_s`
- Ensure you have enough RAM available
