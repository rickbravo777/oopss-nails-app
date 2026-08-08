import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    service: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    serviceCategory: {
      findUnique: vi.fn(),
    },
  },
}));

const { createApp } = await import("../../app");

const mockedFindMany = vi.mocked(prisma.service.findMany);
const mockedFindUnique = vi.mocked(prisma.service.findUnique);
const mockedCreate = vi.mocked(prisma.service.create);
const mockedUpdate = vi.mocked(prisma.service.update);
const mockedCategoryFindUnique = vi.mocked(prisma.serviceCategory.findUnique);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

const validBody = {
  categoryId: "11111111-1111-1111-1111-111111111111",
  name: "Manicure Gel",
  priceType: "fixed",
  price: 24,
  defaultDurationMinutes: 60,
};

const FAKE_SERVICE = {
  id: "22222222-2222-2222-2222-222222222222",
  categoryId: validBody.categoryId,
  category: { name: "Manos" },
  name: "Manicure Gel",
  description: null,
  priceType: "fixed",
  price: 24,
  priceMax: null,
  currency: "USD",
  requiresConsultation: false,
  requiresPhoto: false,
  defaultDurationMinutes: 60,
  sessionPackageSize: null,
  active: true,
  sortOrder: 0,
};

describe("GET /api/v1/admin/services", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/services");
    expect(res.status).toBe(401);
  });

  it("returns all services including inactive ones", async () => {
    mockedFindMany.mockResolvedValue([FAKE_SERVICE, { ...FAKE_SERVICE, id: "3", active: false }] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/services")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(2);
  });
});

describe("POST /api/v1/admin/services", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).post("/api/v1/admin/services").send(validBody);
    expect(res.status).toBe(401);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid body", async () => {
    const res = await request(createApp())
      .post("/api/v1/admin/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "x" });
    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects priceType='range' without a valid priceMax", async () => {
    const res = await request(createApp())
      .post("/api/v1/admin/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validBody, priceType: "range" });
    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects when the category doesn't exist", async () => {
    mockedCategoryFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .post("/api/v1/admin/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("creates a service when the body and category are valid", async () => {
    mockedCategoryFindUnique.mockResolvedValue({ id: validBody.categoryId, name: "Manos" } as never);
    mockedCreate.mockResolvedValue(FAKE_SERVICE as never);

    const res = await request(createApp())
      .post("/api/v1/admin/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Manicure Gel");
    expect(res.body.categoryName).toBe("Manos");
  });

  it("returns 409 when the service name is already taken", async () => {
    mockedCategoryFindUnique.mockResolvedValue({ id: validBody.categoryId, name: "Manos" } as never);
    mockedCreate.mockRejectedValue({ code: "P2002" });

    const res = await request(createApp())
      .post("/api/v1/admin/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validBody);

    expect(res.status).toBe(409);
  });
});

describe("PUT /api/v1/admin/services/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the service doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .put("/api/v1/admin/services/does-not-exist")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validBody);

    expect(res.status).toBe(404);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("updates a service when it exists and the body is valid", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SERVICE as never);
    mockedCategoryFindUnique.mockResolvedValue({ id: validBody.categoryId, name: "Manos" } as never);
    mockedUpdate.mockResolvedValue({ ...FAKE_SERVICE, price: 30 } as never);

    const res = await request(createApp())
      .put(`/api/v1/admin/services/${FAKE_SERVICE.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validBody, price: 30 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(30);
  });
});

describe("DELETE /api/v1/admin/services/:id (soft delete)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the service doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .delete("/api/v1/admin/services/does-not-exist")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("sets active=false instead of deleting the row", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SERVICE as never);
    mockedUpdate.mockResolvedValue({ ...FAKE_SERVICE, active: false } as never);

    const res = await request(createApp())
      .delete(`/api/v1/admin/services/${FAKE_SERVICE.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
  });
});
