import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

export const adminServicesRouter = Router();

const serviceSchema = z
  .object({
    categoryId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    priceType: z.enum(["fixed", "starting_at", "range"]),
    price: z.number().nonnegative(),
    priceMax: z.number().nonnegative().optional(),
    currency: z.string().min(1).max(10).optional(),
    requiresConsultation: z.boolean().optional(),
    requiresPhoto: z.boolean().optional(),
    defaultDurationMinutes: z.number().int().positive(),
    sessionPackageSize: z.number().int().positive().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (data) =>
      data.priceType === "range"
        ? data.priceMax !== undefined && data.priceMax > data.price
        : data.priceMax === undefined,
    {
      message: "priceMax solo aplica (y es requerido) cuando priceType es 'range', y debe ser mayor que price",
      path: ["priceMax"],
    },
  );

function serialize(service: {
  id: string;
  categoryId: string;
  category: { name: string };
  name: string;
  description: string | null;
  priceType: string;
  price: unknown;
  priceMax: unknown;
  currency: string;
  requiresConsultation: boolean;
  requiresPhoto: boolean;
  defaultDurationMinutes: number;
  sessionPackageSize: number | null;
  active: boolean;
  sortOrder: number;
}) {
  return {
    id: service.id,
    categoryId: service.categoryId,
    categoryName: service.category.name,
    name: service.name,
    description: service.description,
    priceType: service.priceType,
    price: service.price,
    priceMax: service.priceMax,
    currency: service.currency,
    requiresConsultation: service.requiresConsultation,
    requiresPhoto: service.requiresPhoto,
    defaultDurationMinutes: service.defaultDurationMinutes,
    sessionPackageSize: service.sessionPackageSize,
    active: service.active,
    sortOrder: service.sortOrder,
  };
}

// Admin view intentionally includes inactive services (the public GET /services never does)
// so a deactivated service can still be found and re-activated from the admin table.
adminServicesRouter.get("/", async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { displayOrder: "asc" } }, { sortOrder: "asc" }],
    });
    res.json({ services: services.map(serialize) });
  } catch (err) {
    next(err);
  }
});

adminServicesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const category = await prisma.serviceCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) {
      res.status(400).json({ error: "Categoría no encontrada" });
      return;
    }

    const created = await prisma.service.create({
      data: parsed.data,
      include: { category: { select: { name: true } } },
    });
    res.json(serialize(created));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "Ya existe un servicio con ese nombre" });
      return;
    }
    next(err);
  }
});

adminServicesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const existing = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return;
    }

    const category = await prisma.serviceCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) {
      res.status(400).json({ error: "Categoría no encontrada" });
      return;
    }

    const updated = await prisma.service.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { category: { select: { name: true } } },
    });
    res.json(serialize(updated));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "Ya existe un servicio con ese nombre" });
      return;
    }
    next(err);
  }
});

// "Delete" is a soft delete (active=false) — services are referenced by historical
// AppointmentService rows and must never be hard-removed once bookings reference them.
adminServicesRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return;
    }

    const updated = await prisma.service.update({
      where: { id: req.params.id },
      data: { active: false },
      include: { category: { select: { name: true } } },
    });
    res.json(serialize(updated));
  } catch (err) {
    next(err);
  }
});

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}
