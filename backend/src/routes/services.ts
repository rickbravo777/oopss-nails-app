import { Router } from "express";

import { prisma } from "../lib/prisma";

export const servicesRouter = Router();

function serializeService(service: {
  id: string;
  categoryId: string;
  category: { name: string };
  name: string;
  priceType: string;
  price: unknown;
  priceMax: unknown;
  currency: string;
  requiresConsultation: boolean;
  requiresPhoto: boolean;
  defaultDurationMinutes: number;
  sessionPackageSize: number | null;
}) {
  return {
    id: service.id,
    categoryId: service.categoryId,
    categoryName: service.category.name,
    name: service.name,
    priceType: service.priceType,
    price: service.price,
    priceMax: service.priceMax,
    currency: service.currency,
    requiresConsultation: service.requiresConsultation,
    requiresPhoto: service.requiresPhoto,
    defaultDurationMinutes: service.defaultDurationMinutes,
    sessionPackageSize: service.sessionPackageSize,
  };
}

servicesRouter.get("/", async (req, res, next) => {
  try {
    const categoryName = typeof req.query.category === "string" ? req.query.category : undefined;

    const services = await prisma.service.findMany({
      where: {
        active: true,
        ...(categoryName ? { category: { name: categoryName } } : {}),
      },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { displayOrder: "asc" } }, { sortOrder: "asc" }],
    });

    res.json({ services: services.map(serializeService) });
  } catch (err) {
    next(err);
  }
});

servicesRouter.get("/:id", async (req, res, next) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: {
        category: { select: { name: true } },
        specialists: { include: { specialist: { select: { id: true, name: true } } } },
      },
    });

    if (!service || !service.active) {
      res.status(404).json({ error: "Servicio no encontrado" });
      return;
    }

    res.json({
      ...serializeService(service),
      description: service.description,
      specialists: service.specialists.map((ss) => ss.specialist),
    });
  } catch (err) {
    next(err);
  }
});
