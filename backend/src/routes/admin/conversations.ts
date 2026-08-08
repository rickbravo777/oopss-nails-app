import { Router } from "express";

import { prisma } from "../../lib/prisma";

export const adminConversationsRouter = Router();

// Read-only: lets the admin panel show the original chat transcript behind an escalation
// (design/ui_wireframes.md's "Admin — Escalamientos" wireframe calls for "enlace a la
// conversación original" / "Ver conversación", which UJ-19 didn't otherwise expose).
adminConversationsRouter.get("/:id", async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { name: true, phone: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!conversation) {
      res.status(404).json({ error: "Conversación no encontrada" });
      return;
    }

    res.json({
      id: conversation.id,
      status: conversation.status,
      client: conversation.client,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});
