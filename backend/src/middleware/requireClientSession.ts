import type { Conversation } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma";

declare module "express-serve-static-core" {
  interface Request {
    conversation?: Conversation;
  }
}

export async function requireClientSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.header("X-Session-Token");
  if (!token) {
    res.status(401).json({ error: "Se requiere un token de sesión" });
    return;
  }

  const conversation = await prisma.conversation.findUnique({ where: { sessionToken: token } });
  if (!conversation) {
    res.status(401).json({ error: "Token de sesión inválido" });
    return;
  }

  req.conversation = conversation;
  next();
}
