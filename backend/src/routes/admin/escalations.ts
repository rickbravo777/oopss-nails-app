import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

export const escalationsRouter = Router();

const listQuerySchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
});

escalationsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const escalations = await prisma.escalationFlag.findMany({
      where: parsed.data.status ? { status: parsed.data.status } : {},
      include: {
        assignedSpecialist: { select: { id: true, name: true } },
        conversation: { include: { client: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      escalations: escalations.map((e) => ({
        id: e.id,
        conversationId: e.conversationId,
        reason: e.reason,
        status: e.status,
        assignedSpecialist: e.assignedSpecialist,
        resolutionNotes: e.resolutionNotes,
        createdAt: e.createdAt,
        resolvedAt: e.resolvedAt,
        client: e.conversation.client,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const resolveSchema = z.object({
  resolutionNotes: z.string().max(2000).optional(),
});

escalationsRouter.put("/:id/resolve", async (req, res, next) => {
  try {
    const existing = await prisma.escalationFlag.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Escalamiento no encontrado" });
      return;
    }

    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const updated = await prisma.escalationFlag.update({
      where: { id: req.params.id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        ...(parsed.data.resolutionNotes !== undefined ? { resolutionNotes: parsed.data.resolutionNotes } : {}),
      },
      include: { assignedSpecialist: { select: { id: true, name: true } } },
    });

    res.json({
      id: updated.id,
      status: updated.status,
      resolutionNotes: updated.resolutionNotes,
      resolvedAt: updated.resolvedAt,
      assignedSpecialist: updated.assignedSpecialist,
    });
  } catch (err) {
    next(err);
  }
});
