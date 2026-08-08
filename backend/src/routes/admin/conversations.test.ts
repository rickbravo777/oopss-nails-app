import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
    },
  },
}));

const { createApp } = await import("../../app");

const mockedFindUnique = vi.mocked(prisma.conversation.findUnique);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

const FAKE_CONVERSATION = {
  id: "conv-1",
  status: "handed_off",
  client: { name: "Ana Pérez", phone: "5551234567" },
  messages: [
    { id: "msg-1", role: "user", content: "Hola, tengo una duda", attachmentId: null, createdAt: new Date("2026-08-04T10:00:00Z") },
    { id: "msg-2", role: "assistant", content: "Claro, cuéntame", attachmentId: null, createdAt: new Date("2026-08-04T10:00:05Z") },
  ],
};

describe("GET /api/v1/admin/conversations/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/conversations/conv-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the conversation doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .get("/api/v1/admin/conversations/does-not-exist")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it("returns the conversation transcript with client info", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp())
      .get("/api/v1/admin/conversations/conv-1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.client).toEqual({ name: "Ana Pérez", phone: "5551234567" });
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0]).toMatchObject({ role: "user", content: "Hola, tengo una duda" });
  });
});
