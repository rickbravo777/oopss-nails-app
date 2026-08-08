import bcrypt from "bcrypt";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../lib/prisma";

vi.mock("../lib/prisma", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// createApp is imported after the mock so it picks up the mocked prisma module.
const { createApp } = await import("../app");

const mockedFindUnique = vi.mocked(prisma.adminUser.findUnique);
const mockedUpdate = vi.mocked(prisma.adminUser.update);

const FAKE_ADMIN = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Admin",
  email: "admin@oopssnails.local",
  active: true,
  lastLoginAt: null,
};

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a token for valid credentials", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    mockedFindUnique.mockResolvedValue({ ...FAKE_ADMIN, passwordHash } as never);
    mockedUpdate.mockResolvedValue({} as never);

    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .send({ email: FAKE_ADMIN.email, password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.admin.email).toBe(FAKE_ADMIN.email);
    expect(res.body.admin.passwordHash).toBeUndefined();
  });

  it("rejects an unknown email with a generic message", async () => {
    mockedFindUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .send({ email: "nobody@oopssnails.local", password: "whatever" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Correo o contraseña inválidos");
  });

  it("rejects a wrong password with the same generic message as an unknown email", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    mockedFindUnique.mockResolvedValue({ ...FAKE_ADMIN, passwordHash } as never);

    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .send({ email: FAKE_ADMIN.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Correo o contraseña inválidos");
  });

  it("rejects a deactivated admin account", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    mockedFindUnique.mockResolvedValue({ ...FAKE_ADMIN, active: false, passwordHash } as never);

    const res = await request(createApp())
      .post("/api/v1/auth/login")
      .send({ email: FAKE_ADMIN.email, password: "correct-password" });

    expect(res.status).toBe(401);
  });

  it("rejects a malformed request body", async () => {
    const res = await request(createApp()).post("/api/v1/auth/login").send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests with no token", async () => {
    const res = await request(createApp()).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a garbage token", async () => {
    const res = await request(createApp()).get("/api/v1/auth/me").set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });
});
