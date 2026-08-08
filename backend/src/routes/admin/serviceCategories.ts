import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

export const adminServiceCategoriesRouter = Router();

const categorySchema = z.object({
  name: z.string().min(1).max(200),
  displayOrder: z.number().int().optional(),
});

adminServiceCategoriesRouter.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.serviceCategory.findMany({ orderBy: { displayOrder: "asc" } });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

adminServiceCategoriesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const created = await prisma.serviceCategory.create({ data: parsed.data });
    res.json(created);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
      return;
    }
    next(err);
  }
});

adminServiceCategoriesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const existing = await prisma.serviceCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Categoría no encontrada" });
      return;
    }

    const updated = await prisma.serviceCategory.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(updated);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
      return;
    }
    next(err);
  }
});

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}
