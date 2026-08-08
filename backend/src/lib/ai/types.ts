export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCallRequest[];
  name?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string; // raw JSON string, as returned by the model
}

export interface ToolDefinition<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
  handler: (args: TArgs) => Promise<unknown>;
}

export interface ChatCompletionResult {
  message: ChatMessage;
  toolCalls: ToolCallRequest[];
}

export interface AIProvider {
  chatCompletion(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatCompletionResult>;
  streamChatCompletion(
    messages: ChatMessage[],
    tools: ToolDefinition[] | undefined,
    onDelta: (text: string) => void,
  ): Promise<ChatCompletionResult>;
}
