import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

export const adminSpecialistsRouter = Router();

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}

const NOT_FOUND = "Especialista no encontrado";

// ── Specialist CRUD ─────────────────────────────────────────────────────

const specialistSchema = z.object({
  name: z.string().min(1).max(200),
  photoUrl: z.string().url().max(500).optional(),
  bio: z.string().max(2000).optional(),
  active: z.boolean().optional(),
});

adminSpecialistsRouter.get("/", async (_req, res, next) => {
  try {
    const specialists = await prisma.specialist.findMany({ orderBy: { name: "asc" } });
    res.json({ specialists });
  } catch (err) {
    next(err);
  }
});

adminSpecialistsRouter.get("/:id", async (req, res, next) => {
  try {
    const specialist = await prisma.specialist.findUnique({
      where: { id: req.params.id },
      include: {
        services: {
          include: { service: { select: { id: true, name: true, categoryId: true } } },
        },
      },
    });
    if (!specialist) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }

    res.json({
      id: specialist.id,
      name: specialist.name,
      active: specialist.active,
      photoUrl: specialist.photoUrl,
      bio: specialist.bio,
      services: specialist.services.map((ss) => ({
        id: ss.service.id,
        name: ss.service.name,
        categoryId: ss.service.categoryId,
        durationOverrideMinutes: ss.durationOverrideMinutes,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminSpecialistsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = specialistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const created = await prisma.specialist.create({ data: parsed.data });
    res.json(created);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "Ya existe un especialista con ese nombre" });
      return;
    }
    next(err);
  }
});

adminSpecialistsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = specialistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const existing = await prisma.specialist.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }

    const updated = await prisma.specialist.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(updated);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "Ya existe un especialista con ese nombre" });
      return;
    }
    next(err);
  }
});

