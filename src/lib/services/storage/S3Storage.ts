import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Storage } from "./Storage";

export interface S3StorageConfig {
  bucket: string;
  prefix?: string;
}

export class S3Storage extends Storage {
  private client: S3Client;
  private bucket: string;
  private prefix?: string;

  constructor(config: S3StorageConfig) {
    super();
    this.bucket = config.bucket;
    this.prefix = config.prefix;
    this.client = new S3Client({
      region: process.env.AWS_REGION,
    });
  }

  getLocalPath(_key: string): null {
    return null;
  }

  async saveFile(key: string, content: Buffer): Promise<void> {
    const fullKey = this.prefix ? `${this.prefix}/${key}` : key;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: content,
    });

    await this.client.send(command);
  }

  async getFile(key: string): Promise<Buffer> {
    const fullKey = this.prefix ? `${this.prefix}/${key}` : key;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    const response = await this.client.send(command);
    const body = await response.Body?.transformToByteArray();

    if (!body) {
      throw new Error(`Failed to read file: ${key}`);
    }

    return Buffer.from(body);
  }

  async deleteFile(key: string): Promise<void> {
    const fullKey = this.prefix ? `${this.prefix}/${key}` : key;
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
    });

    await this.client.send(command);
  }

  async listFiles(): Promise<string[]> {
    const files: string[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        ContinuationToken: continuationToken,
      });

      const response = await this.client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            // Strip prefix from returned keys
            const key = this.prefix
              ? object.Key.replace(new RegExp(`^${this.prefix}/`), "")
              : object.Key;
            files.push(key);
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  }
}
