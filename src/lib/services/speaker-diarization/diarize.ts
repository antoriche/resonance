import * as ort from "onnxruntime-node";
import { join } from "path";
import Ffmpeg, * as ffmpeg from "fluent-ffmpeg";
import { createWriteStream, unlinkSync } from "fs";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

interface DiarizationSegment {
  offset: number;
  duration: number;
  embedding: number[];
}

/**
 * Perform speaker diarization on an audio file
 * @param filePath Path to the audio file
 * @returns Array of segments with speaker IDs, offsets, and durations
 */
export async function diarizeSpeaker(
  filePath: string,
): Promise<DiarizationSegment[]> {
  try {
    // Load ONNX models from source directory
    const modelDir = join(
      process.cwd(),
      "src",
      "lib",
      "services",
      "speaker-diarization",
    );
    const segmentationModelPath = join(modelDir, "segmentation.onnx");
    const embeddingModelPath = join(modelDir, "embedding.onnx");

    console.log(`[diarize] Loading models from: ${modelDir}`);

    const segmentationSession = await ort.InferenceSession.create(
      segmentationModelPath,
    );
    const embeddingSession =
      await ort.InferenceSession.create(embeddingModelPath);

    // Log model input/output info
    console.log(
      "[diarize] Segmentation model inputs:",
      segmentationSession.inputNames,
    );
    console.log(
      "[diarize] Segmentation model outputs:",
      segmentationSession.outputNames,
    );
    console.log(
      "[diarize] Embedding model inputs:",
      embeddingSession.inputNames,
    );
    console.log(
      "[diarize] Embedding model outputs:",
      embeddingSession.outputNames,
    );

    // Process audio file
    const audioData = await processAudioFile(filePath);
    console.log(`[diarize] Processed audio: ${audioData.length} samples`);

    // Step 1: Segmentation - detect speech regions
    const segments = await performSegmentation(audioData, segmentationSession);
    console.log(`[diarize] Found ${segments.length} speech segments`);
    segments.forEach((seg, idx) => {
      console.log(
        `[diarize]   Segment ${idx}: ${(seg.start / 1000).toFixed(2)}s - ${(seg.end / 1000).toFixed(2)}s (duration: ${((seg.end - seg.start) / 1000).toFixed(2)}s)`,
      );
    });

    // Step 2: Extract embeddings for each segment
    const embeddings = await extractEmbeddings(
      audioData,
      segments,
      embeddingSession,
    );

    // Step 3: Cluster embeddings to identify speakers
    const diarizedSegments = clusterSpeakers(segments, embeddings);

    return diarizedSegments;
  } catch (error) {
    console.error("Error during speaker diarization:", error);
    throw error;
  }
}

/**
 * Process audio file and extract features using ffmpeg
 */
async function processAudioFile(filePath: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    // Create temporary file for raw PCM output
    const tempFile = join(
      tmpdir(),
      `audio-${randomBytes(8).toString("hex")}.raw`,
    );
    const writeStream = createWriteStream(tempFile);

    console.log(`[diarize] Decoding audio file: ${filePath}`);

    Ffmpeg(filePath)
      .audioFrequency(16000) // Resample to 16kHz
      .audioChannels(1) // Convert to mono
      .audioCodec("pcm_f32le") // Output as 32-bit float PCM
      .format("f32le")
      .on("error", (err) => {
        console.error("[diarize] FFmpeg error:", err);
        reject(err);
      })
      .on("end", () => {
        // Read the raw PCM data
        const fs = require("fs");
        const buffer = fs.readFileSync(tempFile);

        // Convert to Float32Array
        const float32Data = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.length / 4,
        );

        // Clean up temp file
        unlinkSync(tempFile);

        console.log(
          `[diarize] Audio decoded: ${float32Data.length} samples, ${float32Data.length / 16000}s duration`,
        );
        resolve(float32Data);
      })
      .pipe(writeStream, { end: true });
  });
}

/**
 * Perform segmentation to detect speech regions
 */
