import { put, del, list, head } from "@vercel/blob";
import { Storage } from "./Storage";

export interface VercelStorageConfig {
  token: string;
  prefix?: string;
}

export class VercelStorage extends Storage {
  private token: string;
  private prefix?: string;

  constructor(config: VercelStorageConfig) {
    super();
    this.token = config.token;
    this.prefix = config.prefix;
  }

  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  private stripPrefix(key: string): string {
    if (!this.prefix) return key;
    const prefixWithSlash = `${this.prefix}/`;
    return key.startsWith(prefixWithSlash)
      ? key.slice(prefixWithSlash.length)
      : key;
  }

  async saveFile(key: string, content: Buffer): Promise<void> {
    const fullKey = this.getFullKey(key);
    await put(fullKey, content, {
      access: "private",
      token: this.token,
    });
  }

  async getFile(key: string): Promise<Buffer> {
    const fullKey = this.getFullKey(key);
    const blob = await head(fullKey, {
      token: this.token,
    });

    if (!blob) {
      throw new Error(`File not found: ${key}`);
    }

    // Private blobs require the Bearer token to be fetched directly
    const response = await fetch(blob.url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${key}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async deleteFile(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await del(fullKey, {
      token: this.token,
    });
  }

  async listFiles(): Promise<string[]> {
    const result = await list({
      token: this.token,
      prefix: this.prefix,
    });

    return result.blobs.map((blob) => this.stripPrefix(blob.pathname));
  }
}
