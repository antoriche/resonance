export async function diarizeSpeaker(filePath: string): Promise<
  Array<{
    speakerId: number;
    offset: number;
    duration: number;
    embedding: number[];
  }>
> {
  // Generate mock 256-dimensional embedding (to match actual model output)
  const mockEmbedding = Array.from({ length: 256 }, () => Math.random());
  
  return [
    {
      speakerId: 1,
      offset: 0,
      duration: 5000,
      embedding: mockEmbedding,
    },
    {
      speakerId: 2,
      offset: 5000,
      duration: 5000,
      embedding: mockEmbedding,
    },
  ];
}
