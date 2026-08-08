import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    termSynonym: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    service: { findUnique: vi.fn() },
    serviceCategory: { findUnique: vi.fn() },
    assistantPolicy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { createApp } = await import("../../app");

const mockedSynonymFindMany = vi.mocked(prisma.termSynonym.findMany);
const mockedSynonymFindUnique = vi.mocked(prisma.termSynonym.findUnique);
const mockedSynonymCreate = vi.mocked(prisma.termSynonym.create);
const mockedSynonymDelete = vi.mocked(prisma.termSynonym.delete);
const mockedServiceFindUnique = vi.mocked(prisma.service.findUnique);
const mockedPolicyFindMany = vi.mocked(prisma.assistantPolicy.findMany);
const mockedPolicyFindUnique = vi.mocked(prisma.assistantPolicy.findUnique);
const mockedPolicyUpsert = vi.mocked(prisma.assistantPolicy.upsert);
const mockedPolicyDelete = vi.mocked(prisma.assistantPolicy.delete);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

describe("GET /api/v1/admin/knowledge-base/synonyms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/knowledge-base/synonyms");
    expect(res.status).toBe(401);
  });

  it("returns synonyms", async () => {
    mockedSynonymFindMany.mockResolvedValue([
      { id: "1", term: "pintura en gel", canonicalService: { id: "svc-1", name: "Manicure Gel" }, canonicalCategory: null },
    ] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/knowledge-base/synonyms")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.synonyms).toHaveLength(1);
  });
});

describe("POST /api/v1/admin/knowledge-base/synonyms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a body with both canonicalServiceId and canonicalCategoryId", async () => {
    const res = await request(createApp())
      .post("/api/v1/admin/knowledge-base/synonyms")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        term: "manicure",
        canonicalServiceId: "22222222-2222-2222-2222-222222222222",
        canonicalCategoryId: "33333333-3333-3333-3333-333333333333",
      });

    expect(res.status).toBe(400);
    expect(mockedSynonymCreate).not.toHaveBeenCalled();
  });

  it("rejects when the referenced service doesn't exist", async () => {
    mockedServiceFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .post("/api/v1/admin/knowledge-base/synonyms")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ term: "manicure", canonicalServiceId: "22222222-2222-2222-2222-222222222222" });

    expect(res.status).toBe(400);
    expect(mockedSynonymCreate).not.toHaveBeenCalled();
  });

  it("creates a synonym pointing to a valid service", async () => {
    mockedServiceFindUnique.mockResolvedValue({ id: "22222222-2222-2222-2222-222222222222" } as never);
    mockedSynonymCreate.mockResolvedValue({ id: "1", term: "manicure" } as never);

    const res = await request(createApp())
      .post("/api/v1/admin/knowledge-base/synonyms")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ term: "manicure", canonicalServiceId: "22222222-2222-2222-2222-222222222222" });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/v1/admin/knowledge-base/synonyms/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the synonym doesn't exist", async () => {
    mockedSynonymFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .delete("/api/v1/admin/knowledge-base/synonyms/does-not-exist")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(mockedSynonymDelete).not.toHaveBeenCalled();
  });

  it("deletes when it exists", async () => {
    mockedSynonymFindUnique.mockResolvedValue({ id: "1" } as never);
    mockedSynonymDelete.mockResolvedValue({} as never);

    const res = await request(createApp())
      .delete("/api/v1/admin/knowledge-base/synonyms/1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

describe("GET/PUT /api/v1/admin/knowledge-base/policies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/knowledge-base/policies");
    expect(res.status).toBe(401);
  });

  it("lists policies", async () => {
    mockedPolicyFindMany.mockResolvedValue([{ id: "1", key: "no_shows", value: "..." }] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/knowledge-base/policies")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.policies).toHaveLength(1);
  });

  it("upserts a policy by key", async () => {
    mockedPolicyUpsert.mockResolvedValue({ id: "1", key: "no_shows", value: "Nueva política" } as never);

    const res = await request(createApp())
      .put("/api/v1/admin/knowledge-base/policies/no_shows")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ value: "Nueva política" });

    expect(res.status).toBe(200);
    expect(res.body.value).toBe("Nueva política");
  });

  it("returns 404 deleting an unknown policy key", async () => {
    mockedPolicyFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .delete("/api/v1/admin/knowledge-base/policies/does_not_exist")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(mockedPolicyDelete).not.toHaveBeenCalled();
  });
});
