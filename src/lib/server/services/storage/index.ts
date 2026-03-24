import { FileStorage } from "./FileStorage";
import { S3Storage } from "./S3Storage";
import { VercelStorage } from "./VercelStorage";
import { Storage } from "./Storage";

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function createStorage(storageUri: string): Storage {
  // S3 format: s3://bucket/prefix or s3://bucket
  if (storageUri.startsWith("s3://")) {
    const withoutProtocol = storageUri.slice(5); // Remove 's3://'
    const firstSlashIndex = withoutProtocol.indexOf("/");

    const bucket =
      firstSlashIndex === -1
        ? withoutProtocol
        : withoutProtocol.slice(0, firstSlashIndex);
    const prefix =
      firstSlashIndex === -1
        ? undefined
        : withoutProtocol.slice(firstSlashIndex + 1);

    return new S3Storage({ bucket, prefix });
  }

  // Vercel format: vercel://prefix or vercel://
  if (storageUri.startsWith("vercel://")) {
    if (!BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN environment variable is required for Vercel storage",
      );
    }

    const prefix = storageUri.slice(9) || undefined; // Remove 'vercel://'

    return new VercelStorage({
      token: BLOB_READ_WRITE_TOKEN,
      prefix,
    });
  }

  // File format: file://path, /absolute/path, ./relative/path, or just path
  if (storageUri.startsWith("file://")) {
    return new FileStorage(storageUri.slice(7)); // Remove 'file://'
  }

  // Default to file storage for any other path
  return new FileStorage(storageUri);
}

let _storageInstance: Storage | null = null;

function getStorageInstance(): Storage {
  if (!_storageInstance) {
    const storage = process.env.STORAGE;
    if (!storage) {
      throw new Error("STORAGE environment variable is not defined");
    }
    _storageInstance = createStorage(storage);
  }
  return _storageInstance;
}

const storageInstance = new Proxy({} as Storage, {
  get(_target, prop) {
    return (
      getStorageInstance() as unknown as Record<string | symbol, unknown>
    )[prop];
  },
});

export default storageInstance;
