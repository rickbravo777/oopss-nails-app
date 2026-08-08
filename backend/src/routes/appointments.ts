import { Router } from "express";
import { z } from "zod";

import {
  AppointmentNotReschedulableError,
  createAppointment,
  InvalidBookingError,
  rescheduleAppointment,
  SlotUnavailableError,
} from "../lib/booking";
import { verifyAdminToken } from "../lib/jwt";
import { normalizePhone } from "../lib/phone";
import { prisma } from "../lib/prisma";
import { selfServiceLookupLimiter } from "../lib/rateLimiters";
import { requireSessionOrAdmin } from "../middleware/requireSessionOrAdmin";

export const appointmentsRouter = Router();

const NOT_FOUND_MESSAGE = "Cita no encontrada";

const appointmentInclude = {
  specialist: { select: { id: true, name: true } },
  services: { include: { service: { select: { id: true, name: true } } }, orderBy: { order: "asc" as const } },
};

function serializeAppointment(appointment: {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  confirmationCode: string;
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
    specialist: appointment.specialist,
    services: appointment.services.map((line) => ({
      id: line.service.id,
      name: line.service.name,
      durationMinutes: line.durationMinutesSnapshot,
      price: line.priceSnapshot,
    })),
  };
}

const createSchema = z.object({
  clientName: z.string().min(1).max(200),
  clientPhone: z.string().min(1).max(50),
  clientEmail: z.string().email().optional(),
  specialistId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  services: z.array(z.string().uuid()).min(1),
  notes: z.string().max(1000).optional(),
});

// Requires a valid client chat session or an admin — matches design/api_contracts.md
// ("Session token (desde chat) o admin") and the same rate limiter used by the sibling
// self-service endpoints below, since this creates a real appointment against a
// specialist's calendar and must not be spammable by an anonymous, unrate-limited caller.
appointmentsRouter.post("/", requireSessionOrAdmin, selfServiceLookupLimiter, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const appointment = await createAppointment({
      clientName: parsed.data.clientName,
      clientPhone: parsed.data.clientPhone,
      clientEmail: parsed.data.clientEmail,
      specialistId: parsed.data.specialistId,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      serviceIds: parsed.data.services,
      notes: parsed.data.notes,
      source: req.admin ? "admin" : "chat",
    });

    res.json(appointment);
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof InvalidBookingError) {
      res.status(422).json({ error: err.message });
      return;
    }
    next(err);
  }
});

const lookupSchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(1),
});

appointmentsRouter.get("/lookup", selfServiceLookupLimiter, async (req, res, next) => {
  try {
    const parsed = lookupSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { confirmationCode: parsed.data.code.toUpperCase() },
      include: { ...appointmentInclude, client: { select: { phone: true } } },
    });

    if (!appointment || appointment.client.phone !== normalizePhone(parsed.data.phone)) {
      res.status(404).json({ error: NOT_FOUND_MESSAGE });
      return;
    }

    res.json(serializeAppointment(appointment));
  } catch (err) {
    next(err);
  }
});

const cancelSchema = z.object({
  phone: z.string().min(1).optional(),
  confirmationCode: z.string().min(1).optional(),
});

appointmentsRouter.post("/:id/cancel", selfServiceLookupLimiter, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    const isAdmin = bearerToken ? Boolean(safeVerifyAdmin(bearerToken)) : false;

    const parsed = cancelSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { ...appointmentInclude, client: { select: { phone: true } } },
    });

    if (!appointment) {
      res.status(404).json({ error: NOT_FOUND_MESSAGE });
      return;
    }

    if (!isAdmin) {
      const { phone, confirmationCode } = parsed.data;
      const matches =
        (phone !== undefined && normalizePhone(phone) === appointment.client.phone) &&
        confirmationCode?.toUpperCase() === appointment.confirmationCode;
      if (!matches) {
        res.status(404).json({ error: NOT_FOUND_MESSAGE });
        return;
      }
    }

    if (appointment.status === "cancelled" || appointment.status === "completed") {
      res.status(409).json({ error: "Esta cita ya no se puede cancelar" });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
      include: { ...appointmentInclude, client: { select: { phone: true } } },
    });

    res.json(serializeAppointment(updated));
  } catch (err) {
    next(err);
  }
});

const rescheduleSchema = z.object({
  phone: z.string().min(1).optional(),
  confirmationCode: z.string().min(1).optional(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newStartTime: z.string().regex(/^\d{2}:\d{2}$/),
});

appointmentsRouter.post("/:id/reschedule", selfServiceLookupLimiter, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    const isAdmin = bearerToken ? Boolean(safeVerifyAdmin(bearerToken)) : false;

    const parsed = rescheduleSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const existing = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { client: { select: { phone: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: NOT_FOUND_MESSAGE });
      return;
    }

    if (!isAdmin) {
      const { phone, confirmationCode } = parsed.data;
      const matches =
        (phone !== undefined && normalizePhone(phone) === existing.client.phone) &&
        confirmationCode?.toUpperCase() === existing.confirmationCode;
      if (!matches) {
        res.status(404).json({ error: NOT_FOUND_MESSAGE });
        return;
      }
    }

    const updated = await rescheduleAppointment(req.params.id, parsed.data.newDate, parsed.data.newStartTime);
    res.json(updated);
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

function safeVerifyAdmin(token: string) {
  try {
    return verifyAdminToken(token);
  } catch {
    return null;
  }
}
