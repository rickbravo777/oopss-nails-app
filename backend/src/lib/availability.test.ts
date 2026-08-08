import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "./prisma";

vi.mock("./prisma", () => ({
  prisma: {
    service: { findMany: vi.fn() },
    specialist: { findMany: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
}));

const { checkAvailability } = await import("./availability");

const mockedServiceFindMany = vi.mocked(prisma.service.findMany);
const mockedSpecialistFindMany = vi.mocked(prisma.specialist.findMany);
const mockedAppointmentFindMany = vi.mocked(prisma.appointment.findMany);

const RUBBER_GEL = { id: "svc-rubber-gel", categoryId: "cat-manos", defaultDurationMinutes: 75 };

function specialistFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sp-1",
    name: "Yez",
    services: [{ serviceId: RUBBER_GEL.id, durationOverrideMinutes: null }],
    scheduleRules: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "19:00", isActive: true }, // Monday
      { dayOfWeek: 6, startTime: "09:00", endTime: "17:00", isActive: true }, // Saturday
    ],
    scheduleConstraints: [],
    scheduleExceptions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedServiceFindMany.mockResolvedValue([RUBBER_GEL] as never);
  mockedAppointmentFindMany.mockResolvedValue([]);
});

describe("checkAvailability", () => {
  it("returns slots within the specialist's working hours on a day they work", async () => {
    mockedSpecialistFindMany.mockResolvedValue([specialistFixture()] as never);

    // Monday 2026-08-03 is a Monday per the seeded data's convention (dayOfWeek 1).
    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-03",
      dateTo: "2026-08-03",
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startTime).toBe("09:00");
    // 75 min service starting at 9:00 -> ends 10:15
    expect(slots[0].endTime).toBe("10:15");
  });

  it("Yez: no slots on Saturday after her 5pm cutoff (last possible start is 15:45 for a 75min service ending at 17:00)", async () => {
    mockedSpecialistFindMany.mockResolvedValue([specialistFixture()] as never);

    // 2026-08-08 is a Saturday.
    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-08",
      dateTo: "2026-08-08",
    });

    for (const slot of slots) {
      expect(slot.startTime <= "15:45").toBe(true);
    }
    expect(slots.some((s) => s.startTime === "16:00")).toBe(false);
  });

  it("returns no slots on a day the specialist has no schedule rule (e.g. Sunday, closed)", async () => {
    mockedSpecialistFindMany.mockResolvedValue([specialistFixture()] as never);

    // 2026-08-02 is a Sunday — no rule for dayOfWeek 0 in the fixture.
    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-02",
      dateTo: "2026-08-02",
    });

    expect(slots).toEqual([]);
  });

  it("Ana María: no slots before her 11am start", async () => {
    const anaMaria = specialistFixture({
      id: "sp-2",
      name: "Ana María",
      scheduleRules: [{ dayOfWeek: 1, startTime: "11:00", endTime: "18:30", isActive: true }],
    });
    mockedSpecialistFindMany.mockResolvedValue([anaMaria] as never);

    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-03",
      dateTo: "2026-08-03",
    });

    for (const slot of slots) {
      expect(slot.startTime >= "11:00").toBe(true);
    }
  });

  it("excludes a specialist who doesn't perform every requested service", async () => {
    const partiallyQualified = specialistFixture({
      services: [], // Doesn't actually have SpecialistService row for RUBBER_GEL after filtering.
    });
    mockedSpecialistFindMany.mockResolvedValue([partiallyQualified] as never);

    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-03",
      dateTo: "2026-08-03",
    });

    expect(slots).toEqual([]);
  });

  it("respects a ScheduleConstraint's latest start time even when it's earlier than the rule's close time", async () => {
    const tania = specialistFixture({
      id: "sp-3",
      name: "Tania",
      scheduleRules: [{ dayOfWeek: 6, startTime: "09:00", endTime: "16:30", isActive: true }],
      scheduleConstraints: [
        { specialistId: "sp-3", serviceId: null, serviceCategoryId: null, dayOfWeek: 6, latestStartTime: "16:00" },
      ],
    });
    mockedSpecialistFindMany.mockResolvedValue([tania] as never);

    // 2026-08-08 is a Saturday.
    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-08",
      dateTo: "2026-08-08",
    });

    for (const slot of slots) {
      expect(slot.startTime <= "16:00").toBe(true);
    }
  });

  it("treats a day_off exception as fully unavailable even on a day the specialist normally works", async () => {
    const withDayOff = specialistFixture({
      scheduleExceptions: [{ date: new Date("2026-08-03T00:00:00Z"), type: "day_off" }],
    });
    mockedSpecialistFindMany.mockResolvedValue([withDayOff] as never);

    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-03",
      dateTo: "2026-08-03",
    });

    expect(slots).toEqual([]);
  });

  it("excludes slots that overlap an existing (non-cancelled) appointment", async () => {
    mockedSpecialistFindMany.mockResolvedValue([specialistFixture()] as never);
    mockedAppointmentFindMany.mockResolvedValue([
      { id: "appt-1", startTime: "09:00", endTime: "10:15" },
    ] as never);

    const slots = await checkAvailability({
      serviceIds: [RUBBER_GEL.id],
      dateFrom: "2026-08-03",
      dateTo: "2026-08-03",
    });

    expect(slots.some((s) => s.startTime === "09:00")).toBe(false);
    expect(slots.some((s) => s.startTime === "10:30")).toBe(true);
  });

  it("throws when a requested service doesn't exist or isn't active", async () => {
    mockedServiceFindMany.mockResolvedValue([]);

    await expect(
      checkAvailability({ serviceIds: ["does-not-exist"], dateFrom: "2026-08-03", dateTo: "2026-08-03" }),
    ).rejects.toThrow(/no existen o no están activos/);
  });
});
