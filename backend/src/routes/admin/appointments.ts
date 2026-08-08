import { Router } from "express";
import { z } from "zod";

import {
  AppointmentNotReschedulableError,
  InvalidBookingError,
  rescheduleAppointment,
  SlotUnavailableError,
} from "../../lib/booking";
import { prisma } from "../../lib/prisma";

export const adminAppointmentsRouter = Router();

const NOT_FOUND_MESSAGE = "Cita no encontrada";

const appointmentInclude = {
  client: { select: { name: true, phone: true } },
  specialist: { select: { id: true, name: true } },
  services: { include: { service: { select: { id: true, name: true } } }, orderBy: { order: "asc" as const } },
};

function serialize(appointment: {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  confirmationCode: string;
  notes: string | null;
  source: string;
  createdAt: Date;
  client: { name: string; phone: string };
  specialist: { id: string; name: string };
  services: { service: { id: string; name: string }; durationMinutesSnapshot: number; priceSnapshot: unknown }[];
}) {
  return {
    id: appointment.id,
    date: appointment.date.toISOString().slice(0, 10),
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    confirmationCode: appointment.confirmationCode,
    notes: appointment.notes,
    source: appointment.source,
    createdAt: appointment.createdAt,
    client: appointment.client,
    specialist: appointment.specialist,
    services: appointment.services.map((line) => ({
      id: line.service.id,
      name: line.service.name,
      durationMinutes: line.durationMinutesSnapshot,
      price: line.priceSnapshot,
    })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const listQuerySchema = z
  .object({
    date: z.string().regex(DATE_RE).optional(),
    dateFrom: z.string().regex(DATE_RE).optional(),
    dateTo: z.string().regex(DATE_RE).optional(),
    specialistId: z.string().uuid().optional(),
    status: z.enum(["pending_confirmation", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  })
  .refine((data) => (data.dateFrom === undefined) === (data.dateTo === undefined), {
    message: "dateFrom y dateTo deben proporcionarse juntos",
    path: ["dateTo"],
  });

adminAppointmentsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    // dateFrom/dateTo powers the calendar's week/day views (UJ-16 visual redesign); a single
    // `date` still works for the existing list filter — both are optional and mutually usable.
    const dateFilter = parsed.data.dateFrom
      ? {
          date: {
            gte: new Date(`${parsed.data.dateFrom}T00:00:00Z`),
            lte: new Date(`${parsed.data.dateTo}T00:00:00Z`),
          },
        }
      : parsed.data.date
        ? { date: new Date(`${parsed.data.date}T00:00:00Z`) }
        : {};

    const appointments = await prisma.appointment.findMany({
      where: {
        ...dateFilter,
        ...(parsed.data.specialistId ? { specialistId: parsed.data.specialistId } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
      },
      include: appointmentInclude,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    res.json({ appointments: appointments.map(serialize) });
  } catch (err) {
    next(err);
  }
});

const editSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    status: z.enum(["pending_confirmation", "confirmed", "cancelled", "completed", "no_show"]).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => (data.date === undefined) === (data.startTime === undefined), {
    message: "date y startTime deben proporcionarse juntos",
    path: ["startTime"],
  });

// Reuses rescheduleAppointment() for date/time changes, so a manual admin edit is
// re-validated against real availability exactly like a booking made through chat —
// this is UJ-16's explicit acceptance criterion, not just a nice-to-have.
adminAppointmentsRouter.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: NOT_FOUND_MESSAGE });
      return;
    }

    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    if (parsed.data.date && parsed.data.startTime) {
      await rescheduleAppointment(req.params.id, parsed.data.date, parsed.data.startTime);
    }

    if (parsed.data.status !== undefined || parsed.data.notes !== undefined) {
      await prisma.appointment.update({
        where: { id: req.params.id },
        data: {
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        },
      });
    }

    const updated = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: appointmentInclude,
    });
    res.json(serialize(updated!));
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof AppointmentNotReschedulableError) {
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof InvalidBookingError) {
      res.status(404).json({ error: NOT_FOUND_MESSAGE });
      return;
    }
    next(err);
  }
});
