import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    escalationFlag: { count: vi.fn() },
    errorLog: { findMany: vi.fn(), create: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
}));

vi.mock("../../lib/ai/apiKey", () => ({ getOpenAIApiKey: vi.fn() }));

const { createApp } = await import("../../app");
const { getOpenAIApiKey } = await import("../../lib/ai/apiKey");

const mockedQueryRaw = vi.mocked(prisma.$queryRaw);
const mockedCount = vi.mocked(prisma.escalationFlag.count);
const mockedFindMany = vi.mocked(prisma.errorLog.findMany);
const mockedAppointmentFindMany = vi.mocked(prisma.appointment.findMany);
const mockedGetKey = vi.mocked(getOpenAIApiKey);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

describe("GET /api/v1/admin/dashboard/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAppointmentFindMany.mockResolvedValue([]);
  });

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/dashboard/health");
    expect(res.status).toBe(401);
  });

  it("reports db ok and openai ok when both checks succeed", async () => {
    mockedQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockedGetKey.mockResolvedValue("sk-fake");
    mockedCount.mockResolvedValue(2);
    mockedFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get("/api/v1/admin/dashboard/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.db).toBe("ok");
    expect(res.body.openai).toBe("ok");
    expect(res.body.openEscalationsCount).toBe(2);
    expect(typeof res.body.diskUsagePercent === "number" || res.body.diskUsagePercent === null).toBe(true);
  });

  it("reports db error when the database check throws, without crashing the request", async () => {
    mockedQueryRaw.mockRejectedValue(new Error("connection refused"));
    mockedGetKey.mockResolvedValue("sk-fake");
    mockedCount.mockResolvedValue(0);
    mockedFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get("/api/v1/admin/dashboard/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.db).toBe("error");
  });

  it("reports openai as not_configured when no key is available anywhere", async () => {
    mockedQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockedGetKey.mockRejectedValue(new Error("No OpenAI API key configured"));
    mockedCount.mockResolvedValue(0);
    mockedFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get("/api/v1/admin/dashboard/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.openai).toBe("not_configured");
  });

  it("includes recent error log entries", async () => {
    mockedQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockedGetKey.mockResolvedValue("sk-fake");
    mockedCount.mockResolvedValue(0);
    mockedFindMany.mockResolvedValue([
      { id: "err-1", source: "POST /api/v1/appointments", message: "boom", createdAt: new Date() },
    ] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/dashboard/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.body.recentErrors).toHaveLength(1);
    expect(res.body.recentErrors[0].source).toBe("POST /api/v1/appointments");
  });

  it("includes today's appointments with client, specialist, and service names", async () => {
    mockedQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockedGetKey.mockResolvedValue("sk-fake");
    mockedCount.mockResolvedValue(0);
    mockedFindMany.mockResolvedValue([]);
    mockedAppointmentFindMany.mockResolvedValue([
      {
        id: "appt-1",
        startTime: "10:00",
        endTime: "10:45",
        status: "confirmed",
        client: { name: "Ana Pérez", phone: "5551234567" },
        specialist: { id: "spec-1", name: "Yez" },
        services: [{ service: { name: "Rubber Gel" } }],
      },
    ] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/dashboard/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.todayAppointments).toEqual([
      {
        id: "appt-1",
        startTime: "10:00",
        endTime: "10:45",
        status: "confirmed",
        clientName: "Ana Pérez",
        clientPhone: "5551234567",
        specialist: { id: "spec-1", name: "Yez" },
        services: ["Rubber Gel"],
      },
    ]);
  });
});
