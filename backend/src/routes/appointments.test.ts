import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

vi.mock("../lib/prisma", () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../lib/booking", () => ({
  createAppointment: vi.fn(),
  rescheduleAppointment: vi.fn(),
  SlotUnavailableError: class SlotUnavailableError extends Error {},
  InvalidBookingError: class InvalidBookingError extends Error {},
  AppointmentNotReschedulableError: class AppointmentNotReschedulableError extends Error {},
}));

const { createApp } = await import("../app");
const bookingLib = await import("../lib/booking");

const mockedFindUnique = vi.mocked(prisma.appointment.findUnique);
const mockedUpdate = vi.mocked(prisma.appointment.update);
const mockedConversationFindUnique = vi.mocked(prisma.conversation.findUnique);
const mockedCreateAppointment = vi.mocked(bookingLib.createAppointment);
const mockedRescheduleAppointment = vi.mocked(bookingLib.rescheduleAppointment);

const FAKE_APPOINTMENT = {
  id: "22222222-2222-2222-2222-222222222222",
  date: new Date("2026-08-10"),
  startTime: "10:00",
  endTime: "10:45",
  status: "pending_confirmation",
  confirmationCode: "TEST1234",
  specialist: { id: "s1", name: "Tania" },
  client: { phone: "8095551234" },
  services: [
    {
      service: { id: "svc1", name: "Manicure Regular" },
      durationMinutesSnapshot: 45,
      priceSnapshot: 15,
    },
  ],
};

describe("GET /api/v1/appointments/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the appointment for a matching phone + code", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);

    const res = await request(createApp())
      .get("/api/v1/appointments/lookup")
      .query({ phone: "8095551234", code: "test1234" });

    expect(res.status).toBe(200);
    expect(res.body.confirmationCode).toBe("TEST1234");
  });

  it("matches a phone typed with dashes/spaces against the digits-only stored phone", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);

    const res = await request(createApp())
      .get("/api/v1/appointments/lookup")
      .query({ phone: "809-555-1234", code: "test1234" });

    expect(res.status).toBe(200);
    expect(res.body.confirmationCode).toBe("TEST1234");
  });

  it("returns a generic 404 for a non-matching phone (not a specific error)", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);

    const res = await request(createApp())
      .get("/api/v1/appointments/lookup")
      .query({ phone: "0000000000", code: "TEST1234" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Cita no encontrada");
  });

  it("returns a generic 404 when no appointment matches the code at all", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .get("/api/v1/appointments/lookup")
      .query({ phone: "8095551234", code: "NOPE0000" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Cita no encontrada");
  });

  it("rejects a request missing required query params", async () => {
    const res = await request(createApp()).get("/api/v1/appointments/lookup").query({ phone: "8095551234" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/appointments/:id/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels an appointment with matching phone + code", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);
    mockedUpdate.mockResolvedValue({ ...FAKE_APPOINTMENT, status: "cancelled" } as never);

    const res = await request(createApp())
      .post(`/api/v1/appointments/${FAKE_APPOINTMENT.id}/cancel`)
      .send({ phone: "8095551234", confirmationCode: "TEST1234" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "cancelled" } }),
    );
  });

  it("rejects cancellation with a mismatched confirmation code, without mutating the appointment", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);

    const res = await request(createApp())
      .post(`/api/v1/appointments/${FAKE_APPOINTMENT.id}/cancel`)
      .send({ phone: "8095551234", confirmationCode: "WRONGCOD" });

    expect(res.status).toBe(404);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("rejects cancelling an appointment that is already cancelled", async () => {
    mockedFindUnique.mockResolvedValue({ ...FAKE_APPOINTMENT, status: "cancelled" } as never);

    const res = await request(createApp())
      .post(`/api/v1/appointments/${FAKE_APPOINTMENT.id}/cancel`)
      .send({ phone: "8095551234", confirmationCode: "TEST1234" });

    expect(res.status).toBe(409);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for a non-existent appointment id", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .post("/api/v1/appointments/does-not-exist/cancel")
      .send({ phone: "8095551234", confirmationCode: "TEST1234" });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/appointments", () => {
  const validBody = {
    clientName: "Ana",
    clientPhone: "8095551234",
    specialistId: "11111111-1111-1111-1111-111111111111",
    date: "2026-08-10",
    startTime: "10:00",
    services: ["22222222-2222-2222-2222-222222222222"],
  };

  const FAKE_CONVERSATION = { id: "conv-1", sessionToken: "session-abc", clientId: null };

  beforeEach(() => vi.clearAllMocks());

  it("rejects requests with no session token and no admin token", async () => {
    const res = await request(createApp()).post("/api/v1/appointments").send(validBody);
    expect(res.status).toBe(401);
    expect(mockedCreateAppointment).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid session token", async () => {
    mockedConversationFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .post("/api/v1/appointments")
      .set("X-Session-Token", "not-a-real-token")
      .send(validBody);

    expect(res.status).toBe(401);
    expect(mockedCreateAppointment).not.toHaveBeenCalled();
  });

  it("creates an appointment for a valid client session and returns the confirmation", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);
    mockedCreateAppointment.mockResolvedValue({
      id: "appt-1",
      confirmationCode: "ABC123",
      status: "confirmed",
      date: "2026-08-10",
      startTime: "10:00",
      endTime: "10:45",
      specialist: { id: "11111111-1111-1111-1111-111111111111", name: "Tania" },
      services: [{ id: "22222222-2222-2222-2222-222222222222", name: "Manicure Regular", price: 15, durationMinutes: 45 }],
    });

    const res = await request(createApp())
      .post("/api/v1/appointments")
      .set("X-Session-Token", "session-abc")
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.confirmationCode).toBe("ABC123");
    // Regression guard: same shape as GET /lookup and POST /:id/cancel — the frontend
    // reads appointment.specialist.name and appointment.services[].id from every endpoint.
    expect(res.body.specialist).toEqual({ id: "11111111-1111-1111-1111-111111111111", name: "Tania" });
    expect(res.body.services[0].id).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("also allows a valid admin token instead of a session token", async () => {
    mockedCreateAppointment.mockResolvedValue({
      id: "appt-1",
      confirmationCode: "ADMIN123",
      status: "confirmed",
      date: "2026-08-10",
      startTime: "10:00",
      endTime: "10:45",
      specialist: { id: "11111111-1111-1111-1111-111111111111", name: "Tania" },
      services: [],
    });

    const res = await request(createApp())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" })}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(mockedCreateAppointment).toHaveBeenCalledWith(expect.objectContaining({ source: "admin" }));
  });

  it("rejects an invalid request body", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp())
      .post("/api/v1/appointments")
      .set("X-Session-Token", "session-abc")
      .send({ clientName: "Ana" });
    expect(res.status).toBe(400);
    expect(mockedCreateAppointment).not.toHaveBeenCalled();
  });

  it("returns 409 when the slot is unavailable", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);
    mockedCreateAppointment.mockRejectedValue(new bookingLib.SlotUnavailableError());

    const res = await request(createApp())
      .post("/api/v1/appointments")
      .set("X-Session-Token", "session-abc")
      .send(validBody);
    expect(res.status).toBe(409);
  });

  it("returns 422 when the booking is invalid (e.g. specialist can't perform the service)", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);
    mockedCreateAppointment.mockRejectedValue(new bookingLib.InvalidBookingError("no puede"));

    const res = await request(createApp())
      .post("/api/v1/appointments")
      .set("X-Session-Token", "session-abc")
      .send(validBody);
    expect(res.status).toBe(422);
  });
});

