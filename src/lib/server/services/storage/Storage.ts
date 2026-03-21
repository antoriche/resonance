export abstract class Storage {
  abstract saveFile(key: string, content: Buffer): Promise<void>;
  abstract getFile(key: string): Promise<Buffer>;
  abstract deleteFile(key: string): Promise<void>;
  abstract listFiles(): Promise<string[]>;
  /**
   * Get the local filesystem path for a key (if applicable).
   * Returns null for cloud storage (S3, Vercel).
   */
  abstract getLocalPath(key: string): string | null;
}
