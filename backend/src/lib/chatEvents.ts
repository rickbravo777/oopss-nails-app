import { EventEmitter } from "node:events";

// Simple in-memory pub/sub bridging POST .../messages (which processes the AI reply) and
// GET .../stream (which forwards it to the client via SSE). In-memory is enough per
// design/stack_selection.md — single Node process, no Socket.io/Redis for this app's scale.
export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; content: string; toolCallMeta?: unknown }
  | { type: "error"; message: string };

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function publishChatEvent(conversationId: string, event: ChatEvent): void {
  emitter.emit(conversationId, event);
}

export function subscribeChatEvents(
  conversationId: string,
  listener: (event: ChatEvent) => void,
): () => void {
  emitter.on(conversationId, listener);
  return () => emitter.off(conversationId, listener);
}