async function performSegmentation(
  audioData: Float32Array,
  session: ort.InferenceSession,
): Promise<Array<{ start: number; end: number }>> {
  const segments: Array<{ start: number; end: number }> = [];

  // Process audio in chunks if it's too long
  const maxSamples = 160000; // 10 seconds at 16kHz
  const sampleRate = 16000;

  if (audioData.length <= maxSamples) {
    // Process entire audio at once
    const chunkSegments = await processSegmentationChunk(audioData, session, 0);
    segments.push(...chunkSegments);
  } else {
    // Process in chunks with overlap
    const overlap = 8000; // 0.5 second overlap
    for (
      let offset = 0;
      offset < audioData.length;
      offset += maxSamples - overlap
    ) {
      const end = Math.min(offset + maxSamples, audioData.length);
      const chunk = audioData.slice(offset, end);
      const chunkSegments = await processSegmentationChunk(
        chunk,
        session,
        (offset * 1000) / sampleRate,
      );
      segments.push(...chunkSegments);
    }
  }

  // Merge overlapping segments
  return mergeSegments(segments);
}

/**
 * Process a single chunk for segmentation
 */
async function processSegmentationChunk(
  audioChunk: Float32Array,
  session: ort.InferenceSession,
  timeOffsetMs: number,
): Promise<Array<{ start: number; end: number }>> {
  const segments: Array<{ start: number; end: number }> = [];

  // Prepare input tensor - try different shapes based on model
  const inputName = session.inputNames[0];

  console.log(`[diarize] Segmentation chunk: ${audioChunk.length} samples`);

  // Try shape [batch, channels, samples]
  const inputTensor = new ort.Tensor("float32", audioChunk, [
    1,
    1,
    audioChunk.length,
  ]);

  // Run inference
  const outputs = await session.run({ [inputName]: inputTensor });
  const outputName = session.outputNames[0];
  const outputTensor = outputs[outputName];

  console.log(`[diarize] Segmentation output shape:`, outputTensor.dims);
  console.log(`[diarize] Segmentation output size:`, outputTensor.data.length);

  // Parse output - shape is [batch, frames, classes]
  // For pyannote models, classes typically represent speaker activity
  const dims = outputTensor.dims as number[];
  const numFrames = dims[1];
  const numClasses = dims[2];
  const data = outputTensor.data as Float32Array;

  const sampleRate = 16000;
  const hopLength = Math.floor(audioChunk.length / numFrames);

  console.log(
    `[diarize] Frames: ${numFrames}, Classes: ${numClasses}, Hop: ${hopLength} samples`,
  );

  // Debug: Check some sample values and find max values across all frames
  const sampleIdx = Math.floor(numFrames / 2);
  const sampleValues = [];
  for (let c = 0; c < numClasses; c++) {
    sampleValues.push(data[sampleIdx * numClasses + c].toFixed(3));
  }
  console.log(`[diarize] Sample frame ${sampleIdx} raw values:`, sampleValues);

  // Apply sigmoid activation and check again
  const sigmoidValues = sampleValues.map((v) =>
    (1 / (1 + Math.exp(-parseFloat(v)))).toFixed(3),
  );
  console.log(
    `[diarize] Sample frame ${sampleIdx} after sigmoid:`,
    sigmoidValues,
  );

  // Find max values across all frames for each class
  const maxValuesByClass = new Array(numClasses).fill(-Infinity);
  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    for (let classIdx = 0; classIdx < numClasses; classIdx++) {
      const logit = data[frameIdx * numClasses + classIdx];
      maxValuesByClass[classIdx] = Math.max(maxValuesByClass[classIdx], logit);
    }
  }
  console.log(
    `[diarize] Max logit values by class:`,
    maxValuesByClass.map((v) => v.toFixed(3)),
  );
  console.log(
    `[diarize] Max sigmoid values by class:`,
    maxValuesByClass.map((v) => (1 / (1 + Math.exp(-v))).toFixed(3)),
  );

  const threshold = 0.3; // Much lower threshold since activations are weak
  let inSegment = false;
  let segmentStart = 0;

  // Check if ANY speaker class (1-6, not background class 0) is active
  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    let maxSpeakerProb = 0;

    // Check all speaker classes (skip class 0 which is background/silence)
    for (let classIdx = 1; classIdx < numClasses; classIdx++) {
      const logit = data[frameIdx * numClasses + classIdx];
      const prob = 1 / (1 + Math.exp(-logit));
      maxSpeakerProb = Math.max(maxSpeakerProb, prob);
    }

    const isSpeech = maxSpeakerProb > threshold;
    const timeMs = timeOffsetMs + (frameIdx * hopLength * 1000) / sampleRate;

    if (isSpeech && !inSegment) {
      segmentStart = timeMs;
      inSegment = true;
    } else if (!isSpeech && inSegment) {
      // Only add segment if it's longer than 100ms
      if (timeMs - segmentStart > 100) {
        segments.push({ start: segmentStart, end: timeMs });
      }
      inSegment = false;
    }
  }

  // Close final segment if needed
  if (inSegment) {
    const finalTime =
      timeOffsetMs + (numFrames * hopLength * 1000) / sampleRate;
    if (finalTime - segmentStart > 100) {
      segments.push({ start: segmentStart, end: finalTime });
    }
  }

  console.log(`[diarize] Chunk found ${segments.length} segments`);

  return segments;
}

