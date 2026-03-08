export class Embedding extends Array<number> {
  constructor(values: number[]) {
    if (values.length !== 256) {
      throw new Error(
        `Embedding must have exactly 256 dimensions, got ${values.length}`,
      );
    }
    super(...values); // Ensure no undefined values
  }
}
