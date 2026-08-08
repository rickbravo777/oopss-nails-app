import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    specialist: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    specialistService: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    service: {
      count: vi.fn(),
    },
    serviceCategory: {
      count: vi.fn(),
    },
    scheduleRule: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    scheduleConstraint: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    scheduleException: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

const { createApp } = await import("../../app");

const mockedFindMany = vi.mocked(prisma.specialist.findMany);
const mockedFindUnique = vi.mocked(prisma.specialist.findUnique);
const mockedCreate = vi.mocked(prisma.specialist.create);
const mockedUpdate = vi.mocked(prisma.specialist.update);
const mockedSSDeleteMany = vi.mocked(prisma.specialistService.deleteMany);
const mockedSSCreateMany = vi.mocked(prisma.specialistService.createMany);
const mockedSSFindMany = vi.mocked(prisma.specialistService.findMany);
const mockedServiceCount = vi.mocked(prisma.service.count);
const mockedCategoryCount = vi.mocked(prisma.serviceCategory.count);
const mockedRuleFindMany = vi.mocked(prisma.scheduleRule.findMany);
const mockedRuleDeleteMany = vi.mocked(prisma.scheduleRule.deleteMany);
const mockedRuleCreateMany = vi.mocked(prisma.scheduleRule.createMany);
const mockedConstraintFindMany = vi.mocked(prisma.scheduleConstraint.findMany);
const mockedConstraintDeleteMany = vi.mocked(prisma.scheduleConstraint.deleteMany);
const mockedConstraintCreateMany = vi.mocked(prisma.scheduleConstraint.createMany);
const mockedExceptionFindMany = vi.mocked(prisma.scheduleException.findMany);
const mockedExceptionFindUnique = vi.mocked(prisma.scheduleException.findUnique);
const mockedExceptionCreate = vi.mocked(prisma.scheduleException.create);
const mockedExceptionDelete = vi.mocked(prisma.scheduleException.delete);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });
const SPECIALIST_ID = "11111111-1111-1111-1111-111111111111";
const FAKE_SPECIALIST = { id: SPECIALIST_ID, name: "Yez", active: true, photoUrl: null, bio: null };

describe("GET /api/v1/admin/specialists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/specialists");
    expect(res.status).toBe(401);
  });

  it("returns all specialists", async () => {
    mockedFindMany.mockResolvedValue([FAKE_SPECIALIST] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/specialists")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.specialists).toHaveLength(1);
  });
});

