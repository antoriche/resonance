import { readdirSync, mkdirSync, writeFileSync } from "fs";
import { join, basename, extname } from "path";
import { diarizeSpeaker } from "../../src/lib/services/speaker-diarization/diarize";

const AUDIO_DIR = join(__dirname, "..", "files", "audio");
const OUTPUT_DIR = join(__dirname, "..", "files", "diarized");

async function main() {
  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // List audio files
  const audioFiles = readdirSync(AUDIO_DIR).filter((f) =>
    [".mp3", ".wav", ".m4a", ".ogg", ".flac"].includes(
      extname(f).toLowerCase(),
    ),
  );

  console.log(`Found ${audioFiles.length} audio files in ${AUDIO_DIR}`);

  for (const file of audioFiles) {
    const filePath = join(AUDIO_DIR, file);
    const outputName = `${basename(file, extname(file))}.json`;
    const outputPath = join(OUTPUT_DIR, outputName);

    console.log(`\n--- Processing: ${file} ---`);
    const startTime = Date.now();

    try {
      const segments = await diarizeSpeaker(filePath);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      writeFileSync(outputPath, JSON.stringify(segments, null, 2), "utf-8");
      console.log(
        `  => ${segments.length} segments, wrote ${outputName} (${elapsed}s)`,
      );
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  !! Failed after ${elapsed}s:`, err);
    }
  }

  console.log("\nDone.");
}

main();
