import type { NextFunction, Request, Response } from "express";

import { verifyAdminToken } from "../lib/jwt";

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Autenticación requerida" });
    return;
  }

  try {
    req.admin = verifyAdminToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}
