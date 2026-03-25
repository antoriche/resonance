# Speech-to-Text

Uses **@xenova/transformers** (Transformers.js) for local speech-to-text transcription.

## Configuration

Set the `SPEECH_TO_TEXT_ENGINE` environment variable in `.env`:

| Value           | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| `LOCAL_WHISPER` | Real transcription via Transformers.js (Xenova). **Default** when unset.      |
| `MOCK`          | Returns placeholder text — useful for development without downloading models. |

### Model Selection

Set `WHISPER_MODEL` in `.env` to control which Hugging Face model is loaded:

| Value      | Size    | Notes                                                   |
| ---------- | ------- | ------------------------------------------------------- |
| `tiny`     | ~150 MB | Fast, good for testing                                  |
| `base`     | ~290 MB | Better accuracy (default when `WHISPER_MODEL` is unset) |
| `small`    | ~970 MB | Good balance                                            |
| `medium`   | ~3 GB   | High accuracy                                           |
| `large-v3` | ~6 GB   | Best accuracy (requires more RAM)                       |

## First Run

On the first transcription with `LOCAL_WHISPER`, the model is automatically downloaded and cached to `/tmp/transformers-cache`.

## Transcription Options

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
