import type { Prisma } from "@prisma/client";

import { checkAvailability } from "./availability";
import { appendAppointmentToSheet } from "./googleSheets";
import { normalizePhone } from "./phone";
import { prisma } from "./prisma";
import { generateConfirmationCode } from "./tokens";

export class SlotUnavailableError extends Error {
  constructor() {
    super("Ese horario ya no está disponible. Por favor elige otro.");
  }
}

export class InvalidBookingError extends Error {}

export interface CreateAppointmentParams {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  specialistId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  serviceIds: string[];
  notes?: string;
  source: "chat" | "admin";
}

// Same shape as appointments.ts's serializeAppointment() — GET /lookup, POST /:id/cancel,
// POST /, and POST /:id/reschedule all return this identical structure so the frontend has
// one consistent contract regardless of which endpoint produced the appointment.
export interface CreatedAppointment {
  id: string;
  confirmationCode: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  specialist: { id: string; name: string };
  services: { id: string; name: string; price: unknown; durationMinutes: number }[];
}

// Shared by POST /appointments (UJ-07) and the create_booking_draft AI tool — one place
// that owns "is this a valid, available slot, and what does it cost" so the model's
// decisions are always re-validated against real data before anything is persisted.
export async function createAppointment(params: CreateAppointmentParams): Promise<CreatedAppointment> {
  const services = await prisma.service.findMany({ where: { id: { in: params.serviceIds }, active: true } });
  if (services.length !== params.serviceIds.length) {
    throw new InvalidBookingError("Uno o más servicios no existen o no están activos.");
  }

  const specialist = await prisma.specialist.findUnique({
    where: { id: params.specialistId },
    include: { services: { where: { serviceId: { in: params.serviceIds } } } },
  });
  if (!specialist || !specialist.active) {
    throw new InvalidBookingError("Especialista no encontrada.");
  }
  if (specialist.services.length !== params.serviceIds.length) {
    throw new InvalidBookingError(`${specialist.name} no realiza todos los servicios solicitados.`);
  }

  // Re-validate against the real schedule + existing appointments — never trust that the
  // requested slot is actually free just because the client (or the model) asked for it.
  const slots = await checkAvailability({
    serviceIds: params.serviceIds,
    specialistId: params.specialistId,
    dateFrom: params.date,
    dateTo: params.date,
  });
  const matchingSlot = slots.find((s) => s.startTime === params.startTime);
  if (!matchingSlot) {
    throw new SlotUnavailableError();
  }

  const clientPhone = normalizePhone(params.clientPhone);
  const client = await prisma.client.upsert({
    where: { phone: clientPhone },
    update: { name: params.clientName, email: params.clientEmail },
    create: { name: params.clientName, phone: clientPhone, email: params.clientEmail },
  });

  const requiresConsultation = services.some((s) => s.requiresConsultation);
  const totalDuration = services.reduce((sum, s) => {
    const override = specialist.services.find((ss) => ss.serviceId === s.id)?.durationOverrideMinutes;
    return sum + (override ?? s.defaultDurationMinutes);
  }, 0);
  const [h, m] = params.startTime.split(":").map(Number);
  const endMinutes = h * 60 + m + totalDuration;
  const endTime = `${Math.floor(endMinutes / 60)
    .toString()
    .padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

  try {
    const appointment = await prisma.appointment.create({
      data: {
        clientId: client.id,
        specialistId: params.specialistId,
        date: new Date(`${params.date}T00:00:00Z`),
        startTime: params.startTime,
        endTime,
        status: requiresConsultation ? "pending_confirmation" : "confirmed",
        confirmationCode: generateConfirmationCode(),
        notes: params.notes,
        source: params.source,
        services: {
          create: services.map((s, i) => {
            const override = specialist.services.find((ss) => ss.serviceId === s.id)?.durationOverrideMinutes;
            return {
              serviceId: s.id,
              order: i,
              durationMinutesSnapshot: override ?? s.defaultDurationMinutes,
              priceSnapshot: s.price,
            };
          }),
        },
      },
      include: {
        specialist: { select: { id: true, name: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    // Fire-and-forget — never awaited, never allowed to fail the booking response. See
    // googleSheets.ts: this is entirely optional (silently no-ops if not configured) and
    // swallows its own errors.
    void appendAppointmentToSheet({
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      serviceNames: appointment.services.map((line) => line.service.name),
      specialistName: appointment.specialist.name,
      date: params.date,
      startTime: appointment.startTime,
      confirmationCode: appointment.confirmationCode,
    });

    return {
      id: appointment.id,
      confirmationCode: appointment.confirmationCode,
      status: appointment.status,
      date: params.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      specialist: appointment.specialist,
      services: appointment.services.map((line) => ({
        id: line.service.id,
        name: line.service.name,
        price: line.priceSnapshot,
        durationMinutes: line.durationMinutesSnapshot,
      })),
    };
  } catch (err) {
    // Unique violation on the partial index (specialistId, date, startTime) WHERE status !=
    // 'cancelled' — someone else booked this exact slot between our check and this insert.
    if ((err as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
      throw new SlotUnavailableError();
    }
    throw err;
  }
}

export class AppointmentNotReschedulableError extends Error {
  constructor() {
    super("Esta cita ya no se puede reprogramar.");
  }
}

// Moves an existing appointment to a new date/time, optionally with a different specialist
// (e.g. the client wants to switch staff) — re-validated against the real schedule exactly
// like a new booking (excluding the appointment's own current slot from the conflict check,
// so it doesn't block itself). Omitting newSpecialistId keeps the current one, same as before
// this parameter existed.
export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newStartTime: string,
  newSpecialistId?: string,
): Promise<CreatedAppointment> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { services: true, specialist: { select: { id: true, name: true, services: true } } },
  });
  if (!appointment) {
    throw new InvalidBookingError("Cita no encontrada.");
  }
  if (appointment.status === "cancelled" || appointment.status === "completed") {
    throw new AppointmentNotReschedulableError();
  }

  const targetSpecialistId = newSpecialistId ?? appointment.specialistId;
  const serviceIds = appointment.services.map((s) => s.serviceId);
  const slots = await checkAvailability({
    serviceIds,
    specialistId: targetSpecialistId,
    dateFrom: newDate,
    dateTo: newDate,
    excludeAppointmentId: appointment.id,
  });
  const matchingSlot = slots.find((s) => s.startTime === newStartTime);
  if (!matchingSlot) {
    throw new SlotUnavailableError();
  }

  // Use the slot's own endTime rather than recomputing from the original booking's snapshotted
  // duration — checkAvailability() already accounts for the target specialist's own duration
  // override (if any) for this service, which can differ from the specialist being switched
  // away from. Recomputing from the stale snapshot could silently produce an endTime the
  // availability check never actually validated as free.
  try {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        date: new Date(`${newDate}T00:00:00Z`),
        startTime: newStartTime,
        endTime: matchingSlot.endTime,
        ...(newSpecialistId ? { specialistId: newSpecialistId } : {}),
      },
      include: {
        specialist: { select: { id: true, name: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    return {
      id: updated.id,
      confirmationCode: updated.confirmationCode,
      status: updated.status,
      date: newDate,
      startTime: updated.startTime,
      endTime: updated.endTime,
      specialist: updated.specialist,
      services: updated.services.map((line) => ({
        id: line.service.id,
        name: line.service.name,
        price: line.priceSnapshot,
        durationMinutes: line.durationMinutesSnapshot,
      })),
    };
  } catch (err) {
    if ((err as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
      throw new SlotUnavailableError();
    }
    throw err;
  }
}
