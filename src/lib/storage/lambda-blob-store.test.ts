import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import type { OwnerContext } from "@/lib/auth/server";
import {
  createLambdaS3BlobStore,
  createLambdaS3BlobStoreFromEnv,
  createLambdaS3ObjectKey,
  type LambdaS3Client,
} from "./lambda-blob-store";

type SentCommand = {
  input: Record<string, unknown>;
  constructor: { name: string };
};

class FakeS3Client implements LambdaS3Client {
  readonly objects = new Map<string, Buffer>();
  readonly sent: SentCommand[] = [];

  async send(command: SentCommand): Promise<Record<string, unknown>> {
    this.sent.push(command);
    const name = command.constructor.name;
    const input = command.input;
    const key = String(input.Key);

    if (name === "PutObjectCommand") {
      this.objects.set(key, Buffer.from(input.Body as Uint8Array));
      return {};
    }

    if (name === "GetObjectCommand") {
      const value = this.objects.get(key);
      if (!value) throw new Error(`missing object ${key}`);
      return { Body: value };
    }

    if (name === "DeleteObjectCommand") {
      this.objects.delete(key);
      return {};
    }

    throw new Error(`Unhandled command ${name}`);
  }
}

const owner: OwnerContext = {
  identityId: "identity-ignored",
  userId: "user-123",
};

const createStore = (client = new FakeS3Client()) => ({
  client,
  store: createLambdaS3BlobStore({
    bucket: "attachments-bucket",
    client,
    idFactory: () => "uuid-123",
    owner,
    prefix: "lambda-chat/attachments/",
    region: "us-east-1",
  }),
});

describe("Lambda S3 BlobStore", () => {
  it("puts blobs under a user and thread scoped key with a safe filename", async () => {
    const { client, store } = createStore();

    const result = await store.put({
      bytes: Buffer.from("hello"),
      filename: "unsafe ../file name.pdf",
      mediaType: "application/pdf",
      threadId: "thread/with spaces",
    });

    expect(result).toEqual({
      key: "lambda-chat/attachments/users/user-123/threads/thread-with-spaces/uuid-123-unsafe-..-file-name.pdf",
      sizeBytes: 5,
      url: "https://attachments-bucket.s3.us-east-1.amazonaws.com/lambda-chat/attachments/users/user-123/threads/thread-with-spaces/uuid-123-unsafe-..-file-name.pdf",
    });
    expect(client.objects.get(result.key)?.toString()).toBe("hello");
    expect(client.sent[0]?.constructor.name).toBe("PutObjectCommand");
    expect((client.sent[0]?.input as unknown as PutObjectCommandInput).ContentType).toBe(
      "application/pdf",
    );
  });

  it("gets blobs by key", async () => {
    const { store } = createStore();
    const saved = await store.put({
      bytes: Buffer.from("saved bytes"),
      filename: "note.txt",
      mediaType: "text/plain",
      threadId: "thread-1",
    });

    await expect(store.get(saved.key)).resolves.toEqual(Buffer.from("saved bytes"));
  });

  it("deletes blobs by key", async () => {
    const { client, store } = createStore();
    const saved = await store.put({
      bytes: Buffer.from("delete me"),
      filename: "note.txt",
      mediaType: "text/plain",
      threadId: "thread-1",
    });

    await store.delete(saved.key);

    expect(client.objects.has(saved.key)).toBe(false);
    expect(client.sent.at(-1)?.constructor.name).toBe("DeleteObjectCommand");
  });

  it("rejects empty blob writes at the BlobStore boundary", async () => {
    const { store } = createStore();

    await expect(
      store.put({
        bytes: Buffer.alloc(0),
        filename: "empty.txt",
        mediaType: "text/plain",
        threadId: "thread-1",
      }),
    ).rejects.toThrow("Cannot store an empty blob.");
  });

  it("sanitizes owner, thread, id, and filename path segments", () => {
    expect(
      createLambdaS3ObjectKey({
        filename: "../../very unsafe 😬.png",
        id: "uuid/with spaces",
        ownerUserId: "user/with spaces",
        prefix: "/lambda//attachments//",
        threadId: "thread:123",
      }),
    ).toBe(
      "lambda/attachments/users/user-with-spaces/threads/thread-123/uuid-with-spaces-..-..-very-unsafe---.png",
    );
  });

  it("keeps one BlobStore instance scoped to its configured owner", async () => {
    const { store } = createStore();

    const saved = await store.put({
      bytes: Buffer.from("owned"),
      filename: "owned.txt",
      mediaType: "text/plain",
      threadId: "thread-1",
    });

    expect(saved.key).toContain("/users/user-123/threads/thread-1/");
    expect(saved.key).not.toContain("identity-ignored");
    expect(saved.key).not.toContain("other-user");
  });

  it("creates an AWS SDK S3 client from environment without static credentials", () => {
    const store = createLambdaS3BlobStoreFromEnv(
      {
        AWS_REGION: "us-west-2",
        LAMBDA_CHAT_BLOB_BUCKET_NAME: "bucket-from-env",
        LAMBDA_CHAT_BLOB_PREFIX: "prefix-from-env/",
      },
      owner,
    );

    expect(store).toBeDefined();
  });
});
