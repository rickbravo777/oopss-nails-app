import type { AIProvider, ChatMessage, ToolDefinition } from "./types";

export interface ToolCallLogEntry {
  tool: string;
  arguments: unknown;
  result?: unknown;
  error?: string;
}

export interface RunToolLoopResult {
  finalMessage: ChatMessage;
  toolCallLog: ToolCallLogEntry[];
}

const DEFAULT_MAX_ROUNDS = 4;

// Runs the request → tool-call → tool-result → follow-up cycle until the model returns a
// final answer with no further tool calls. The last round is always made with no tools
// offered, forcing a text-only reply — so a client message NEVER dead-ends in a thrown error
// (which the user experiences as the chat silently failing); worst case, the assistant answers
// without having resolved every tool call, which is still a real reply it can recover from on
// the next turn.
export async function runToolLoop(
  provider: AIProvider,
  initialMessages: ChatMessage[],
  tools: ToolDefinition[],
  options: { onDelta?: (text: string) => void; maxRounds?: number } = {},
): Promise<RunToolLoopResult> {
  const messages = [...initialMessages];
  const toolCallLog: ToolCallLogEntry[] = [];
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const toolsByName = new Map(tools.map((t) => [t.name, t]));

  for (let round = 0; round < maxRounds; round++) {
    const roundTools = round < maxRounds - 1 ? tools : undefined;
    const result = options.onDelta
      ? await provider.streamChatCompletion(messages, roundTools, options.onDelta)
      : await provider.chatCompletion(messages, roundTools);

    if (!result.toolCalls.length) {
      return { finalMessage: result.message, toolCallLog };
    }

    messages.push(result.message);

    for (const call of result.toolCalls) {
      const tool = toolsByName.get(call.name);
      let parsedArgs: unknown = {};
      try {
        parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        // Leave parsedArgs as {} — surfaced to the model as a tool error below.
      }

      if (!tool) {
        const error = `Unknown tool: ${call.name}`;
        toolCallLog.push({ tool: call.name, arguments: parsedArgs, error });
        messages.push({ role: "tool", content: JSON.stringify({ error }), toolCallId: call.id });
        continue;
      }

      try {
        const toolResult = await tool.handler(parsedArgs as never);
        toolCallLog.push({ tool: call.name, arguments: parsedArgs, result: toolResult });
        messages.push({ role: "tool", content: JSON.stringify(toolResult), toolCallId: call.id });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Tool execution failed";
        toolCallLog.push({ tool: call.name, arguments: parsedArgs, error });
        messages.push({ role: "tool", content: JSON.stringify({ error }), toolCallId: call.id });
      }
    }
  }

  // Unreachable in practice: the last iteration above always requests roundTools=undefined,
  // which forces the model into a tool-call-free reply that returns before this line. Kept as
  // a defensive guard in case a provider implementation ignores the "no tools offered" signal.
  throw new Error(`Tool loop exceeded ${maxRounds} rounds without a final answer`);
}
