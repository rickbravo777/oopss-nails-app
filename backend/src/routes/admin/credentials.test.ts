import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { encrypt } from "../../lib/crypto";
import { signAdminToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    credential: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const { createApp } = await import("../../app");

const mockedFindMany = vi.mocked(prisma.credential.findMany);
const mockedUpsert = vi.mocked(prisma.credential.upsert);

const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

describe("GET /api/v1/admin/credentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp()).get("/api/v1/admin/credentials");
    expect(res.status).toBe(401);
  });

  it("reports every known key as unconfigured when no rows exist", async () => {
    mockedFindMany.mockResolvedValue([]);

    const res = await request(createApp())
      .get("/api/v1/admin/credentials")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Known keys as of this test: OpenAI + the two Google Sheets sync keys (post-delivery
    // iteration — see docs/work_log.md). Checked by key rather than asserting the array's
    // exact length/order, so adding a future known key doesn't force an unrelated edit here.
    expect(res.body.credentials).toEqual(
      expect.arrayContaining([
        { key: "OPENAI_API_KEY", configured: false, maskedValue: null, updatedAt: null },
        { key: "GOOGLE_SERVICE_ACCOUNT_JSON", configured: false, maskedValue: null, updatedAt: null },
        { key: "GOOGLE_SHEETS_SPREADSHEET_ID", configured: false, maskedValue: null, updatedAt: null },
      ]),
    );
    expect(res.body.credentials).toHaveLength(3);
  });

  it("returns a masked value, never the real secret, when configured", async () => {
    mockedFindMany.mockResolvedValue([
      {
        key: "OPENAI_API_KEY",
        encryptedValue: encrypt("sk-real-secret-value-123"),
        updatedAt: new Date("2026-08-03T00:00:00Z"),
      },
    ] as never);

    const res = await request(createApp())
      .get("/api/v1/admin/credentials")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const entry = res.body.credentials[0];
    expect(entry.configured).toBe(true);
    expect(entry.maskedValue).toBe("sk-...-123");
    expect(JSON.stringify(res.body)).not.toContain("sk-real-secret-value-123");
  });
});

describe("PUT /api/v1/admin/credentials/:key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown credential key", async () => {
    const res = await request(createApp())
      .put("/api/v1/admin/credentials/SOME_RANDOM_KEY")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ value: "whatever" });

    expect(res.status).toBe(404);
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("encrypts the value before persisting and returns only a masked value", async () => {
    mockedUpsert.mockResolvedValue({
      key: "OPENAI_API_KEY",
      updatedAt: new Date("2026-08-03T00:00:00Z"),
    } as never);

    const res = await request(createApp())
      .put("/api/v1/admin/credentials/OPENAI_API_KEY")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ value: "sk-new-secret-value-456" });

    expect(res.status).toBe(200);
    expect(res.body.maskedValue).toBe("sk-...-456");
    expect(JSON.stringify(res.body)).not.toContain("sk-new-secret-value-456");

    const upsertArg = mockedUpsert.mock.calls[0][0] as { create: { encryptedValue: string } };
    expect(upsertArg.create.encryptedValue).not.toContain("sk-new-secret-value-456");
  });

  it("rejects requests without a valid admin token", async () => {
    const res = await request(createApp())
      .put("/api/v1/admin/credentials/OPENAI_API_KEY")
      .send({ value: "whatever" });

    expect(res.status).toBe(401);
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("accepts the Google Sheets sync keys too, not just OPENAI_API_KEY", async () => {
    mockedUpsert.mockResolvedValue({
      key: "GOOGLE_SHEETS_SPREADSHEET_ID",
      updatedAt: new Date("2026-08-07T00:00:00Z"),
    } as never);

    const res = await request(createApp())
      .put("/api/v1/admin/credentials/GOOGLE_SHEETS_SPREADSHEET_ID")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ value: "1AbCdEfGhIjKlMnOpQrStUvWxYz" });

    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
  });
});
