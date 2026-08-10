import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ServiceBookingFlow } from "../components/booking/ServiceBookingFlow";
import { ChatWelcome } from "../components/ChatWelcome";
import { GuidedBooking } from "../components/GuidedBooking";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  type ChatMessageDto,
  type ToolCallLogEntry,
  createChatSession,
  fetchChatHistory,
  openChatStream,
  sendChatMessage,
} from "../lib/api/chat";
import { uploadChatPhoto } from "../lib/api/uploads";

const RESUME_TOKEN_KEY = "oopss-chat-session-token";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  toolCallMeta?: ToolCallLogEntry[] | null;
}

function offeredServiceSelection(toolCallMeta?: ToolCallLogEntry[] | null): boolean {
  return Boolean(toolCallMeta?.some((entry) => entry.tool === "offer_service_selection"));
}

// Categories the AI already narrowed down from what the client said (e.g. "las uñas" ->
// ["Manos","Pies"]), validated server-side (offerServiceSelection.ts) against the real
// catalog — undefined/empty means show every category, same as before this existed.
function offeredCategories(toolCallMeta?: ToolCallLogEntry[] | null): string[] | undefined {
  const entry = toolCallMeta?.find((e) => e.tool === "offer_service_selection");
  const result = entry?.result as { categories?: string[] } | undefined;
  return result?.categories && result.categories.length > 0 ? result.categories : undefined;
}

// The exact service the client already confirmed she wants (e.g. after a Q&A resolved via
// get_service_info) — validated server-side against the real catalog. When present, the
// booking flow skips categoría AND servicio entirely and jumps straight to especialista →
// fecha → hora → datos for this one service, instead of asking for those details in prose.
function offeredServiceId(toolCallMeta?: ToolCallLogEntry[] | null): string | undefined {
  const entry = toolCallMeta?.find((e) => e.tool === "offer_service_selection");
  const result = entry?.result as { serviceId?: string } | undefined;
  return result?.serviceId;
}

