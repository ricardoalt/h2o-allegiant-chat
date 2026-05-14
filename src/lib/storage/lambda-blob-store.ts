import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { buildS3ObjectUrl } from "@/config/env";
import type { OwnerContext } from "@/lib/auth/owner-context";
import type { BlobStore, PutBlobInput, PutBlobResult } from "@/lib/storage/blob-store";

export type LambdaS3Client = Pick<S3Client, "send">;

export type LambdaS3BlobStoreConfig = {
  bucket: string;
  client: LambdaS3Client;
  idFactory?: () => string;
  owner: OwnerContext;
  prefix: string;
  region: string;
};

export type LambdaS3BlobStoreEnv = {
  AWS_REGION?: string;
  LAMBDA_CHAT_BLOB_BUCKET_NAME?: string;
  LAMBDA_CHAT_BLOB_PREFIX?: string;
};

type TransformableS3Body = { transformToByteArray(): Promise<Uint8Array> };

const normalizePrefix = (prefix: string): string =>
  prefix
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment))
    .join("/");

const sanitizePathSegment = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-");

const requiredEnv = (env: LambdaS3BlobStoreEnv, name: keyof LambdaS3BlobStoreEnv): string => {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required Lambda BlobStore environment variable: ${name}`);
  }
  return value;
};

const bodyToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(body)) {
    return Buffer.from(body);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as TransformableS3Body).transformToByteArray === "function"
  ) {
    return Buffer.from(await (body as TransformableS3Body).transformToByteArray());
  }

  throw new Error("Unsupported S3 object body type.");
};

export const createLambdaS3ObjectKey = ({
  filename,
  id,
  ownerUserId,
  prefix,
  threadId,
}: {
  filename: string;
  id: string;
  ownerUserId: string;
  prefix: string;
  threadId: string;
}): string => {
  const safePrefix = normalizePrefix(prefix);
  const safeOwner = sanitizePathSegment(ownerUserId);
  const safeThread = sanitizePathSegment(threadId);
  const safeId = sanitizePathSegment(id);
  const safeFilename = sanitizePathSegment(filename || "attachment");
  const scopedKey = `users/${safeOwner}/threads/${safeThread}/${safeId}-${safeFilename}`;

  return safePrefix ? `${safePrefix}/${scopedKey}` : scopedKey;
};

class LambdaS3BlobStore implements BlobStore {
  constructor(private readonly config: Required<LambdaS3BlobStoreConfig>) {}

  async put(input: PutBlobInput): Promise<PutBlobResult> {
    if (input.bytes.length === 0) {
      throw new Error("Cannot store an empty blob.");
    }

    const key = createLambdaS3ObjectKey({
      filename: input.filename,
      id: this.config.idFactory(),
      ownerUserId: this.config.owner.userId,
      prefix: this.config.prefix,
      threadId: input.threadId,
    });

    await this.config.client.send(
      new PutObjectCommand({
        Body: new Uint8Array(input.bytes),
        Bucket: this.config.bucket,
        ContentType: input.mediaType,
        Key: key,
      }),
    );

    return {
      key,
      sizeBytes: input.bytes.length,
      url: buildS3ObjectUrl(this.config.bucket, this.config.region, key),
    };
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.config.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );

    return bodyToBuffer((result as { Body?: unknown }).Body);
  }

  async delete(key: string): Promise<void> {
    await this.config.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }
}

export const createLambdaS3BlobStore = (config: LambdaS3BlobStoreConfig): BlobStore =>
  new LambdaS3BlobStore({
    ...config,
    idFactory: config.idFactory ?? randomUUID,
  });

export const createLambdaS3BlobStoreFromEnv = (
  env: LambdaS3BlobStoreEnv = process.env as LambdaS3BlobStoreEnv,
  owner: OwnerContext,
  clientConfig: S3ClientConfig = {},
): BlobStore => {
  const region = env.AWS_REGION ?? "us-east-1";

  return createLambdaS3BlobStore({
    bucket: requiredEnv(env, "LAMBDA_CHAT_BLOB_BUCKET_NAME"),
    client: new S3Client({ region, ...clientConfig }),
    owner,
    prefix: env.LAMBDA_CHAT_BLOB_PREFIX ?? "lambda-chat/attachments/",
    region,
  });
};
