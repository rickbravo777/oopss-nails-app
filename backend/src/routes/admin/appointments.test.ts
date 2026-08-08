import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../lib/booking", () => ({
  rescheduleAppointment: vi.fn(),
  SlotUnavailableError: class SlotUnavailableError extends Error {},
  InvalidBookingError: class InvalidBookingError extends Error {},
  AppointmentNotReschedulableError: class AppointmentNotReschedulableError extends Error {},
}));

const { createApp } = await import("../../app");
const bookingLib = await import("../../lib/booking");

const mockedFindMany = vi.mocked(prisma.appointment.findMany);
const mockedFindUnique = vi.mocked(prisma.appointment.findUnique);
const mockedUpdate = vi.mocked(prisma.appointment.update);
const mockedReschedule = vi.mocked(bookingLib.rescheduleAppointment);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

const FAKE_APPOINTMENT = {
  id: "22222222-2222-2222-2222-222222222222",
  date: new Date("2026-08-10"),
  startTime: "10:00",
  endTime: "10:45",
  status: "confirmed",
  confirmationCode: "ABCD1234",
  notes: null,
  source: "chat",
  createdAt: new Date("2026-08-01"),
  client: { name: "Ana Pérez", phone: "5551234567" },
  specialist: { id: "spec-1", name: "Yez" },
  services: [{ service: { id: "svc-1", name: "Rubber Gel" }, durationMinutesSnapshot: 75, priceSnapshot: 35 }],
};

describe("GET /api/v1/admin/appointments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/appointments");
    expect(res.status).toBe(401);
  });

  it("returns appointments with client and specialist info", async () => {
    mockedFindMany.mockResolvedValue([FAKE_APPOINTMENT] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/appointments")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.appointments).toHaveLength(1);
    expect(res.body.appointments[0].client).toEqual({ name: "Ana Pérez", phone: "5551234567" });
    expect(res.body.appointments[0].specialist).toEqual({ id: "spec-1", name: "Yez" });
  });

  it("applies date/specialistId/status filters", async () => {
    mockedFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get("/api/v1/admin/appointments?date=2026-08-10&specialistId=11111111-1111-1111-1111-111111111111&status=confirmed")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const whereArg = mockedFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(whereArg.where).toMatchObject({
      specialistId: "11111111-1111-1111-1111-111111111111",
      status: "confirmed",
    });
  });

  it("rejects an invalid status filter", async () => {
    const res = await request(createApp())
      .get("/api/v1/admin/appointments?status=not-a-real-status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it("applies a dateFrom/dateTo range filter (used by the calendar week/day views)", async () => {
    mockedFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get("/api/v1/admin/appointments?dateFrom=2026-08-04&dateTo=2026-08-10")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const whereArg = mockedFindMany.mock.calls[0][0] as { where: { date: { gte: Date; lte: Date } } };
    expect(whereArg.where.date.gte.toISOString()).toBe("2026-08-04T00:00:00.000Z");
    expect(whereArg.where.date.lte.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("rejects dateFrom without dateTo", async () => {
    const res = await request(createApp())
      .get("/api/v1/admin/appointments?dateFrom=2026-08-04")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(mockedFindMany).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/admin/appointments/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the appointment doesn't exist", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .put(`/api/v1/admin/appointments/${FAKE_APPOINTMENT.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" });

    expect(res.status).toBe(404);
  });

  it("rejects date without startTime", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);

    const res = await request(createApp())
      .put(`/api/v1/admin/appointments/${FAKE_APPOINTMENT.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: "2026-08-11" });

    expect(res.status).toBe(400);
    expect(mockedReschedule).not.toHaveBeenCalled();
  });

  it("reuses rescheduleAppointment() when date+startTime are provided, so conflicts are re-validated", async () => {
    mockedFindUnique.mockResolvedValueOnce(FAKE_APPOINTMENT as never).mockResolvedValueOnce(FAKE_APPOINTMENT as never);
    mockedReschedule.mockResolvedValue({} as never);

    const res = await request(createApp())
      .put(`/api/v1/admin/appointments/${FAKE_APPOINTMENT.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: "2026-08-11", startTime: "11:00" });

    expect(res.status).toBe(200);
    expect(mockedReschedule).toHaveBeenCalledWith(FAKE_APPOINTMENT.id, "2026-08-11", "11:00");
  });

  it("returns 409 when the new slot conflicts", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);
    mockedReschedule.mockRejectedValue(new bookingLib.SlotUnavailableError());

    const res = await request(createApp())
      .put(`/api/v1/admin/appointments/${FAKE_APPOINTMENT.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: "2026-08-11", startTime: "11:00" });

    expect(res.status).toBe(409);
  });

  it("updates status and notes directly without touching the schedule", async () => {
    mockedFindUnique.mockResolvedValueOnce(FAKE_APPOINTMENT as never).mockResolvedValueOnce({
      ...FAKE_APPOINTMENT,
      status: "no_show",
      notes: "No llegó",
    } as never);
    mockedUpdate.mockResolvedValue({} as never);

    const res = await request(createApp())
      .put(`/api/v1/admin/appointments/${FAKE_APPOINTMENT.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "no_show", notes: "No llegó" });

    expect(res.status).toBe(200);
    expect(mockedReschedule).not.toHaveBeenCalled();
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "no_show", notes: "No llegó" } }),
    );
    expect(res.body.status).toBe("no_show");
  });
});
