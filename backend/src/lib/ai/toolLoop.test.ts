import { describe, expect, it, vi } from "vitest";

import { runToolLoop } from "./toolLoop";
import type { AIProvider, ChatCompletionResult, ToolDefinition } from "./types";

function fakeProvider(responses: ChatCompletionResult[]): AIProvider {
  let call = 0;
  return {
    chatCompletion: vi.fn(async () => {
      const result = responses[call];
      call += 1;
      return result;
    }),
    streamChatCompletion: vi.fn(async () => {
      const result = responses[call];
      call += 1;
      return result;
    }),
  };
}

const priceLookupTool: ToolDefinition<{ query: string }> = {
  name: "get_service_info",
  description: "test tool",
  parameters: { type: "object", properties: { query: { type: "string" } } },
  handler: vi.fn(async ({ query }) => ({ found: true, query, price: 24 })),
};

describe("runToolLoop", () => {
  it("returns the final message directly when the model makes no tool calls", async () => {
    const provider = fakeProvider([
      { message: { role: "assistant", content: "Hola, ¿en qué te ayudo?" }, toolCalls: [] },
    ]);

    const result = await runToolLoop(provider, [{ role: "user", content: "hola" }], [priceLookupTool]);

    expect(result.finalMessage.content).toBe("Hola, ¿en qué te ayudo?");
    expect(result.toolCallLog).toEqual([]);
  });

  it("executes a requested tool, feeds the result back, and returns the follow-up answer", async () => {
    const provider = fakeProvider([
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "get_service_info", arguments: '{"query":"manicure gel"}' }],
        },
        toolCalls: [{ id: "call_1", name: "get_service_info", arguments: '{"query":"manicure gel"}' }],
      },
      { message: { role: "assistant", content: "El Manicure Gel cuesta $24." }, toolCalls: [] },
    ]);

    const result = await runToolLoop(provider, [{ role: "user", content: "¿cuánto es el gel?" }], [
      priceLookupTool,
    ]);

    expect(priceLookupTool.handler).toHaveBeenCalledWith({ query: "manicure gel" });
    expect(result.finalMessage.content).toBe("El Manicure Gel cuesta $24.");
    expect(result.toolCallLog).toEqual([
      { tool: "get_service_info", arguments: { query: "manicure gel" }, result: { found: true, query: "manicure gel", price: 24 } },
    ]);
  });

  it("logs an error and keeps going when the model calls an unknown tool", async () => {
    const provider = fakeProvider([
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "not_a_real_tool", arguments: "{}" }],
        },
        toolCalls: [{ id: "call_1", name: "not_a_real_tool", arguments: "{}" }],
      },
      { message: { role: "assistant", content: "Lo siento, no tengo esa información." }, toolCalls: [] },
    ]);

    const result = await runToolLoop(provider, [{ role: "user", content: "hola" }], [priceLookupTool]);

    expect(result.toolCallLog).toEqual([
      { tool: "not_a_real_tool", arguments: {}, error: "Unknown tool: not_a_real_tool" },
    ]);
    expect(result.finalMessage.content).toBe("Lo siento, no tengo esa información.");
  });

  it("catches a tool handler error and surfaces it in the log instead of throwing", async () => {
    const failingTool: ToolDefinition = {
      name: "boom",
      description: "always fails",
      parameters: { type: "object", properties: {} },
      handler: vi.fn(async () => {
        throw new Error("db unavailable");
      }),
    };
    const provider = fakeProvider([
      {
        message: { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "boom", arguments: "{}" }] },
        toolCalls: [{ id: "call_1", name: "boom", arguments: "{}" }],
      },
      { message: { role: "assistant", content: "Algo salió mal, un momento." }, toolCalls: [] },
    ]);

    const result = await runToolLoop(provider, [{ role: "user", content: "hola" }], [failingTool]);

    expect(result.toolCallLog).toEqual([{ tool: "boom", arguments: {}, error: "db unavailable" }]);
  });

  it("forces a tools-less final round instead of throwing, so the model must answer in text", async () => {
    const wantsMoreTools = {
      message: {
        role: "assistant" as const,
        content: "",
        toolCalls: [{ id: "call_1", name: "get_service_info", arguments: '{"query":"x"}' }],
      },
      toolCalls: [{ id: "call_1", name: "get_service_info", arguments: '{"query":"x"}' }],
    };
    const forcedTextAnswer = {
      message: { role: "assistant" as const, content: "No logré confirmar eso, ¿me das más detalles?" },
      toolCalls: [],
    };
    const provider = fakeProvider([wantsMoreTools, forcedTextAnswer]);

    const result = await runToolLoop(provider, [{ role: "user", content: "¿está disponible Yez?" }], [priceLookupTool], {
      maxRounds: 2,
    });

    expect(result.finalMessage.content).toBe("No logré confirmar eso, ¿me das más detalles?");
    // Round 0 (round < maxRounds - 1) still offers the tools; the final round is called with
    // no tools at all so the model can't keep calling them instead of answering.
    expect(provider.chatCompletion).toHaveBeenNthCalledWith(1, expect.any(Array), [priceLookupTool]);
    expect(provider.chatCompletion).toHaveBeenNthCalledWith(2, expect.any(Array), undefined);
  });

  it("throws if even the tools-less forced round still comes back with tool calls (defensive guard)", async () => {
    const infiniteToolCall = {
      message: {
        role: "assistant" as const,
        content: "",
        toolCalls: [{ id: "call_1", name: "get_service_info", arguments: '{"query":"x"}' }],
      },
      toolCalls: [{ id: "call_1", name: "get_service_info", arguments: '{"query":"x"}' }],
    };
    const provider = fakeProvider(Array(10).fill(infiniteToolCall));

    await expect(
      runToolLoop(provider, [{ role: "user", content: "hola" }], [priceLookupTool], { maxRounds: 2 }),
    ).rejects.toThrow(/exceeded 2 rounds/);
  });

  it("uses streamChatCompletion and forwards onDelta when provided", async () => {
    const onDelta = vi.fn();
    const provider = fakeProvider([
      { message: { role: "assistant", content: "Hola" }, toolCalls: [] },
    ]);

    await runToolLoop(provider, [{ role: "user", content: "hola" }], [priceLookupTool], { onDelta });

    expect(provider.streamChatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      [priceLookupTool],
      onDelta,
    );
    expect(provider.chatCompletion).not.toHaveBeenCalled();
  });
});
