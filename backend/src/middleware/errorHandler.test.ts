import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../lib/prisma";

vi.mock("../lib/prisma", () => ({
  prisma: { errorLog: { create: vi.fn().mockResolvedValue({}) } },
}));

const { HttpError, errorHandler } = await import("./errorHandler");

function fakeRes() {
  const res: { statusCode?: number; body?: unknown; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

const fakeReq = { method: "GET", path: "/api/v1/appointments" } as never;

describe("errorHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the HttpError status and message for known errors, without logging to ErrorLog", () => {
    const res = fakeRes();
    errorHandler(new HttpError(404, "Cita no encontrada"), fakeReq, res as never, vi.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Cita no encontrada" });
    expect(prisma.errorLog.create).not.toHaveBeenCalled();
  });

  it("returns a generic message for unexpected errors and records them in ErrorLog", () => {
    const res = fakeRes();
    errorHandler(new Error("db connection lost"), fakeReq, res as never, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
    expect(prisma.errorLog.create).toHaveBeenCalledWith({
      data: { source: "GET /api/v1/appointments", message: "db connection lost" },
    });
  });

  it("never leaks the real error message to the client for 5xx errors", () => {
    const res = fakeRes();
    errorHandler(new Error("Postgres password is hunter2"), fakeReq, res as never, vi.fn());

    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });
});
