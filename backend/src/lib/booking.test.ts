import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "./prisma";

vi.mock("./prisma", () => ({
  prisma: {
    service: { findMany: vi.fn() },
    specialist: { findUnique: vi.fn() },
    client: { upsert: vi.fn() },
    appointment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("./availability", () => ({ checkAvailability: vi.fn() }));
vi.mock("./googleSheets", () => ({ appendAppointmentToSheet: vi.fn().mockResolvedValue(undefined) }));

const { checkAvailability } = await import("./availability");
const { appendAppointmentToSheet } = await import("./googleSheets");
const { createAppointment, rescheduleAppointment, SlotUnavailableError, InvalidBookingError, AppointmentNotReschedulableError } =
  await import("./booking");

const mockedCheckAvailability = vi.mocked(checkAvailability);
const mockedAppendAppointmentToSheet = vi.mocked(appendAppointmentToSheet);
const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedSpecialistFindUnique = vi.mocked(prisma.specialist.findUnique);
const mockedClientUpsert = vi.mocked(prisma.client.upsert);
const mockedAppointmentCreate = vi.mocked(prisma.appointment.create);
const mockedAppointmentFindUnique = vi.mocked(prisma.appointment.findUnique);
const mockedAppointmentUpdate = vi.mocked(prisma.appointment.update);

const SERVICE = { id: "svc-1", name: "Rubber Gel", price: 35, defaultDurationMinutes: 75, requiresConsultation: false };
const SPECIALIST = { id: "sp-1", name: "Tania", active: true, services: [{ serviceId: "svc-1", durationOverrideMinutes: null }] };

beforeEach(() => vi.clearAllMocks());

describe("createAppointment", () => {
  it("creates the appointment when the slot is genuinely available", async () => {
    mockedServiceFindMany.mockResolvedValue([SERVICE] as never);
    mockedSpecialistFindUnique.mockResolvedValue(SPECIALIST as never);
    mockedCheckAvailability.mockResolvedValue([
      { specialistId: "sp-1", specialistName: "Tania", date: "2026-08-03", startTime: "09:00", endTime: "10:15" },
    ]);
    mockedClientUpsert.mockResolvedValue({ id: "client-1" } as never);
    mockedAppointmentCreate.mockResolvedValue({
      id: "appt-1",
      confirmationCode: "ABC123",
      status: "confirmed",
      startTime: "09:00",
      endTime: "10:15",
      specialist: { id: "sp-1", name: "Tania" },
      services: [{ service: { id: "svc-1", name: "Rubber Gel" }, priceSnapshot: 35, durationMinutesSnapshot: 75 }],
    } as never);

    const result = await createAppointment({
      clientName: "Ana",
      clientPhone: "8095551111",
      specialistId: "sp-1",
      date: "2026-08-03",
      startTime: "09:00",
      serviceIds: ["svc-1"],
      source: "chat",
    });

    expect(result.confirmationCode).toBe("ABC123");
    expect(result.status).toBe("confirmed");
    // Regression guard: this shape must match appointments.ts's serializeAppointment()
    // exactly (specialist as {id,name}, services with an id) — a mismatch here previously
    // crashed the /mis-citas frontend page, caught only by live browser testing.
    expect(result.specialist).toEqual({ id: "sp-1", name: "Tania" });
    expect(result.services[0]).toEqual({ id: "svc-1", name: "Rubber Gel", price: 35, durationMinutes: 75 });
  });

  it("fires the Google Sheets sync (fire-and-forget) with the client's contact info and appointment details", async () => {
    mockedServiceFindMany.mockResolvedValue([SERVICE] as never);
    mockedSpecialistFindUnique.mockResolvedValue(SPECIALIST as never);
    mockedCheckAvailability.mockResolvedValue([
      { specialistId: "sp-1", specialistName: "Tania", date: "2026-08-03", startTime: "09:00", endTime: "10:15" },
    ]);
    mockedClientUpsert.mockResolvedValue({
      id: "client-1",
      name: "Carolina Villa",
      phone: "8095551111",
      email: "carolina@correo.com",
    } as never);
    mockedAppointmentCreate.mockResolvedValue({
      id: "appt-1",
      confirmationCode: "ABC123",
      status: "confirmed",
      startTime: "09:00",
      endTime: "10:15",
      specialist: { id: "sp-1", name: "Tania" },
      services: [{ service: { id: "svc-1", name: "Rubber Gel" }, priceSnapshot: 35, durationMinutesSnapshot: 75 }],
    } as never);

    await createAppointment({
      clientName: "Carolina Villa",
      clientPhone: "8095551111",
      clientEmail: "carolina@correo.com",
      specialistId: "sp-1",
      date: "2026-08-03",
      startTime: "09:00",
      serviceIds: ["svc-1"],
      source: "chat",
    });

    expect(mockedAppendAppointmentToSheet).toHaveBeenCalledWith({
      clientName: "Carolina Villa",
      clientPhone: "8095551111",
      clientEmail: "carolina@correo.com",
      serviceNames: ["Rubber Gel"],
      specialistName: "Tania",
      date: "2026-08-03",
      startTime: "09:00",
      confirmationCode: "ABC123",
    });
  });

  it("normalizes the client phone to digits-only before upserting, regardless of how it was typed", async () => {
    mockedServiceFindMany.mockResolvedValue([SERVICE] as never);
    mockedSpecialistFindUnique.mockResolvedValue(SPECIALIST as never);
    mockedCheckAvailability.mockResolvedValue([
      { specialistId: "sp-1", specialistName: "Tania", date: "2026-08-03", startTime: "09:00", endTime: "10:15" },
    ]);
    mockedClientUpsert.mockResolvedValue({ id: "client-1" } as never);
    mockedAppointmentCreate.mockResolvedValue({
      id: "appt-1",
      confirmationCode: "ABC123",
      status: "confirmed",
      startTime: "09:00",
      endTime: "10:15",
      specialist: { id: "sp-1", name: "Tania" },
      services: [{ service: { id: "svc-1", name: "Rubber Gel" }, priceSnapshot: 35, durationMinutesSnapshot: 75 }],
    } as never);

    await createAppointment({
      clientName: "Ana",
      clientPhone: "809-555-1111",
      specialistId: "sp-1",
      date: "2026-08-03",
      startTime: "09:00",
      serviceIds: ["svc-1"],
      source: "chat",
    });

    expect(mockedClientUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: "8095551111" },
        create: expect.objectContaining({ phone: "8095551111" }),
      }),
    );
  });

  it("sets status pending_confirmation when any requested service requires consultation", async () => {
    mockedServiceFindMany.mockResolvedValue([{ ...SERVICE, requiresConsultation: true }] as never);
    mockedSpecialistFindUnique.mockResolvedValue(SPECIALIST as never);
    mockedCheckAvailability.mockResolvedValue([
      { specialistId: "sp-1", specialistName: "Tania", date: "2026-08-03", startTime: "09:00", endTime: "10:15" },
    ]);
    mockedClientUpsert.mockResolvedValue({ id: "client-1" } as never);
    mockedAppointmentCreate.mockResolvedValue({
      id: "appt-1",
      confirmationCode: "X",
      status: "pending_confirmation",
      startTime: "09:00",
      endTime: "10:15",
      specialist: { id: "sp-1", name: "Tania" },
      services: [{ service: { id: "svc-1", name: "Rubber Gel" }, priceSnapshot: 35, durationMinutesSnapshot: 75 }],
    } as never);

    await createAppointment({
      clientName: "Ana",
      clientPhone: "8095551111",
      specialistId: "sp-1",
      date: "2026-08-03",
      startTime: "09:00",
      serviceIds: ["svc-1"],
      source: "chat",
    });

    const createArg = mockedAppointmentCreate.mock.calls[0][0] as { data: { status: string } };
    expect(createArg.data.status).toBe("pending_confirmation");
  });

  it("rejects when the specialist doesn't perform all requested services", async () => {
    mockedServiceFindMany.mockResolvedValue([SERVICE, { id: "svc-2", name: "Otro" }] as never);
    mockedSpecialistFindUnique.mockResolvedValue(SPECIALIST as never); // only has svc-1

    await expect(
      createAppointment({
        clientName: "Ana",
        clientPhone: "8095551111",
        specialistId: "sp-1",
        date: "2026-08-03",
        startTime: "09:00",
        serviceIds: ["svc-1", "svc-2"],
        source: "chat",
      }),
    ).rejects.toThrow(InvalidBookingError);
    expect(mockedAppointmentCreate).not.toHaveBeenCalled();
  });

  it("rejects with SlotUnavailableError when the requested time isn't in the re-validated availability", async () => {
    mockedServiceFindMany.mockResolvedValue([SERVICE] as never);
    mockedSpecialistFindUnique.mockResolvedValue(SPECIALIST as never);
    mockedCheckAvailability.mockResolvedValue([]); // nothing available

    await expect(
      createAppointment({
        clientName: "Ana",
        clientPhone: "8095551111",
        specialistId: "sp-1",
        date: "2026-08-03",
        startTime: "09:00",
        serviceIds: ["svc-1"],
        source: "chat",
      }),
    ).rejects.toThrow(SlotUnavailableError);
    expect(mockedAppointmentCreate).not.toHaveBeenCalled();
  });

  it("translates a unique-constraint DB violation (race condition) into SlotUnavailableError", async () => {
    mockedServiceFindMany.mockResolvedValue([SERVICE] as never);
    mockedSpecialistFindUnique.mockResolvedValue(SPECIALIST as never);
    mockedCheckAvailability.mockResolvedValue([
      { specialistId: "sp-1", specialistName: "Tania", date: "2026-08-03", startTime: "09:00", endTime: "10:15" },
    ]);
    mockedClientUpsert.mockResolvedValue({ id: "client-1" } as never);
    mockedAppointmentCreate.mockRejectedValue({ code: "P2002" });

    await expect(
      createAppointment({
        clientName: "Ana",
        clientPhone: "8095551111",
        specialistId: "sp-1",
        date: "2026-08-03",
        startTime: "09:00",
        serviceIds: ["svc-1"],
        source: "chat",
      }),
    ).rejects.toThrow(SlotUnavailableError);
  });
});

describe("rescheduleAppointment", () => {
  const EXISTING = {
    id: "appt-1",
    status: "confirmed",
    specialistId: "sp-1",
    confirmationCode: "ABC123",
    services: [{ serviceId: "svc-1", durationMinutesSnapshot: 75 }],
    specialist: { id: "sp-1", name: "Tania", services: [] },
  };

  it("moves the appointment to a new available slot, excluding its own current slot from the conflict check", async () => {
    mockedAppointmentFindUnique.mockResolvedValue(EXISTING as never);
    mockedCheckAvailability.mockResolvedValue([
      { specialistId: "sp-1", specialistName: "Tania", date: "2026-08-05", startTime: "10:00", endTime: "11:15" },
    ]);
    mockedAppointmentUpdate.mockResolvedValue({
      id: "appt-1",
      confirmationCode: "ABC123",
      status: "confirmed",
      startTime: "10:00",
      endTime: "11:15",
      specialist: { id: "sp-1", name: "Tania" },
      services: [{ service: { id: "svc-1", name: "Rubber Gel" }, priceSnapshot: 35, durationMinutesSnapshot: 75 }],
    } as never);

    const result = await rescheduleAppointment("appt-1", "2026-08-05", "10:00");

    expect(result.startTime).toBe("10:00");
    // Same regression guard as createAppointment — must match serializeAppointment()'s shape.
    expect(result.specialist).toEqual({ id: "sp-1", name: "Tania" });
    expect(result.services[0]).toEqual({ id: "svc-1", name: "Rubber Gel", price: 35, durationMinutes: 75 });
    expect(mockedCheckAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ excludeAppointmentId: "appt-1" }),
    );
  });

  it("rejects rescheduling a cancelled appointment", async () => {
    mockedAppointmentFindUnique.mockResolvedValue({ ...EXISTING, status: "cancelled" } as never);

    await expect(rescheduleAppointment("appt-1", "2026-08-05", "10:00")).rejects.toThrow(
      AppointmentNotReschedulableError,
    );
    expect(mockedAppointmentUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the new slot isn't actually available", async () => {
    mockedAppointmentFindUnique.mockResolvedValue(EXISTING as never);
    mockedCheckAvailability.mockResolvedValue([]);

    await expect(rescheduleAppointment("appt-1", "2026-08-05", "10:00")).rejects.toThrow(SlotUnavailableError);
    expect(mockedAppointmentUpdate).not.toHaveBeenCalled();
  });
});
