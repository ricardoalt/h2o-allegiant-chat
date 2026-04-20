import { describe, expect, it, vi } from "vitest";
import type { UIMessage, ToolLoopAgent } from "ai";
import type { ChatStore } from "@/lib/storage/chat-store";
import type { BlobStore } from "@/lib/storage/blob-store";

// Mock the ai module
vi.mock("ai", () => ({
  convertToModelMessages: vi.fn(async (messages: unknown[]) => messages),
  createUIMessageStream: vi.fn(({ execute }: { execute: (arg: { writer: any }) => Promise<void> }) => {
    const stream = new ReadableStream({
      async start(controller) {
        await execute({
          writer: {
            write: () => undefined,
            merge: () => undefined,
          },
        });
        controller.close();
      },
    });

    return stream;
  }),
  createUIMessageStreamResponse: vi.fn(({ stream }: { stream: ReadableStream }) =>
    new Response(stream, { status: 200 }),
  ),
  generateText: vi.fn(),
  validateUIMessages: vi.fn(async ({ messages }: { messages: unknown[] }) => messages),
}));

// Create a mock agent factory
const createMockAgent = (responseText: string): ToolLoopAgent => {
  return {
    stream: vi.fn().mockImplementation(async ({ onFinish }: any) => {
      await onFinish?.({
        text: responseText,
        model: "anthropic.claude-sonnet-4-6-v1",
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50 },
      });

      return {
        toUIMessageStream: () =>
          new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
      };
    }),
  } as unknown as ToolLoopAgent;
};

const { createChatPostHandler } = await import("@/lib/chat-handler");

type TestMessage = UIMessage;

const buildRequest = (payload: unknown): Request =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