/**
 * Merge overlapping or adjacent segments
 */
function mergeSegments(
  segments: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  if (segments.length === 0) return [];

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Merge if overlapping or very close (within 200ms)
    if (current.start <= last.end + 200) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Extract speaker embeddings for each segment
 */
async function extractEmbeddings(
  audioData: Float32Array,
  segments: Array<{ start: number; end: number }>,
  session: ort.InferenceSession,
): Promise<Float32Array[]> {
  const embeddings: Float32Array[] = [];
  const sampleRate = 16000;
  const targetDuration = 3.0; // 3 second windows for embeddings
  const targetSamples = Math.floor(sampleRate * targetDuration);

  for (const segment of segments) {
    // Extract audio chunk for this segment
    const startSample = Math.floor((segment.start * sampleRate) / 1000);
    const endSample = Math.floor((segment.end * sampleRate) / 1000);
    let chunk = audioData.slice(startSample, endSample);

    // Pad or truncate to target length
    if (chunk.length < targetSamples) {
      // Pad with zeros
      const padded = new Float32Array(targetSamples);
      padded.set(chunk);
      chunk = padded;
    } else if (chunk.length > targetSamples) {
      // Take center portion
      const offset = Math.floor((chunk.length - targetSamples) / 2);
      chunk = chunk.slice(offset, offset + targetSamples);
    }

    console.log(
      `[diarize] Processing embedding for segment ${segment.start}-${segment.end}ms, audio length: ${chunk.length}`,
    );

    // Extract mel-spectrogram features
    const melSpec = extractMelSpectrogram(chunk, sampleRate);
    console.log(
      `[diarize] Mel-spectrogram shape: [${melSpec.length / 80}, 80]`,
    );

    // Prepare input tensor - shape should be [batch, time_frames, 80]
    const inputName = session.inputNames[0];
    const numFrames = melSpec.length / 80;
    const inputTensor = new ort.Tensor("float32", melSpec, [1, numFrames, 80]);

    console.log(
      `[diarize] Embedding input tensor shape: [1, ${numFrames}, 80]`,
    );

    // Run inference
    const outputs = await session.run({ [inputName]: inputTensor });
    const outputName = session.outputNames[0];
    const embedding = outputs[outputName].data as Float32Array;

    console.log(`[diarize] Got embedding of size: ${embedding.length}`);
    embeddings.push(embedding);
  }

  return embeddings;
}

/**
 * Extract mel-spectrogram from audio
 */
function extractMelSpectrogram(
  audio: Float32Array,
  sampleRate: number,
): Float32Array {
  const nFFT = 512;
  const hopLength = 160;
  const nMels = 80;

  // Calculate number of frames
  const numFrames = Math.floor((audio.length - nFFT) / hopLength) + 1;

  // Create mel filterbank
  const melFilterbank = createMelFilterbank(nFFT, nMels, sampleRate);

  // Compute STFT and apply mel filterbank
  const melSpec = new Float32Array(numFrames * nMels);

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const start = frameIdx * hopLength;
    const frame = audio.slice(start, start + nFFT);

    // Apply Hann window
    const windowed = applyHannWindow(frame);

    // Compute FFT magnitude
    const magnitude = computeFFTMagnitude(windowed);

    // Apply mel filterbank
    for (let melIdx = 0; melIdx < nMels; melIdx++) {
      let melValue = 0;
      for (let freqIdx = 0; freqIdx < magnitude.length; freqIdx++) {
        melValue += magnitude[freqIdx] * melFilterbank[melIdx][freqIdx];
      }
      // Apply log
      melSpec[frameIdx * nMels + melIdx] = Math.log(Math.max(melValue, 1e-10));
    }
  }

  return melSpec;
}

