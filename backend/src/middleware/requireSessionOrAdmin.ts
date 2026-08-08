import type { NextFunction, Request, Response } from "express";

import { verifyAdminToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

// Accepts either a valid admin JWT or a valid client X-Session-Token — used by endpoints
// (like photo upload) that both the public chat and the admin panel can call.
export async function requireSessionOrAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (bearerToken) {
    try {
      req.admin = verifyAdminToken(bearerToken);
      next();
      return;
    } catch {
      // Fall through to session-token check.
    }
  }

  const sessionToken = req.header("X-Session-Token");
  if (sessionToken) {
    const conversation = await prisma.conversation.findUnique({ where: { sessionToken } });
    if (conversation) {
      req.conversation = conversation;
      next();
      return;
    }
  }

  res.status(401).json({ error: "Autenticación requerida" });
}
