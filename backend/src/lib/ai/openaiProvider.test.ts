import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class FakeOpenAI {
    chat = { completions: { create: createMock } };
  },
}));

vi.mock("./apiKey", () => ({ getOpenAIApiKey: () => "test-key" }));

const { OpenAIProvider } = await import("./openaiProvider");

describe("OpenAIProvider.chatCompletion", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("maps a plain text response", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "Hola, ¿en qué te ayudo?", tool_calls: undefined } }],
    });

    const provider = new OpenAIProvider();
    const result = await provider.chatCompletion([{ role: "user", content: "hola" }]);

    expect(result.message.content).toBe("Hola, ¿en qué te ayudo?");
    expect(result.toolCalls).toEqual([]);
  });

  it("maps tool_calls from the response into ToolCallRequest[]", async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "call_1", function: { name: "get_service_info", arguments: '{"query":"gel"}' } },
            ],
          },
        },
      ],
    });

    const provider = new OpenAIProvider();
    const result = await provider.chatCompletion([{ role: "user", content: "cuanto es el gel" }]);

    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "get_service_info", arguments: '{"query":"gel"}' },
    ]);
  });
});

describe("OpenAIProvider.streamChatCompletion", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  async function* fakeStream(chunks: unknown[]) {
    for (const chunk of chunks) yield chunk;
  }

  it("accumulates content deltas and forwards each one via onDelta", async () => {
    createMock.mockResolvedValue(
      fakeStream([
        { choices: [{ delta: { content: "Hola" } }] },
        { choices: [{ delta: { content: ", ¿en qué te ayudo?" } }] },
      ]),
    );

    const provider = new OpenAIProvider();
    const deltas: string[] = [];
    const result = await provider.streamChatCompletion([{ role: "user", content: "hola" }], undefined, (t) =>
      deltas.push(t),
    );

    expect(deltas).toEqual(["Hola", ", ¿en qué te ayudo?"]);
    expect(result.message.content).toBe("Hola, ¿en qué te ayudo?");
    expect(result.toolCalls).toEqual([]);
  });

  it("accumulates a tool call whose id/name/arguments arrive split across multiple chunks", async () => {
    createMock.mockResolvedValue(
      fakeStream([
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "get_serv", arguments: "" } }] } },
          ],
        },
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { name: "ice_info", arguments: '{"query"' } }] } },
          ],
        },
        {
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':"gel"}' } }] } }],
        },
      ]),
    );

    const provider = new OpenAIProvider();
    const result = await provider.streamChatCompletion(
      [{ role: "user", content: "cuanto es el gel" }],
      undefined,
      () => {},
    );

    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "get_service_info", arguments: '{"query":"gel"}' },
    ]);
  });
});