/**
 * Create mel filterbank
 */
function createMelFilterbank(
  nFFT: number,
  nMels: number,
  sampleRate: number,
): Float32Array[] {
  const nFreqs = Math.floor(nFFT / 2) + 1;
  const filterbank: Float32Array[] = [];

  // Convert Hz to Mel
  const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (mel: number) => 700 * (Math.pow(10, mel / 2595) - 1);

  const melMin = hzToMel(0);
  const melMax = hzToMel(sampleRate / 2);

  // Create mel points
  const melPoints: number[] = [];
  for (let i = 0; i <= nMels + 1; i++) {
    melPoints.push(melMin + (i * (melMax - melMin)) / (nMels + 1));
  }

  // Convert mel points to hz
  const hzPoints = melPoints.map(melToHz);

  // Convert hz to FFT bin indices
  const binPoints = hzPoints.map((hz) =>
    Math.floor(((nFFT + 1) * hz) / sampleRate),
  );

  // Create triangular filters
  for (let i = 0; i < nMels; i++) {
    const filter = new Float32Array(nFreqs);
    const left = binPoints[i];
    const center = binPoints[i + 1];
    const right = binPoints[i + 2];

    // Rising slope
    for (let j = left; j < center; j++) {
      filter[j] = (j - left) / (center - left);
    }

    // Falling slope
    for (let j = center; j < right; j++) {
      filter[j] = (right - j) / (right - center);
    }

    filterbank.push(filter);
  }

  return filterbank;
}

/**
 * Apply Hann window to a frame
 */
function applyHannWindow(frame: Float32Array): Float32Array {
  const windowed = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frame.length - 1)));
    windowed[i] = frame[i] * window;
  }
  return windowed;
}

/**
 * Compute FFT magnitude (simplified using DFT for now)
 */
function computeFFTMagnitude(frame: Float32Array): Float32Array {
  const n = frame.length;
  const nFreqs = Math.floor(n / 2) + 1;
  const magnitude = new Float32Array(nFreqs);

  // Compute DFT (could be optimized with FFT library)
  for (let k = 0; k < nFreqs; k++) {
    let real = 0;
    let imag = 0;

    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      real += frame[t] * Math.cos(angle);
      imag += frame[t] * Math.sin(angle);
    }

    magnitude[k] = Math.sqrt(real * real + imag * imag);
  }

  return magnitude;
}

/**
 * Cluster embeddings to identify unique speakers
 */
function clusterSpeakers(
  segments: Array<{ start: number; end: number }>,
  embeddings: Float32Array[],
): DiarizationSegment[] {
  if (segments.length === 0) {
    return [];
  }

  // Simple clustering: agglomerative clustering based on cosine similarity
  const threshold = 0.75; // Lower threshold to merge more similar speakers
  const speakerMap: number[] = [];
  let nextSpeakerId = 1;

  console.log(`[diarize] Clustering ${embeddings.length} embeddings`);

  for (let i = 0; i < embeddings.length; i++) {
    let assignedSpeaker = -1;
    let maxSimilarity = 0;
    let bestMatch = -1;

    // Compare with existing speakers
    for (let j = 0; j < i; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      console.log(
        `[diarize] Similarity between segment ${i} and ${j}: ${similarity.toFixed(3)}`,
      );

      if (similarity > threshold && similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = j;
        assignedSpeaker = speakerMap[j];
      }
    }

    // Assign new speaker if no match found
    if (assignedSpeaker === -1) {
      assignedSpeaker = nextSpeakerId++;
      console.log(`[diarize] Segment ${i}: NEW speaker ${assignedSpeaker}`);
    } else {
      console.log(
        `[diarize] Segment ${i}: Matched with segment ${bestMatch} (speaker ${assignedSpeaker}, similarity: ${maxSimilarity.toFixed(3)})`,
      );
    }

    speakerMap.push(assignedSpeaker);
  }

  // Convert to output format
  const diarizedSegments: DiarizationSegment[] = segments.map((seg, idx) => ({
    offset: Math.floor(seg.start),
    duration: Math.floor(seg.end - seg.start),
    embedding: Array.from(embeddings[idx]),
  }));

  console.log(`[diarize] Identified ${nextSpeakerId - 1} unique speakers`);

  return diarizedSegments;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
