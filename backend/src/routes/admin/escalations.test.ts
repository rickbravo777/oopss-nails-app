import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    escalationFlag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { createApp } = await import("../../app");

const mockedFindMany = vi.mocked(prisma.escalationFlag.findMany);
const mockedFindUnique = vi.mocked(prisma.escalationFlag.findUnique);
const mockedUpdate = vi.mocked(prisma.escalationFlag.update);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

const FAKE_ESCALATION = {
  id: "esc-1",
  conversationId: "conv-1",
  reason: "facial_recommendation",
  status: "open",
  assignedSpecialist: { id: "spec-1", name: "Sonia" },
  resolutionNotes: "Duda sobre tipo de piel",
  createdAt: new Date("2026-08-04"),
  resolvedAt: null,
  conversation: { client: { name: "Ana Pérez", phone: "5551234567" } },
};

describe("GET /api/v1/admin/escalations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/escalations");
    expect(res.status).toBe(401);
  });

  it("returns escalations with client and assigned specialist info", async () => {
    mockedFindMany.mockResolvedValue([FAKE_ESCALATION] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/escalations")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.escalations).toHaveLength(1);
    expect(res.body.escalations[0].client).toEqual({ name: "Ana Pérez", phone: "5551234567" });
    expect(res.body.escalations[0].assignedSpecialist).toEqual({ id: "spec-1", name: "Sonia" });
  });

  it("filters by status", async () => {
    mockedFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get("/api/v1/admin/escalations?status=open")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(mockedFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "open" } }));
  });

  it("rejects an invalid status filter", async () => {
    const res = await request(createApp())
      .get("/api/v1/admin/escalations?status=not-real")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(mockedFindMany).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/admin/escalations/:id/resolve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the escalation doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .put("/api/v1/admin/escalations/does-not-exist/resolve")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ resolutionNotes: "Resuelto" });

    expect(res.status).toBe(404);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("marks the escalation resolved with the given notes", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_ESCALATION as never);
    mockedUpdate.mockResolvedValue({
      id: "esc-1",
      status: "resolved",
      resolutionNotes: "Se recomendó tratamiento X",
      resolvedAt: new Date("2026-08-04T12:00:00Z"),
      assignedSpecialist: { id: "spec-1", name: "Sonia" },
    } as never);

    const res = await request(createApp())
      .put("/api/v1/admin/escalations/esc-1/resolve")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ resolutionNotes: "Se recomendó tratamiento X" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("resolved");
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "resolved", resolutionNotes: "Se recomendó tratamiento X" }),
      }),
    );
  });
});
