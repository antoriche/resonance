import { FileStorage } from "./FileStorage";
import { S3Storage } from "./S3Storage";
import { VercelStorage } from "./VercelStorage";
import { Storage } from "./Storage";

const { STORAGE, VERCEL_BLOB_TOKEN } = process.env;

if (!STORAGE) {
  throw new Error("STORAGE environment variable is not defined");
}

let storageInstance: Storage;
let storageBasePath: string | null = null;

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
    if (!VERCEL_BLOB_TOKEN) {
      throw new Error(
        "VERCEL_BLOB_TOKEN environment variable is required for Vercel storage",
      );
    }

    const prefix = storageUri.slice(9) || undefined; // Remove 'vercel://'

    return new VercelStorage({
      token: VERCEL_BLOB_TOKEN,
      prefix,
    });
  }

  // File format: file://path, /absolute/path, ./relative/path, or just path
  if (storageUri.startsWith("file://")) {
    const basePath = storageUri.slice(7);
    storageBasePath = basePath;
    return new FileStorage(basePath); // Remove 'file://'
  }

  // Default to file storage for any other path
  storageBasePath = storageUri;
  return new FileStorage(storageUri);
}

storageInstance = createStorage(STORAGE);

export default storageInstance;
export { storageBasePath };
