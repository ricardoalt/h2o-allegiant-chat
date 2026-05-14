import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LambdaFunctionUrlEvent, LambdaResponseStream } from "./runtime-adapter";

const createChatPostHandlerMock = vi.hoisted(() => vi.fn());
const createCognitoAccessTokenVerifierMock = vi.hoisted(() => vi.fn(() => ({ verify: vi.fn() })));
const createLambdaOwnerResolverMock = vi.hoisted(() =>
  vi.fn(() => vi.fn(async () => ({ userId: "user-1", identityId: "user-1" }))),
);
const createLambdaDynamoDbChatStoreFromEnvMock = vi.hoisted(() =>
  vi.fn(() => ({ kind: "chat-store" })),
);
const createLambdaS3BlobStoreFromEnvMock = vi.hoisted(() => vi.fn(() => ({ kind: "blob-store" })));
const agentMock = vi.hoisted(() => ({ stream: vi.fn() }));
const generateTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/chat-handler", () => ({ createChatPostHandler: createChatPostHandlerMock }));
vi.mock("@/lib/auth/errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/errors")>();
  return actual;
});
vi.mock("@/lib/auth/lambda-owner", () => ({
  createCognitoAccessTokenVerifier: createCognitoAccessTokenVerifierMock,
  createLambdaOwnerResolver: createLambdaOwnerResolverMock,
}));
vi.mock("@/lib/storage/lambda-chat-store", () => ({
  createLambdaDynamoDbChatStoreFromEnv: createLambdaDynamoDbChatStoreFromEnvMock,
}));
vi.mock("@/lib/storage/lambda-blob-store", () => ({
  createLambdaS3BlobStoreFromEnv: createLambdaS3BlobStoreFromEnvMock,
}));
vi.mock("@/ai/agents/agent", () => ({ agent: agentMock }));
vi.mock("ai", () => ({ generateText: generateTextMock }));

const responseStream = (): LambdaResponseStream & { chunks: Buffer[]; ended: boolean } => {
  const stream = {
    chunks: [] as Buffer[],
    ended: false,
    write(chunk: Buffer | string) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    },
    end() {
      this.ended = true;
    },
  };
  return stream as LambdaResponseStream & { chunks: Buffer[]; ended: boolean };
};

const postEvent = (): LambdaFunctionUrlEvent => ({
  rawPath: "/",
  rawQueryString: "",
  headers: {
    authorization: "Bearer access-token",
    "content-type": "application/json",
    host: "chat.lambda-url.us-east-1.on.aws",
  },
  requestContext: {
    domainName: "chat.lambda-url.us-east-1.on.aws",
    http: { method: "POST", path: "/" },
    requestId: "request-1",
  },
  body: JSON.stringify({ threadId: "thread-1", messages: [] }),
  isBase64Encoded: false,
});

describe("chat streaming Lambda handler composition", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("COGNITO_USER_POOL_ID", "us-east-1_pool");
    vi.stubEnv("COGNITO_USER_POOL_CLIENT_ID", "client-id");
    createChatPostHandlerMock.mockReset();
    createCognitoAccessTokenVerifierMock.mockClear();
    createLambdaOwnerResolverMock.mockClear();
    createLambdaDynamoDbChatStoreFromEnvMock.mockClear();
    createLambdaS3BlobStoreFromEnvMock.mockClear();
  });

  it("composes auth, ChatStore, BlobStore, and existing chat handler for valid POST requests", async () => {
    const chatResponse = new Response("chat-stream", {
      status: 202,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    createChatPostHandlerMock.mockReturnValue(vi.fn(async () => chatResponse));
    const { handleChatStreamingRequest } = await import("./handler");
    const stream = responseStream();

    await handleChatStreamingRequest(postEvent(), stream, { decorateResponseStream: (s) => s });

    expect(createCognitoAccessTokenVerifierMock).toHaveBeenCalledWith({
      userPoolId: "us-east-1_pool",
      clientId: "client-id",
    });
    expect(createLambdaOwnerResolverMock).toHaveBeenCalledWith({
      authorizationHeader: "Bearer access-token",
      verifier: expect.any(Object),
    });
    expect(createLambdaDynamoDbChatStoreFromEnvMock).toHaveBeenCalled();
    expect(createLambdaS3BlobStoreFromEnvMock).toHaveBeenCalledWith(process.env, {
      userId: "user-1",
      identityId: "user-1",
    });
    expect(createChatPostHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: agentMock,
        generateText: generateTextMock,
        chatStore: { kind: "chat-store" },
        blobStore: { kind: "blob-store" },
        getOwner: expect.any(Function),
      }),
    );
    expect(Buffer.concat(stream.chunks).toString()).toBe("chat-stream");
  });

  it("returns auth errors before chat execution", async () => {
    const { AuthRequiredError } = await import("@/lib/auth/errors");
    createLambdaOwnerResolverMock.mockReturnValueOnce(
      vi.fn(async () => {
        throw new AuthRequiredError();
      }),
    );
    createChatPostHandlerMock.mockReturnValue(vi.fn(async () => new Response("should-not-run")));
    const { handleChatStreamingRequest } = await import("./handler");
    const stream = responseStream();

    await handleChatStreamingRequest(postEvent(), stream, { decorateResponseStream: (s) => s });

    expect(createChatPostHandlerMock).not.toHaveBeenCalled();
    const response = Buffer.concat(stream.chunks).toString();
    expect(response).toContain("Sign in to continue");
    expect(response).not.toContain("Lambda chat is not configured");
  });

  it("returns configuration errors before chat execution", async () => {
    vi.stubEnv("COGNITO_USER_POOL_ID", "");
    createChatPostHandlerMock.mockReturnValue(vi.fn(async () => new Response("should-not-run")));
    const { handleChatStreamingRequest } = await import("./handler");
    const stream = responseStream();

    await handleChatStreamingRequest(postEvent(), stream, { decorateResponseStream: (s) => s });

    expect(createChatPostHandlerMock).not.toHaveBeenCalled();
    expect(Buffer.concat(stream.chunks).toString()).toContain("Lambda chat is not configured");
  });
});