describe("POST /api/v1/admin/specialists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid body", async () => {
    const res = await request(createApp())
      .post("/api/v1/admin/specialists")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("creates a specialist", async () => {
    mockedCreate.mockResolvedValue(FAKE_SPECIALIST as never);

    const res = await request(createApp())
      .post("/api/v1/admin/specialists")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Yez" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Yez");
  });

  it("returns 409 on a duplicate name", async () => {
    mockedCreate.mockRejectedValue({ code: "P2002" });

    const res = await request(createApp())
      .post("/api/v1/admin/specialists")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Yez" });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/v1/admin/specialists/:id (soft delete)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets active=false instead of deleting the row", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedUpdate.mockResolvedValue({ ...FAKE_SPECIALIST, active: false } as never);

    const res = await request(createApp())
      .delete(`/api/v1/admin/specialists/${SPECIALIST_ID}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { active: false } }));
  });
});

describe("PUT /api/v1/admin/specialists/:id/services", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the specialist doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .put(`/api/v1/admin/specialists/${SPECIALIST_ID}/services`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ serviceIds: [] });

    expect(res.status).toBe(404);
  });

  it("rejects when one or more serviceIds don't exist", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedServiceCount.mockResolvedValue(1);

    const res = await request(createApp())
      .put(`/api/v1/admin/specialists/${SPECIALIST_ID}/services`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ serviceIds: ["22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333"] });

    expect(res.status).toBe(400);
    expect(mockedSSDeleteMany).not.toHaveBeenCalled();
  });

  it("replaces the full service set (this is UJ-14's core guarantee: unassigning removes the row entirely)", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedServiceCount.mockResolvedValue(1);
    mockedSSFindMany.mockResolvedValue([
      {
        service: { id: "22222222-2222-2222-2222-222222222222", name: "Rubber Gel", categoryId: "cat-1" },
        durationOverrideMinutes: null,
      },
    ] as never);

    const res = await request(createApp())
      .put(`/api/v1/admin/specialists/${SPECIALIST_ID}/services`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ serviceIds: ["22222222-2222-2222-2222-222222222222"] });

    expect(res.status).toBe(200);
    expect(mockedSSDeleteMany).toHaveBeenCalledWith({ where: { specialistId: SPECIALIST_ID } });
    expect(mockedSSCreateMany).toHaveBeenCalled();
    expect(res.body.services).toEqual([
      { id: "22222222-2222-2222-2222-222222222222", name: "Rubber Gel", categoryId: "cat-1", durationOverrideMinutes: null },
    ]);
  });

  it("allows clearing all assignments (empty serviceIds array)", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedSSFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .put(`/api/v1/admin/specialists/${SPECIALIST_ID}/services`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ serviceIds: [] });

    expect(res.status).toBe(200);
    expect(mockedSSDeleteMany).toHaveBeenCalled();
    expect(mockedSSCreateMany).not.toHaveBeenCalled();
    expect(res.body.services).toEqual([]);
  });
});

describe("GET /api/v1/admin/specialists/:id/schedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the specialist doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .get(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it("returns rules, constraints, and exceptions", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedRuleFindMany.mockResolvedValue([{ id: "r1", dayOfWeek: 1, startTime: "09:00", endTime: "18:30" }] as never);
    mockedConstraintFindMany.mockResolvedValue([]);
    mockedExceptionFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rules).toHaveLength(1);
    expect(res.body.constraints).toEqual([]);
    expect(res.body.exceptions).toEqual([]);
  });
});

describe("PUT /api/v1/admin/specialists/:id/schedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("replaces the full rule + constraint set for the specialist", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedRuleFindMany.mockResolvedValue([{ id: "r1", dayOfWeek: 6, startTime: "09:00", endTime: "16:00" }] as never);
    mockedConstraintFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .put(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rules: [{ dayOfWeek: 6, startTime: "09:00", endTime: "16:00" }],
        constraints: [],
      });

    expect(res.status).toBe(200);
    expect(mockedRuleDeleteMany).toHaveBeenCalledWith({ where: { specialistId: SPECIALIST_ID } });
    expect(mockedConstraintDeleteMany).toHaveBeenCalledWith({ where: { specialistId: SPECIALIST_ID } });
    expect(mockedRuleCreateMany).toHaveBeenCalled();
    expect(mockedConstraintCreateMany).not.toHaveBeenCalled();
  });

  it("rejects a constraint referencing a nonexistent service", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedServiceCount.mockResolvedValue(0);
    mockedCategoryCount.mockResolvedValue(0);

    const res = await request(createApp())
      .put(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rules: [],
        constraints: [{ serviceId: "22222222-2222-2222-2222-222222222222", latestStartTime: "16:00" }],
      });

    expect(res.status).toBe(400);
    expect(mockedRuleDeleteMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/admin/specialists/:id/schedule-exceptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects custom_hours without startTime/endTime", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);

    const res = await request(createApp())
      .post(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule-exceptions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: "2026-12-25", type: "custom_hours" });

    expect(res.status).toBe(400);
    expect(mockedExceptionCreate).not.toHaveBeenCalled();
  });

  it("creates a day_off exception", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_SPECIALIST as never);
    mockedExceptionCreate.mockResolvedValue({
      id: "exc-1",
      specialistId: SPECIALIST_ID,
      date: new Date("2026-12-25"),
      type: "day_off",
      startTime: null,
      endTime: null,
      reason: "Feriado",
    } as never);

    const res = await request(createApp())
      .post(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule-exceptions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: "2026-12-25", type: "day_off", reason: "Feriado" });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("day_off");
  });
});

describe("DELETE /api/v1/admin/specialists/:id/schedule-exceptions/:exceptionId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the exception doesn't belong to this specialist", async () => {
    mockedExceptionFindUnique.mockResolvedValue({ id: "exc-1", specialistId: "other-specialist" } as never);

    const res = await request(createApp())
      .delete(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule-exceptions/exc-1`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(mockedExceptionDelete).not.toHaveBeenCalled();
  });

  it("deletes the exception when it belongs to this specialist", async () => {
    mockedExceptionFindUnique.mockResolvedValue({ id: "exc-1", specialistId: SPECIALIST_ID } as never);
    mockedExceptionDelete.mockResolvedValue({} as never);

    const res = await request(createApp())
      .delete(`/api/v1/admin/specialists/${SPECIALIST_ID}/schedule-exceptions/exc-1`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(mockedExceptionDelete).toHaveBeenCalledWith({ where: { id: "exc-1" } });
  });
});
