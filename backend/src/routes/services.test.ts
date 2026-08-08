import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../lib/prisma";

vi.mock("../lib/prisma", () => ({
  prisma: { service: { findMany: vi.fn(), findUnique: vi.fn() } },
}));

const { createApp } = await import("../app");
const mockedFindMany = vi.mocked(prisma.service.findMany);
const mockedFindUnique = vi.mocked(prisma.service.findUnique);

const FAKE_SERVICE = {
  id: "svc-1",
  categoryId: "cat-1",
  category: { name: "Manos" },
  name: "Manicure Gel",
  priceType: "fixed",
  price: 24,
  priceMax: null,
  currency: "USD",
  requiresConsultation: false,
  requiresPhoto: false,
  defaultDurationMinutes: 60,
  sessionPackageSize: null,
};

describe("GET /api/v1/services", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is public and lists active services", async () => {
    mockedFindMany.mockResolvedValue([FAKE_SERVICE] as never);

    const res = await request(createApp()).get("/api/v1/services");

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0].name).toBe("Manicure Gel");
    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ active: true }) }),
    );
  });

  it("filters by category when provided", async () => {
    mockedFindMany.mockResolvedValue([]);

    await request(createApp()).get("/api/v1/services").query({ category: "Cabello" });

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, category: { name: "Cabello" } }),
      }),
    );
  });
});

describe("GET /api/v1/services/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes which specialists perform the service", async () => {
    mockedFindUnique.mockResolvedValue({
      ...FAKE_SERVICE,
      active: true,
      description: null,
      specialists: [{ specialist: { id: "sp-1", name: "Tania" } }, { specialist: { id: "sp-2", name: "Mariangely" } }],
    } as never);

    const res = await request(createApp()).get("/api/v1/services/svc-1");

    expect(res.status).toBe(200);
    expect(res.body.specialists).toEqual([
      { id: "sp-1", name: "Tania" },
      { id: "sp-2", name: "Mariangely" },
    ]);
  });

  it("returns 404 for a non-existent or inactive service", async () => {
    mockedFindUnique.mockResolvedValue(null);
    const res = await request(createApp()).get("/api/v1/services/does-not-exist");
    expect(res.status).toBe(404);
  });
});
