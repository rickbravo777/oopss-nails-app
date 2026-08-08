import { prisma } from "./prisma";

const SLOT_INTERVAL_MINUTES = 30;
const MAX_DATE_RANGE_DAYS = 14; // Safety bound — avoid unbounded computation from a bad date range.

export interface AvailabilitySlot {
  specialistId: string;
  specialistName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface CheckAvailabilityParams {
  serviceIds: string[];
  specialistId?: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  // Excludes this appointment's own occupied slot from the conflict check — used when
  // rescheduling, so an appointment doesn't block itself from moving to a nearby time.
  excludeAppointmentId?: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function formatDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  const from = parseDateUTC(dateFrom);
  const to = parseDateUTC(dateTo);
  for (
    let d = from;
    d <= to && dates.length < MAX_DATE_RANGE_DAYS;
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    dates.push(formatDateUTC(d));
  }
  return dates;
}

export async function checkAvailability(params: CheckAvailabilityParams): Promise<AvailabilitySlot[]> {
  const { serviceIds, specialistId, dateFrom, dateTo, excludeAppointmentId } = params;

  const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, active: true } });
  if (services.length !== serviceIds.length) {
    throw new Error("Uno o más servicios no existen o no están activos");
  }

  const candidateSpecialists = await prisma.specialist.findMany({
    where: {
      active: true,
      ...(specialistId ? { id: specialistId } : {}),
      services: { some: { serviceId: { in: serviceIds } } },
    },
    include: {
      services: { where: { serviceId: { in: serviceIds } } },
      scheduleRules: true,
      scheduleConstraints: { include: { service: { select: { categoryId: true } } } },
      scheduleExceptions: true,
    },
  });

  // Only specialists who can perform EVERY requested service qualify — not just some of them.
  const eligibleSpecialists = candidateSpecialists.filter((sp) => sp.services.length === serviceIds.length);

  const categoryIds = new Set(services.map((s) => s.categoryId));
  const dates = dateRange(dateFrom, dateTo);
  const slots: AvailabilitySlot[] = [];

  for (const specialist of eligibleSpecialists) {
    const totalDuration = services.reduce((sum, s) => {
      const override = specialist.services.find((ss) => ss.serviceId === s.id)?.durationOverrideMinutes;
      return sum + (override ?? s.defaultDurationMinutes);
    }, 0);

    for (const date of dates) {
      const dayOfWeek = parseDateUTC(date).getUTCDay();

      const exception = specialist.scheduleExceptions.find((e) => formatDateUTC(e.date) === date);
      if (exception?.type === "day_off") continue;

      let dayStart: string | undefined;
      let dayEnd: string | undefined;
      if (exception?.type === "custom_hours" && exception.startTime && exception.endTime) {
        dayStart = exception.startTime;
        dayEnd = exception.endTime;
      } else {
        const rule = specialist.scheduleRules.find((r) => r.dayOfWeek === dayOfWeek && r.isActive);
        if (!rule) continue; // Closed that day.
        dayStart = rule.startTime;
        dayEnd = rule.endTime;
      }

      const applicableConstraints = specialist.scheduleConstraints.filter((c) => {
        if (c.dayOfWeek !== null && c.dayOfWeek !== dayOfWeek) return false;
        if (c.serviceId && !serviceIds.includes(c.serviceId)) return false;
        if (c.serviceCategoryId && !categoryIds.has(c.serviceCategoryId)) return false;
        return true;
      });
      const latestStartFromConstraints = applicableConstraints.length
        ? Math.min(...applicableConstraints.map((c) => toMinutes(c.latestStartTime)))
        : Infinity;

      const latestStart = Math.min(toMinutes(dayEnd) - totalDuration, latestStartFromConstraints);
      const earliestStart = toMinutes(dayStart);
      if (latestStart < earliestStart) continue;

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          specialistId: specialist.id,
          date: parseDateUTC(date),
          status: { not: "cancelled" },
          ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        },
      });
      const occupied = existingAppointments.map((a) => ({ start: toMinutes(a.startTime), end: toMinutes(a.endTime) }));

      for (let start = earliestStart; start <= latestStart; start += SLOT_INTERVAL_MINUTES) {
        const end = start + totalDuration;
        const overlaps = occupied.some((o) => start < o.end && end > o.start);
        if (!overlaps) {
          slots.push({
            specialistId: specialist.id,
            specialistName: specialist.name,
            date,
            startTime: toHHMM(start),
            endTime: toHHMM(end),
          });
        }
      }
    }
  }

  return slots;
}
