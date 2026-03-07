export async function speachToText(
  filePath: string,
  options: {
    offset: number;
    duration: number;
  },
): Promise<{
  text: string;
}> {
  return {
    text: `Transcription for ${filePath} (offset: ${options.offset}, duration: ${options.duration})`,
  };
}
