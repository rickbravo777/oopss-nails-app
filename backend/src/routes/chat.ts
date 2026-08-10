import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { publishChatEvent, subscribeChatEvents } from "../lib/chatEvents";
import { buildConfirmedServicesNote, extractConfirmedServices } from "../lib/ai/confirmedServices";
import { OpenAIProvider } from "../lib/ai/openaiProvider";
import { buildSystemPrompt } from "../lib/ai/systemPrompt";
import { withServiceSelectionFallback } from "../lib/ai/serviceSelectionFallback";
import { AVAILABLE_TOOLS, createEscalateToHumanTool } from "../lib/ai/tools";
import { runToolLoop } from "../lib/ai/toolLoop";
import type { ChatMessage, ToolDefinition } from "../lib/ai/types";
import { openSSEChannel } from "../lib/sse";
import { prisma } from "../lib/prisma";
import { chatMessageLimiter, chatSessionLimiter } from "../lib/rateLimiters";
import { generateSessionToken } from "../lib/tokens";
import { requireClientSession } from "../middleware/requireClientSession";

export const chatRouter = Router();

const provider = new OpenAIProvider();

const NOT_FOUND_MESSAGE = "Conversación no encontrada";

function requireOwnConversation(req: Request, res: Response): boolean {
  if (req.conversation?.id !== req.params.id) {
    res.status(404).json({ error: NOT_FOUND_MESSAGE });
    return false;
  }
  return true;
}

const resumeSchema = z.object({
  resumeToken: z.string().optional(),
});

chatRouter.post("/sessions", chatSessionLimiter, async (req, res, next) => {
  try {
    const parsed = resumeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    if (parsed.data.resumeToken) {
      const existing = await prisma.conversation.findUnique({
        where: { sessionToken: parsed.data.resumeToken },
      });
      if (existing && existing.status !== "closed") {
        res.json({ sessionToken: existing.sessionToken, conversationId: existing.id });
        return;
      }
    }

    const conversation = await prisma.conversation.create({
      data: { sessionToken: generateSessionToken() },
    });

    res.json({ sessionToken: conversation.sessionToken, conversationId: conversation.id });
  } catch (err) {
    next(err);
  }
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  attachmentId: z.string().uuid().optional(),
});

chatRouter.post("/sessions/:id/messages", requireClientSession, chatMessageLimiter, async (req, res, next) => {
  try {
    if (!requireOwnConversation(req, res)) return;

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const conversationId = req.conversation!.id;
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content: parsed.data.content,
        attachmentId: parsed.data.attachmentId,
      },
    });

    await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });

    res.json({ messageId: userMessage.id, status: "processing" });

    // Fire-and-forget: the actual reply is delivered via the SSE stream, not this response.
    processAssistantReply(conversationId).catch((err) => {
      console.error("Chat processing failed", err);
      publishChatEvent(conversationId, {
        type: "error",
        message: "No se pudo generar una respuesta. Intenta de nuevo.",
      });
      prisma.errorLog
        .create({ data: { source: `chat:${conversationId}`, message: err instanceof Error ? err.message : String(err) } })
        .catch(() => {});
    });
  } catch (err) {
    next(err);
  }
});

async function processAssistantReply(conversationId: string): Promise<void> {
  const [systemPrompt, history] = await Promise.all([
    buildSystemPrompt(),
    prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } }),
  ]);

  // See confirmedServices.ts for why this exists — the model's own prior prose isn't reliable
  // enough to re-derive a validated service name from on a later "sí, agendemos" turn. Also
  // reused below by withServiceSelectionFallback's targeted fallback (trigger 5).
  const confirmedServices = extractConfirmedServices(history);
  const confirmedServicesNote = buildConfirmedServicesNote(confirmedServices.map((s) => s.name));
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(confirmedServicesNote ? [{ role: "system" as const, content: confirmedServicesNote }] : []),
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ];

  const tools: ToolDefinition[] = [...AVAILABLE_TOOLS, createEscalateToHumanTool(conversationId) as unknown as ToolDefinition];
  const result = await runToolLoop(provider, messages, tools, {
    onDelta: (text) => publishChatEvent(conversationId, { type: "delta", text }),
  });

  // Guarantee the picker on the assistant's very first reply of a conversation — the client
  // should always see it right after the greeting, not only when the model happens to call
  // the tool. Every later reply still falls back on the text heuristic, not this hard force.
  const isFirstAssistantReply = !history.some((m) => m.role === "assistant");
  const toolCallMeta = withServiceSelectionFallback(result.toolCallLog, result.finalMessage.content, {
    force: isFirstAssistantReply,
    confirmedServices,
  });

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: result.finalMessage.content,
      toolCallMeta: toolCallMeta.length ? (toolCallMeta as unknown as Prisma.InputJsonValue) : undefined,
    },
  });

  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });

  publishChatEvent(conversationId, {
    type: "done",
    messageId: assistantMessage.id,
    content: assistantMessage.content,
    toolCallMeta,
  });
}

chatRouter.get("/sessions/:id/stream", requireClientSession, (req, res) => {
  if (!requireOwnConversation(req, res)) return;

  const channel = openSSEChannel(res);
  const unsubscribe = subscribeChatEvents(req.conversation!.id, (event) => {
    channel.send(event.type, event);
  });

  req.on("close", unsubscribe);
});

chatRouter.get("/sessions/:id/messages", requireClientSession, async (req, res, next) => {
  try {
    if (!requireOwnConversation(req, res)) return;

    const messages = await prisma.message.findMany({
      where: { conversationId: req.conversation!.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, attachmentId: true, toolCallMeta: true, createdAt: true },
    });

    res.json({ messages });
  } catch (err) {
    next(err);
  }
});
