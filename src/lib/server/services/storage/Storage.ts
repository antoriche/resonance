export abstract class Storage {
  abstract saveFile(key: string, content: Buffer): Promise<void>;
  abstract getFile(key: string): Promise<Buffer>;
  abstract deleteFile(key: string): Promise<void>;
  abstract listFiles(): Promise<string[]>;
}
