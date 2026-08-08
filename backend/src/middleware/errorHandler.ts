import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "No encontrado" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Error interno del servidor";

  if (status >= 500) {
    console.error(err);
    // Best-effort, fire-and-forget: a logging failure must never affect the response
    // already being sent, and the admin dashboard's health view is not on the critical path.
    prisma.errorLog
      .create({ data: { source: `${_req.method} ${_req.path}`, message } })
      .catch(() => {});
  }

  res.status(status).json({ error: status >= 500 ? "Error interno del servidor" : message });
}