// Set when the AI matched a service from imprecise/misspelled client wording but isn't fully
// confident it's the right one — the booking flow asks "¿Quieres agendar X? Sí/No" with a
// single tap before proceeding, instead of assuming.
function offeredNeedsConfirmation(toolCallMeta?: ToolCallLogEntry[] | null): boolean {
  const entry = toolCallMeta?.find((e) => e.tool === "offer_service_selection");
  const result = entry?.result as { needsConfirmation?: boolean } | undefined;
  return Boolean(result?.needsConfirmation);
}

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get("service");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [dismissedWelcome, setDismissedWelcome] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingMessageId = useRef<string | null>(null);
  // Mirrors `sending` state for reading inside setTimeout callbacks, where a closure over the
  // state variable itself would see whatever value was current when the timeout was scheduled,
  // not the latest one.
  const sendingRef = useRef(false);
  // Bumped on every new message sent — a poll loop captures its value at start and bails if it
  // no longer matches, so an old poll from a previous message can't clobber state after the
  // user has already moved on to a new one.
  const pollGenerationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const resumeToken = localStorage.getItem(RESUME_TOKEN_KEY) ?? undefined;
      const session = await createChatSession(resumeToken).catch(() => null);
      if (!session || cancelled) return;

      localStorage.setItem(RESUME_TOKEN_KEY, session.sessionToken);
      setConversationId(session.conversationId);
      setSessionToken(session.sessionToken);

      const history = await fetchChatHistory(session.conversationId, session.sessionToken).catch(() => null);
      if (history && !cancelled) {
        setMessages(
          history.messages
            .filter((m): m is ChatMessageDto & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
            .map((m) => ({ id: m.id, role: m.role, content: m.content, toolCallMeta: m.toolCallMeta })),
        );
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  // Replaces `messages` with the server's own record of the conversation — used both when the
  // stream reconnects after a drop, and by the polling safety net below. Single source of
  // truth for "what actually happened," since it reads the same data the AI itself worked from.
  async function syncFromHistory(convId: string, token: string) {
    const history = await fetchChatHistory(convId, token);
    setMessages(
      history.messages
        .filter((m): m is ChatMessageDto & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role, content: m.content, toolCallMeta: m.toolCallMeta })),
    );
    streamingMessageId.current = null;
    setSending(false);
  }

  // Safety net for when the real-time channel silently fails to deliver an event (reply is
  // generated and saved server-side, but the "delta"/"done" events never arrive client-side —
  // seen live, cause not fully pinned down, most likely a quirk of a specific dev/network
  // environment rather than the app itself; SSE has no replay buffer so a missed event is gone
  // for good). Rather than leave the client waiting forever, poll the real conversation history
  // a few times after sending — if the stream never resolves it, this does instead, so the
  // client is never dependent on a single fragile channel to see her own reply.
  function schedulePollFallback(convId: string, token: string, generation: number) {
    const POLL_DELAY_MS = 4000;
    const MAX_ATTEMPTS = 6;

    function attempt(n: number) {
      setTimeout(async () => {
        if (pollGenerationRef.current !== generation || !sendingRef.current) return;
        try {
          await syncFromHistory(convId, token);
        } catch {
          // Network hiccup on the poll itself — just try again next attempt.
        }
        if (pollGenerationRef.current === generation && sendingRef.current && n < MAX_ATTEMPTS) {
          attempt(n + 1);
        }
      }, POLL_DELAY_MS);
    }

    attempt(1);
  }

  useEffect(() => {
    if (!conversationId || !sessionToken) return;

    const close = openChatStream(conversationId, sessionToken, (event) => {
      if (event.type === "delta") {
        setMessages((prev) => {
          if (streamingMessageId.current) {
            return prev.map((m) =>
              m.id === streamingMessageId.current ? { ...m, content: m.content + event.text } : m,
            );
          }
          const tempId = `streaming-${Date.now()}`;
          streamingMessageId.current = tempId;
          return [...prev, { id: tempId, role: "assistant", content: event.text, pending: true }];
        });
      } else if (event.type === "done") {
        setMessages((prev) => {
          if (streamingMessageId.current) {
            return prev.map((m) =>
              m.id === streamingMessageId.current
                ? { id: event.messageId, role: "assistant", content: event.content, toolCallMeta: event.toolCallMeta }
                : m,
            );
          }
          // No "delta" arrived before this "done" — e.g. the reply came back in too few
          // streaming chunks for any to land before completion, or a tool-call-only round
          // preceded the text. There's no placeholder bubble to fill in, so append the
          // finished message directly instead of silently dropping it (the actual root cause
          // of "the assistant answered but I never saw it" — the message WAS saved server-side
          // the whole time, `.map()` here just had nothing to match against).
          return [...prev, { id: event.messageId, role: "assistant", content: event.content, toolCallMeta: event.toolCallMeta }];
        });
        streamingMessageId.current = null;
        setSending(false);
      } else if (event.type === "error") {
        setConnectionError(event.message);
        setSending(false);
      } else if (event.type === "reconnected") {
        setConnectionError(null);
        // A reply may have been generated (and saved) while the stream was down — the SSE
        // channel has no replay buffer, so re-fetch history to pick up anything that was missed
        // instead of leaving the client stuck until a manual page refresh.
        syncFromHistory(conversationId, sessionToken).catch(() => {});
      }
    });

    return close;
  }, [conversationId, sessionToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (serviceId) {
      setInput((prev) => prev || `Quisiera información sobre este servicio (id ${serviceId})`);
    }
  }, [serviceId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!conversationId || !sessionToken || !input.trim() || sending) return;

    const content = input.trim();
    const attachment = pendingAttachment;
    setInput("");
    setPendingAttachment(null);
    setConnectionError(null);
    setSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        content: attachment ? `${content}\n📎 ${attachment.name}` : content,
      },
    ]);

    const generation = ++pollGenerationRef.current;

    try {
      await sendChatMessage(conversationId, sessionToken, content, attachment?.id);
      schedulePollFallback(conversationId, sessionToken, generation);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
      setSending(false);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !sessionToken) return;

    setUploading(true);
    setConnectionError(null);
    try {
      const photo = await uploadChatPhoto(sessionToken, file);
      setPendingAttachment({ id: photo.id, name: file.name });
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <img src="/logo-lockup.png" alt="Oopss Nails" className="h-9 w-auto rounded-md" />
        <Button onClick={() => setShowBooking(true)} disabled={!sessionToken}>
          📅 Agendar cita
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && !dismissedWelcome && sessionToken && (
          <ChatWelcome sessionToken={sessionToken} onStartTyping={() => setDismissedWelcome(true)} />
        )}
        {messages.length === 0 && dismissedWelcome && (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Pregúntame sobre servicios, precios o qué especialista atiende cada uno 😊
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col gap-2">
            <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <Card
                className="max-w-[80%] p-3 text-sm"
                style={{
                  backgroundColor: m.role === "user" ? "var(--color-primary)" : undefined,
                  color: m.role === "user" ? "white" : "var(--color-text)",
                }}
              >
                {m.content || (m.pending ? "…" : "")}
              </Card>
            </div>
            {m.role === "assistant" && offeredServiceSelection(m.toolCallMeta) && sessionToken && (
              <Card className="max-w-[80%]">
                <ServiceBookingFlow
                  sessionToken={sessionToken}
                  showProgress={false}
                  initialCategories={offeredCategories(m.toolCallMeta)}
                  initialServiceId={offeredServiceId(m.toolCallMeta)}
                  initialServiceNeedsConfirmation={offeredNeedsConfirmation(m.toolCallMeta)}
                />
              </Card>
            )}
          </div>
        ))}
        {connectionError && (
          <p className="text-sm" style={{ color: "var(--color-error)" }}>
            {connectionError}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {pendingAttachment && (
        <p className="mb-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          📎 {pendingAttachment.name} lista para enviar{" "}
          <button type="button" onClick={() => setPendingAttachment(null)} style={{ color: "var(--color-error)" }}>
            quitar
          </button>
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!sessionToken || uploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Adjuntar foto"
        >
          {uploading ? "…" : "📎"}
        </Button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu mensaje…"
          disabled={!conversationId || sending}
          className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
        />
        <Button type="submit" disabled={!conversationId || sending || !input.trim()}>
          Enviar
        </Button>
      </form>

      {showBooking && sessionToken && <GuidedBooking sessionToken={sessionToken} onClose={() => setShowBooking(false)} />}
    </main>
  );
}
