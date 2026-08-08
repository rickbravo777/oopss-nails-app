import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../lib/prisma";

vi.mock("../lib/prisma", () => ({
  prisma: {
    conversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    message: { create: vi.fn(), findMany: vi.fn() },
    // Not asserted on directly in these tests, but touched by the fire-and-forget
    // background AI processing kicked off after a message is posted — mocked so that
    // background path resolves/rejects cleanly instead of throwing on undefined access.
    termSynonym: { findMany: vi.fn().mockResolvedValue([]) },
    assistantPolicy: { findMany: vi.fn().mockResolvedValue([]) },
    errorLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

// Avoid touching the real AI engine / making any network call from this test file.
vi.mock("../lib/ai/openaiProvider", () => ({
  OpenAIProvider: class {
    chatCompletion = vi.fn();
    streamChatCompletion = vi.fn();
  },
}));

const { createApp } = await import("../app");

const mockedConversationFindUnique = vi.mocked(prisma.conversation.findUnique);
const mockedConversationCreate = vi.mocked(prisma.conversation.create);
const mockedConversationUpdate = vi.mocked(prisma.conversation.update);
const mockedMessageCreate = vi.mocked(prisma.message.create);
const mockedMessageFindMany = vi.mocked(prisma.message.findMany);

const CONVERSATION_ID = "11111111-1111-1111-1111-111111111111";
const FAKE_CONVERSATION = { id: CONVERSATION_ID, sessionToken: "session-abc", clientId: null };

describe("POST /api/v1/chat/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new session when no resumeToken is given", async () => {
    mockedConversationCreate.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp()).post("/api/v1/chat/sessions").send({});

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe(CONVERSATION_ID);
  });

  it("resumes an existing open session when a valid resumeToken is given", async () => {
    mockedConversationFindUnique.mockResolvedValue({ ...FAKE_CONVERSATION, status: "active" } as never);

    const res = await request(createApp()).post("/api/v1/chat/sessions").send({ resumeToken: "session-abc" });

    expect(res.status).toBe(200);
    expect(res.body.sessionToken).toBe("session-abc");
    expect(mockedConversationCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/chat/sessions/:id/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a session token", async () => {
    const res = await request(createApp())
      .post(`/api/v1/chat/sessions/${CONVERSATION_ID}/messages`)
      .send({ content: "hola" });

    expect(res.status).toBe(401);
  });

  it("rejects a session token whose conversation doesn't match the URL id", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp())
      .post(`/api/v1/chat/sessions/some-other-conversation-id/messages`)
      .set("X-Session-Token", "session-abc")
      .send({ content: "hola" });

    expect(res.status).toBe(404);
    expect(mockedMessageCreate).not.toHaveBeenCalled();
  });

  it("persists the user message and returns a processing status", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);
    mockedMessageCreate.mockResolvedValue({ id: "msg-1", role: "user", content: "hola" } as never);
    mockedConversationUpdate.mockResolvedValue({} as never);
    mockedMessageFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .post(`/api/v1/chat/sessions/${CONVERSATION_ID}/messages`)
      .set("X-Session-Token", "session-abc")
      .send({ content: "¿cuánto cuesta el Balayage?" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ messageId: "msg-1", status: "processing" });
    expect(mockedMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          role: "user",
          content: "¿cuánto cuesta el Balayage?",
        }),
      }),
    );
  });

  it("rejects an empty message", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp())
      .post(`/api/v1/chat/sessions/${CONVERSATION_ID}/messages`)
      .set("X-Session-Token", "session-abc")
      .send({ content: "" });

    expect(res.status).toBe(400);
    expect(mockedMessageCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/chat/sessions/:id/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a session token", async () => {
    const res = await request(createApp()).get(`/api/v1/chat/sessions/${CONVERSATION_ID}/messages`);
    expect(res.status).toBe(401);
  });

  it("returns the conversation's message history for its own session", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);
    mockedMessageFindMany.mockResolvedValue([
      { id: "msg-1", role: "user", content: "hola", attachmentId: null, createdAt: new Date() },
      { id: "msg-2", role: "assistant", content: "¡Hola! ¿En qué te ayudo?", attachmentId: null, createdAt: new Date() },
    ] as never);

    const res = await request(createApp())
      .get(`/api/v1/chat/sessions/${CONVERSATION_ID}/messages`)
      .set("X-Session-Token", "session-abc");

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
  });

  it("includes each message's toolCallMeta, so the frontend can render the inline service picker after offer_service_selection", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);
    mockedMessageFindMany.mockResolvedValue([
      {
        id: "msg-1",
        role: "assistant",
        content: "¡Claro! Aquí tienes nuestros servicios 👇",
        attachmentId: null,
        toolCallMeta: [{ tool: "offer_service_selection", arguments: {}, result: { shown: true } }],
        createdAt: new Date(),
      },
    ] as never);

    const res = await request(createApp())
      .get(`/api/v1/chat/sessions/${CONVERSATION_ID}/messages`)
      .set("X-Session-Token", "session-abc");

    expect(res.status).toBe(200);
    expect(res.body.messages[0].toolCallMeta).toEqual([
      { tool: "offer_service_selection", arguments: {}, result: { shown: true } },
    ]);
  });

  it("rejects a session token that doesn't own the requested conversation", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp())
      .get(`/api/v1/chat/sessions/some-other-id/messages`)
      .set("X-Session-Token", "session-abc");

    expect(res.status).toBe(404);
  });
});
