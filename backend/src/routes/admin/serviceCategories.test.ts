import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    serviceCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { createApp } = await import("../../app");

const mockedFindMany = vi.mocked(prisma.serviceCategory.findMany);
const mockedFindUnique = vi.mocked(prisma.serviceCategory.findUnique);
const mockedCreate = vi.mocked(prisma.serviceCategory.create);
const mockedUpdate = vi.mocked(prisma.serviceCategory.update);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

describe("GET /api/v1/admin/service-categories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/service-categories");
    expect(res.status).toBe(401);
  });

  it("returns categories ordered by displayOrder", async () => {
    mockedFindMany.mockResolvedValue([{ id: "1", name: "Manos", displayOrder: 0 }] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/service-categories")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
  });
});

describe("POST /api/v1/admin/service-categories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid body", async () => {
    const res = await request(createApp())
      .post("/api/v1/admin/service-categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("creates a category", async () => {
    mockedCreate.mockResolvedValue({ id: "1", name: "Nueva Categoría", displayOrder: 5 } as never);

    const res = await request(createApp())
      .post("/api/v1/admin/service-categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Nueva Categoría", displayOrder: 5 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nueva Categoría");
  });

  it("returns 409 on a duplicate name", async () => {
    mockedCreate.mockRejectedValue({ code: "P2002" });

    const res = await request(createApp())
      .post("/api/v1/admin/service-categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Manos" });

    expect(res.status).toBe(409);
  });
});

describe("PUT /api/v1/admin/service-categories/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the category doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .put("/api/v1/admin/service-categories/does-not-exist")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Manos" });

    expect(res.status).toBe(404);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("updates when the category exists", async () => {
    mockedFindUnique.mockResolvedValue({ id: "1", name: "Manos", displayOrder: 0 } as never);
    mockedUpdate.mockResolvedValue({ id: "1", name: "Manos y Pies", displayOrder: 0 } as never);

    const res = await request(createApp())
      .put("/api/v1/admin/service-categories/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Manos y Pies" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Manos y Pies");
  });
});
