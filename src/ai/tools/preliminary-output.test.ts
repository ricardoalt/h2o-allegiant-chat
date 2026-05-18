import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { streamText, tool } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Empirical guard that the AI SDK v6 surfaces every intermediate yield of an
 * async-generator tool as a `tool-output-available` UI chunk with
 * `preliminary: true`, and re-emits the final yield without that flag.
 *
 * Without this guarantee, the artifact "Preparing… → Ready" progress card
 * jumps straight from Pending to Ready with no intermediate feedback.
 */
describe("AI SDK async-generator tool preliminary outputs", () => {
  it("emits preliminary tool-output-available chunks for every intermediate yield", async () => {
    const sampleTool = tool({
      description: "Sample async-generator tool with three progress phases.",
      inputSchema: z.object({ topic: z.string() }),
      async *execute({ topic }) {
        yield { phase: "rendering" as const, topic };
        yield { phase: "storing" as const, topic };
        yield { phase: "persisting" as const, topic };
        yield { phase: "ready" as const, topic, artifactId: "art-1" };
      },
    });

    const streamChunks: LanguageModelV3StreamPart[] = [
      { type: "stream-start", warnings: [] },
      {
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "sampleTool",
        input: JSON.stringify({ topic: "lagoons" }),
      },
      {
        type: "finish",
        finishReason: { unified: "tool-calls", raw: "tool_use" },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 10, text: 10, reasoning: undefined },
        },
      },
    ];
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({ chunks: streamChunks }),
      }),
    });

    const result = streamText({
      model,
      prompt: "Generate a sample artifact.",
      tools: { sampleTool },
    });

    const toolOutputChunks: Array<{
      preliminary?: boolean;
      output: { phase: string };
    }> = [];

    for await (const chunk of result.toUIMessageStream()) {
      if (chunk.type === "tool-output-available") {
        toolOutputChunks.push({
          preliminary: (chunk as { preliminary?: boolean }).preliminary,
          output: chunk.output as { phase: string },
        });
      }
    }

    // AI SDK contract (provider-utils executeTool, dist/index.mjs:2682-2693):
    // Every async-generator yield surfaces as a preliminary chunk; then the
    // LAST yield value is re-emitted as a final chunk. Tool yielding N items
    // therefore produces N+1 UI chunks: N preliminary + 1 final whose content
    // equals the last preliminary. The artifact UI is safe because both
    // "ready" chunks render the same download card.
    expect(toolOutputChunks.map((c) => c.output.phase)).toEqual([
      "rendering",
      "storing",
      "persisting",
      "ready",
      "ready",
    ]);
    expect(toolOutputChunks.slice(0, 4).every((c) => c.preliminary === true)).toBe(true);
    expect(toolOutputChunks.at(-1)?.preliminary).toBeFalsy();
  });
});