describe("api/chat handler", () => {
  it("persiste mensaje de usuario y respuesta final de asistente", async () => {
    const saveMessage = vi.fn<ChatStore["saveMessage"]>().mockResolvedValue(undefined);
    const getThreadById = vi
      .fn<ChatStore["getThreadById"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "thread-1",
        resourceId: "user-id",
        title: "New Chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    const store = {
      saveMessage,
      getThreadById,
      createThread: vi.fn<ChatStore["createThread"]>().mockResolvedValue({
        id: "thread-1",
        resourceId: "user-id",
        title: "New Chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      updateThreadTitle: vi.fn<ChatStore["updateThreadTitle"]>().mockResolvedValue(undefined),
      getThreadMessages: vi.fn<ChatStore["getThreadMessages"]>().mockResolvedValue([]),
      listThreads: vi.fn<ChatStore["listThreads"]>().mockResolvedValue([]),
      deleteThread: vi.fn<ChatStore["deleteThread"]>().mockResolvedValue(undefined),
      replaceAssistantMessageAfter: vi
        .fn<ChatStore["replaceAssistantMessageAfter"]>()
        .mockResolvedValue(undefined),
      cloneThread: vi.fn<ChatStore["cloneThread"]>().mockResolvedValue({
        id: "thread-2",
        resourceId: "user-id",
        title: "cloned",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    } satisfies ChatStore;

    const blobStore = {
      put: vi.fn<BlobStore["put"]>().mockResolvedValue({
        key: "secondstream/attachments/thread-1/file.txt",
        url: "https://bucket.s3.us-east-1.amazonaws.com/secondstream/attachments/thread-1/file.txt",
        sizeBytes: 4,
      }),
      get: vi.fn<BlobStore["get"]>().mockResolvedValue(Buffer.from("test", "utf8")),
      delete: vi.fn<BlobStore["delete"]>().mockResolvedValue(undefined),
    } satisfies BlobStore;

    const generateText = vi.fn().mockResolvedValue({ text: "Título generado" });
    const mockAgent = createMockAgent("respuesta final");

    const handler = createChatPostHandler({
      chatStore: store,
      blobStore,
      agent: mockAgent,
      generateText,
    });

    const response = await handler({
      request: buildRequest({
        threadId: "thread-1",
        modelId: "claude-sonnet-4-6",
        messages: [
          {
            id: "u-1",
            role: "user",
            parts: [{ type: "text", text: "hola" }],
          } satisfies TestMessage,
        ],
      }),
    });

    await response.text();

    expect(response.status).toBe(200);
    expect(saveMessage).toHaveBeenCalledTimes(2);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("en regeneración reemplaza mensaje asistente en vez de duplicar", async () => {
    const replaceAssistantMessageAfter = vi
      .fn<ChatStore["replaceAssistantMessageAfter"]>()
      .mockResolvedValue(undefined);

    const store = {
      saveMessage: vi.fn<ChatStore["saveMessage"]>().mockResolvedValue(undefined),
      getThreadById: vi.fn<ChatStore["getThreadById"]>().mockResolvedValue({
        id: "thread-1",
        resourceId: "user-id",
        title: "Título",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      createThread: vi.fn<ChatStore["createThread"]>().mockResolvedValue({
        id: "thread-1",
        resourceId: "user-id",
        title: "Título",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      updateThreadTitle: vi.fn<ChatStore["updateThreadTitle"]>().mockResolvedValue(undefined),
      getThreadMessages: vi.fn<ChatStore["getThreadMessages"]>().mockResolvedValue([
        {
          id: "u-1",
          role: "user",
          parts: [{ type: "text", text: "hola" }],
        },
        {
          id: "a-1",
          role: "assistant",
          parts: [{ type: "text", text: "respuesta vieja" }],
        },
      ]),
      listThreads: vi.fn<ChatStore["listThreads"]>().mockResolvedValue([]),
      deleteThread: vi.fn<ChatStore["deleteThread"]>().mockResolvedValue(undefined),
      replaceAssistantMessageAfter,
      cloneThread: vi.fn<ChatStore["cloneThread"]>().mockResolvedValue({
        id: "thread-2",
        resourceId: "user-id",
        title: "cloned",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    } satisfies ChatStore;

    const blobStore = {
      put: vi.fn<BlobStore["put"]>().mockResolvedValue({
        key: "secondstream/attachments/thread-1/file.txt",
        url: "https://bucket.s3.us-east-1.amazonaws.com/secondstream/attachments/thread-1/file.txt",
        sizeBytes: 4,
      }),
      get: vi.fn<BlobStore["get"]>().mockResolvedValue(Buffer.from("test", "utf8")),
      delete: vi.fn<BlobStore["delete"]>().mockResolvedValue(undefined),
    } satisfies BlobStore;

    const mockAgent = createMockAgent("respuesta nueva");

    const handler = createChatPostHandler({
      chatStore: store,
      blobStore,
      agent: mockAgent,
      generateText: vi.fn().mockResolvedValue({ text: "titulo" }),
    });

    await handler({
      request: buildRequest({
        threadId: "thread-1",
        modelId: "claude-sonnet-4-6",
        trigger: "regenerate-message",
        messageId: "a-1",
        messages: [
          {
            id: "u-1",
            role: "user",
            parts: [{ type: "text", text: "hola" }],
          } satisfies TestMessage,
        ],
      }),
    });

    

    expect(replaceAssistantMessageAfter).toHaveBeenCalledWith(
      "thread-1",
      "a-1",
      expect.objectContaining({
        role: "assistant",
        parts: [{ type: "text", text: "respuesta nueva" }],
      }),
    );
    expect(store.saveMessage).toHaveBeenCalledTimes(0);
  });

  it("si falla generación no persiste respuesta parcial de asistente", async () => {
    const saveMessage = vi.fn<ChatStore["saveMessage"]>().mockResolvedValue(undefined);
    const replaceAssistantMessageAfter = vi
      .fn<ChatStore["replaceAssistantMessageAfter"]>()
      .mockResolvedValue(undefined);

    const store = {
      saveMessage,
      getThreadById: vi.fn<ChatStore["getThreadById"]>().mockResolvedValue({
        id: "thread-1",
        resourceId: "user-id",
        title: "Título",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      createThread: vi.fn<ChatStore["createThread"]>().mockResolvedValue({
        id: "thread-1",
        resourceId: "user-id",
        title: "Título",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      updateThreadTitle: vi.fn<ChatStore["updateThreadTitle"]>().mockResolvedValue(undefined),
      getThreadMessages: vi.fn<ChatStore["getThreadMessages"]>().mockResolvedValue([]),
      listThreads: vi.fn<ChatStore["listThreads"]>().mockResolvedValue([]),
      deleteThread: vi.fn<ChatStore["deleteThread"]>().mockResolvedValue(undefined),
      replaceAssistantMessageAfter,
      cloneThread: vi.fn<ChatStore["cloneThread"]>().mockResolvedValue({
        id: "thread-2",
        resourceId: "user-id",
        title: "cloned",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    } satisfies ChatStore;

    const blobStore = {
      put: vi.fn<BlobStore["put"]>().mockResolvedValue({
        key: "secondstream/attachments/thread-1/file.txt",
        url: "https://bucket.s3.us-east-1.amazonaws.com/secondstream/attachments/thread-1/file.txt",
        sizeBytes: 4,
      }),
      get: vi.fn<BlobStore["get"]>().mockResolvedValue(Buffer.from("test", "utf8")),
      delete: vi.fn<BlobStore["delete"]>().mockResolvedValue(undefined),
    } satisfies BlobStore;

    const mockAgent = {
      stream: vi.fn().mockRejectedValue(new Error("bedrock timeout")),
    } as unknown as ToolLoopAgent;

    const handler = createChatPostHandler({
      chatStore: store,
      blobStore,
      agent: mockAgent,
      generateText: vi.fn().mockResolvedValue({ text: "titulo" }),
    });

    const response = await handler({
      request: buildRequest({
        threadId: "thread-1",
        modelId: "claude-sonnet-4-6",
        messages: [
          {
            id: "u-1",
            role: "user",
            parts: [{ type: "text", text: "hola" }],
          } satisfies TestMessage,
        ],
      }),
    });

    await response.text();

    expect(saveMessage).toHaveBeenCalledTimes(1);
    expect(replaceAssistantMessageAfter).not.toHaveBeenCalled();
  });
});
