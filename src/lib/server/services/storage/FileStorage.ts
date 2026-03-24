import { promises as fs } from "fs";
import * as path from "path";
import { Storage } from "./Storage";

export class FileStorage extends Storage {
  private basePath: string;

  constructor(basePath: string) {
    super();
    this.basePath = basePath;
  }

  getBasePath(): string {
    return this.basePath;
  }

  async saveFile(key: string, content: Buffer): Promise<void> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content);
  }

  async getFile(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return await fs.readFile(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    await fs.unlink(filePath);
  }

  async listFiles(): Promise<string[]> {
    const files: string[] = [];

    const readDir = async (dir: string, baseDir: string = "") => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = path.join(baseDir, entry.name);
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await readDir(fullPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    };

    try {
      await readDir(this.basePath);
    } catch (error) {
      // If basePath doesn't exist yet, return empty array
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    return files;
  }
}
