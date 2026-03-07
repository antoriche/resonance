export async function diarizeSpeaker(filePath: string): Promise<
  Array<{
    speakerId: number;
    offset: number;
    duration: number;
  }>
> {
  return [
    {
      speakerId: 1,
      offset: 0,
      duration: 5000,
    },
    {
      speakerId: 2,
      offset: 5000,
      duration: 5000,
    },
  ];
}
