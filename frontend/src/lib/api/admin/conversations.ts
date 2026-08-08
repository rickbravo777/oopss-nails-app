import { apiFetch } from "../../apiClient";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system" | "human_agent";
  content: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  status: string;
  client: { name: string; phone: string } | null;
  messages: ConversationMessage[];
}

export function fetchConversation(id: string): Promise<ConversationDetail> {
  return apiFetch(`/admin/conversations/${id}`);
}