describe("POST /api/v1/appointments/:id/reschedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reschedules with matching phone + code", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);
    mockedRescheduleAppointment.mockResolvedValue({
      id: FAKE_APPOINTMENT.id,
      confirmationCode: "TEST1234",
      status: "pending_confirmation",
      date: "2026-08-12",
      startTime: "11:00",
      endTime: "11:45",
      specialist: { id: "s1", name: "Tania" },
      services: [],
    });

    const res = await request(createApp())
      .post(`/api/v1/appointments/${FAKE_APPOINTMENT.id}/reschedule`)
      .send({ phone: "8095551234", confirmationCode: "TEST1234", newDate: "2026-08-12", newStartTime: "11:00" });

    expect(res.status).toBe(200);
    expect(res.body.startTime).toBe("11:00");
  });

  it("rejects reschedule with a mismatched confirmation code, without moving the appointment", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);

    const res = await request(createApp())
      .post(`/api/v1/appointments/${FAKE_APPOINTMENT.id}/reschedule`)
      .send({ phone: "8095551234", confirmationCode: "WRONGCOD", newDate: "2026-08-12", newStartTime: "11:00" });

    expect(res.status).toBe(404);
    expect(mockedRescheduleAppointment).not.toHaveBeenCalled();
  });

  it("returns 409 when the new slot isn't available", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);
    mockedRescheduleAppointment.mockRejectedValue(new bookingLib.SlotUnavailableError());

    const res = await request(createApp())
      .post(`/api/v1/appointments/${FAKE_APPOINTMENT.id}/reschedule`)
      .send({ phone: "8095551234", confirmationCode: "TEST1234", newDate: "2026-08-12", newStartTime: "11:00" });

    expect(res.status).toBe(409);
  });

  it("rejects a malformed date/time", async () => {
    mockedFindUnique.mockResolvedValue(FAKE_APPOINTMENT as never);

    const res = await request(createApp())
      .post(`/api/v1/appointments/${FAKE_APPOINTMENT.id}/reschedule`)
      .send({ phone: "8095551234", confirmationCode: "TEST1234", newDate: "not-a-date", newStartTime: "11:00" });

    expect(res.status).toBe(400);
    expect(mockedRescheduleAppointment).not.toHaveBeenCalled();
  });
});
