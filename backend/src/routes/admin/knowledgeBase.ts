import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

export const knowledgeBaseRouter = Router();

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}

// ── Term synonyms ("pintura en gel" → Manicure Gel) ─────────────────────

const synonymSchema = z
  .object({
    term: z.string().min(1).max(200),
    canonicalServiceId: z.string().uuid().optional(),
    canonicalCategoryId: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.canonicalServiceId) !== Boolean(data.canonicalCategoryId) || (!data.canonicalServiceId && !data.canonicalCategoryId), {
    message: "Especifica canonicalServiceId o canonicalCategoryId, no ambos",
    path: ["canonicalServiceId"],
  });

knowledgeBaseRouter.get("/synonyms", async (_req, res, next) => {
  try {
    const synonyms = await prisma.termSynonym.findMany({
      include: {
        canonicalService: { select: { id: true, name: true } },
        canonicalCategory: { select: { id: true, name: true } },
      },
      orderBy: { term: "asc" },
    });
    res.json({ synonyms });
  } catch (err) {
    next(err);
  }
});

knowledgeBaseRouter.post("/synonyms", async (req, res, next) => {
  try {
    const parsed = synonymSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    if (parsed.data.canonicalServiceId) {
      const service = await prisma.service.findUnique({ where: { id: parsed.data.canonicalServiceId } });
      if (!service) {
        res.status(400).json({ error: "Servicio no encontrado" });
        return;
      }
    }
    if (parsed.data.canonicalCategoryId) {
      const category = await prisma.serviceCategory.findUnique({ where: { id: parsed.data.canonicalCategoryId } });
      if (!category) {
        res.status(400).json({ error: "Categoría no encontrada" });
        return;
      }
    }

    const created = await prisma.termSynonym.create({
      data: parsed.data,
      include: {
        canonicalService: { select: { id: true, name: true } },
        canonicalCategory: { select: { id: true, name: true } },
      },
    });
    res.json(created);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: "Ya existe una equivalencia idéntica" });
      return;
    }
    next(err);
  }
});

knowledgeBaseRouter.delete("/synonyms/:id", async (req, res, next) => {
  try {
    const existing = await prisma.termSynonym.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Equivalencia no encontrada" });
      return;
    }
    await prisma.termSynonym.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Assistant policies (free-text fragments appended to the system prompt) ─

const policySchema = z.object({
  value: z.string().min(1).max(2000),
});

knowledgeBaseRouter.get("/policies", async (_req, res, next) => {
  try {
    const policies = await prisma.assistantPolicy.findMany({ orderBy: { key: "asc" } });
    res.json({ policies });
  } catch (err) {
    next(err);
  }
});

// Upsert by key — the admin panel doesn't need a separate "create" step for policies,
// since a policy is just a named text fragment identified by its own key.
knowledgeBaseRouter.put("/policies/:key", async (req, res, next) => {
  try {
    const parsed = policySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const updated = await prisma.assistantPolicy.upsert({
      where: { key: req.params.key },
      update: { value: parsed.data.value },
      create: { key: req.params.key, value: parsed.data.value },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

knowledgeBaseRouter.delete("/policies/:key", async (req, res, next) => {
  try {
    const existing = await prisma.assistantPolicy.findUnique({ where: { key: req.params.key } });
    if (!existing) {
      res.status(404).json({ error: "Política no encontrada" });
      return;
    }
    await prisma.assistantPolicy.delete({ where: { key: req.params.key } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
