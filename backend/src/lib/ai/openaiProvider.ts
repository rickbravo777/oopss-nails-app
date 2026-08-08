import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

import { env } from "../../config/env";
import { getOpenAIApiKey } from "./apiKey";
import type {
  AIProvider,
  ChatCompletionResult,
  ChatMessage,
  ToolCallRequest,
  ToolDefinition,
} from "./types";

function toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_call_id: m.toolCallId! };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role as "system" | "user" | "assistant", content: m.content };
  });
}

function toOpenAITools(tools: ToolDefinition[] | undefined): ChatCompletionTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export class OpenAIProvider implements AIProvider {
  // Not cached across calls: the admin can rotate the key from the panel at any time, and
  // the next request should pick that up rather than keep using a stale client instance.
  private async getClient(): Promise<OpenAI> {
    return new OpenAI({ apiKey: await getOpenAIApiKey() });
  }

  async chatCompletion(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatCompletionResult> {
    const client = await this.getClient();
    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: toOpenAIMessages(messages),
      tools: toOpenAITools(tools),
    });

    const choice = response.choices[0];
    const toolCalls: ToolCallRequest[] = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      message: {
        role: "assistant",
        content: choice.message.content ?? "",
        toolCalls: toolCalls.length ? toolCalls : undefined,
      },
      toolCalls,
    };
  }

  async streamChatCompletion(
    messages: ChatMessage[],
    tools: ToolDefinition[] | undefined,
    onDelta: (text: string) => void,
  ): Promise<ChatCompletionResult> {
    const client = await this.getClient();
    const stream = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: toOpenAIMessages(messages),
      tools: toOpenAITools(tools),
      stream: true,
    });

    let content = "";
    const toolCallsByIndex = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        onDelta(delta.content);
      }
      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const existing = toolCallsByIndex.get(tcDelta.index) ?? { id: "", name: "", arguments: "" };
          if (tcDelta.id) existing.id = tcDelta.id;
          if (tcDelta.function?.name) existing.name += tcDelta.function.name;
          if (tcDelta.function?.arguments) existing.arguments += tcDelta.function.arguments;
          toolCallsByIndex.set(tcDelta.index, existing);
        }
      }
    }

    const toolCalls: ToolCallRequest[] = [...toolCallsByIndex.values()];

    return {
      message: { role: "assistant", content, toolCalls: toolCalls.length ? toolCalls : undefined },
      toolCalls,
    };
  }
}