// Soft delete only — appointments/schedule history reference this specialist.
adminSpecialistsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.specialist.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }

    const updated = await prisma.specialist.update({ where: { id: req.params.id }, data: { active: false } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── Service assignment ──────────────────────────────────────────────────

const servicesAssignmentSchema = z.object({
  serviceIds: z.array(z.string().uuid()),
  durationOverrides: z.record(z.number().int().positive()).optional(),
});

// Replaces the specialist's entire SpecialistService set — matches UJ-14's acceptance
// criteria ("desasignar un servicio ... ya no aparezca como opción válida") since a partial
// PATCH-style diff would make it easy to forget to actually remove a row.
adminSpecialistsRouter.put("/:id/services", async (req, res, next) => {
  try {
    const specialist = await prisma.specialist.findUnique({ where: { id: req.params.id } });
    if (!specialist) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }

    const parsed = servicesAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const { serviceIds, durationOverrides } = parsed.data;
    if (serviceIds.length > 0) {
      const foundCount = await prisma.service.count({ where: { id: { in: serviceIds } } });
      if (foundCount !== serviceIds.length) {
        res.status(400).json({ error: "Uno o más servicios no existen" });
        return;
      }
    }

    await prisma.$transaction([
      prisma.specialistService.deleteMany({ where: { specialistId: req.params.id } }),
      ...(serviceIds.length > 0
        ? [
            prisma.specialistService.createMany({
              data: serviceIds.map((serviceId) => ({
                specialistId: req.params.id,
                serviceId,
                durationOverrideMinutes: durationOverrides?.[serviceId],
              })),
            }),
          ]
        : []),
    ]);

    const updated = await prisma.specialistService.findMany({
      where: { specialistId: req.params.id },
      include: { service: { select: { id: true, name: true, categoryId: true } } },
    });

    res.json({
      services: updated.map((ss) => ({
        id: ss.service.id,
        name: ss.service.name,
        categoryId: ss.service.categoryId,
        durationOverrideMinutes: ss.durationOverrideMinutes,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── Schedule (weekly rules + last-start-time constraints) ──────────────

const ruleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean().optional(),
});

const constraintSchema = z.object({
  serviceId: z.string().uuid().optional(),
  serviceCategoryId: z.string().uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  latestStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(500).optional(),
});

const scheduleSchema = z.object({
  rules: z.array(ruleSchema),
  constraints: z.array(constraintSchema),
});

adminSpecialistsRouter.get("/:id/schedule", async (req, res, next) => {
  try {
    const specialist = await prisma.specialist.findUnique({ where: { id: req.params.id } });
    if (!specialist) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }

    const [rules, constraints, exceptions] = await Promise.all([
      prisma.scheduleRule.findMany({
        where: { specialistId: req.params.id },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.scheduleConstraint.findMany({ where: { specialistId: req.params.id } }),
      prisma.scheduleException.findMany({ where: { specialistId: req.params.id }, orderBy: { date: "asc" } }),
    ]);

    res.json({ rules, constraints, exceptions: exceptions.map(serializeException) });
  } catch (err) {
    next(err);
  }
});

// Replaces the specialist's entire rule + constraint set, same full-replace rationale as
// the service-assignment endpoint above. Exceptions are managed separately (they're
// individual dated events, not a weekly template) via the endpoints below.
adminSpecialistsRouter.put("/:id/schedule", async (req, res, next) => {
  try {
    const specialist = await prisma.specialist.findUnique({ where: { id: req.params.id } });
    if (!specialist) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }

    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const referencedServiceIds = parsed.data.constraints.map((c) => c.serviceId).filter((v): v is string => !!v);
    const referencedCategoryIds = parsed.data.constraints
      .map((c) => c.serviceCategoryId)
      .filter((v): v is string => !!v);

    const [serviceCount, categoryCount] = await Promise.all([
      referencedServiceIds.length > 0
        ? prisma.service.count({ where: { id: { in: referencedServiceIds } } })
        : Promise.resolve(0),
      referencedCategoryIds.length > 0
        ? prisma.serviceCategory.count({ where: { id: { in: referencedCategoryIds } } })
        : Promise.resolve(0),
    ]);
    if (serviceCount !== new Set(referencedServiceIds).size || categoryCount !== new Set(referencedCategoryIds).size) {
      res.status(400).json({ error: "Uno o más servicios/categorías referenciados no existen" });
      return;
    }

    await prisma.$transaction([
      prisma.scheduleRule.deleteMany({ where: { specialistId: req.params.id } }),
      prisma.scheduleConstraint.deleteMany({ where: { specialistId: req.params.id } }),
      ...(parsed.data.rules.length > 0
        ? [
            prisma.scheduleRule.createMany({
              data: parsed.data.rules.map((r) => ({ ...r, specialistId: req.params.id })),
            }),
          ]
        : []),
      ...(parsed.data.constraints.length > 0
        ? [
            prisma.scheduleConstraint.createMany({
              data: parsed.data.constraints.map((c) => ({ ...c, specialistId: req.params.id })),
            }),
          ]
        : []),
    ]);

    const [rules, constraints] = await Promise.all([
      prisma.scheduleRule.findMany({
        where: { specialistId: req.params.id },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.scheduleConstraint.findMany({ where: { specialistId: req.params.id } }),
    ]);

    res.json({ rules, constraints });
  } catch (err) {
    next(err);
  }
});

// ── Schedule exceptions (day off / custom hours on a specific date) ────

const exceptionSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(["day_off", "custom_hours"]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((data) => (data.type === "custom_hours" ? Boolean(data.startTime && data.endTime) : true), {
    message: "startTime y endTime son requeridos cuando type es 'custom_hours'",
    path: ["startTime"],
  });

function serializeException(exception: {
  id: string;
  date: Date;
  type: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}) {
  return {
    id: exception.id,
    date: exception.date.toISOString().slice(0, 10),
    type: exception.type,
    startTime: exception.startTime,
    endTime: exception.endTime,
    reason: exception.reason,
  };
}

adminSpecialistsRouter.post("/:id/schedule-exceptions", async (req, res, next) => {
  try {
    const specialist = await prisma.specialist.findUnique({ where: { id: req.params.id } });
    if (!specialist) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }

    const parsed = exceptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const created = await prisma.scheduleException.create({
      data: { ...parsed.data, date: new Date(`${parsed.data.date}T00:00:00Z`), specialistId: req.params.id },
    });
    res.json(serializeException(created));
  } catch (err) {
    next(err);
  }
});

adminSpecialistsRouter.delete("/:id/schedule-exceptions/:exceptionId", async (req, res, next) => {
  try {
    const exception = await prisma.scheduleException.findUnique({ where: { id: req.params.exceptionId } });
    if (!exception || exception.specialistId !== req.params.id) {
      res.status(404).json({ error: "Excepción no encontrada" });
      return;
    }

    await prisma.scheduleException.delete({ where: { id: req.params.exceptionId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
