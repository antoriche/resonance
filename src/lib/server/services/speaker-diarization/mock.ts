import { Embedding } from "@/types/embedding";

export async function diarizeSpeaker(filePath: string): Promise<
  Array<{
    speakerId: number;
    offset: number;
    duration: number;
    embedding: Embedding;
  }>
> {
  const mockEmbedding = new Embedding(Array(256).fill(0));

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
