const API_BASE = "/api/v1";

export interface ToolCallLogEntry {
  tool: string;
  arguments: unknown;
  result?: unknown;
  error?: string;
}

export interface ChatMessageDto {
  id: string;
  role: "user" | "assistant" | "system" | "human_agent";
  content: string;
  attachmentId?: string | null;
  toolCallMeta?: ToolCallLogEntry[] | null;
  createdAt?: string;
}

async function parseErrorOr<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error ?? fallback);
}

export function createChatSession(resumeToken?: string) {
  return fetch(`${API_BASE}/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeToken }),
  }).then((res) => parseErrorOr<{ sessionToken: string; conversationId: string }>(res, "No se pudo iniciar el chat"));
}

export function sendChatMessage(
  conversationId: string,
  sessionToken: string,
  content: string,
  attachmentId?: string,
) {
  return fetch(`${API_BASE}/chat/sessions/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
    body: JSON.stringify({ content, attachmentId }),
  }).then((res) => parseErrorOr<{ messageId: string; status: string }>(res, "No se pudo enviar el mensaje"));
}

export function fetchChatHistory(conversationId: string, sessionToken: string) {
  return fetch(`${API_BASE}/chat/sessions/${conversationId}/messages`, {
    headers: { "X-Session-Token": sessionToken },
  }).then((res) => parseErrorOr<{ messages: ChatMessageDto[] }>(res, "No se pudo cargar el historial"));
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; content: string; toolCallMeta?: ToolCallLogEntry[] }
  | { type: "error"; message: string }
  // Fired whenever a connection attempt succeeds AFTER at least one prior failure in this
  // stream's lifetime — including the very first attempt at mount, if the backend happened to
  // be briefly unreachable then. The caller should re-fetch history here: any assistant reply
  // generated while disconnected was saved to the DB but its "done" event was missed (the
  // stream has no replay buffer), so without this the client would be stuck on a stale
  // conversation (and a stale error banner) until a manual page refresh.
  | { type: "reconnected" };

const RECONNECT_DELAY_MS = 1500;

// Uses fetch + a manual SSE line-parser rather than the native EventSource API, since
// EventSource can't send custom headers and X-Session-Token must not be exposed via the URL.
// Auto-reconnects on drop (dev-server restarts, brief network/deploy blips) instead of leaving
// the client silently stuck until the page is manually refreshed — verified live that without
// this, a reply generated while disconnected never appeared until reload.
export function openChatStream(
  conversationId: string,
  sessionToken: string,
  onEvent: (event: ChatStreamEvent) => void,
): () => void {
  const controller = new AbortController();
  // Tracks "has this stream seen an error it hasn't recovered from yet" — NOT "is this the
  // first attempt" (that was the actual bug: if the very first attempt failed a few times
  // before finally succeeding, `reconnected` never fired and the error banner stuck around
  // forever even though the connection was healthy again).
  let hadError = false;

  (async () => {
    while (!controller.signal.aborted) {
      try {
        const res = await fetch(`${API_BASE}/chat/sessions/${conversationId}/stream`, {
          headers: { "X-Session-Token": sessionToken },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error("stream request failed");

        if (hadError) onEvent({ type: "reconnected" });
        hadError = false;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIndex = buffer.indexOf("\n\n");
          while (sepIndex !== -1) {
            const rawEvent = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
            if (dataLine) {
              try {
                onEvent(JSON.parse(dataLine.slice("data: ".length)));
              } catch {
                // Ignore a malformed frame rather than crashing the whole stream reader.
              }
            }
            sepIndex = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        hadError = true;
        onEvent({ type: "error", message: "Se perdió la conexión con el asistente. Reconectando…" });
      }

      if (controller.signal.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
  })();

  return () => controller.abort();
}
