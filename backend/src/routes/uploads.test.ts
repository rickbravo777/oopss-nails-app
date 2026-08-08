import fs from "node:fs";
import path from "node:path";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signAdminToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { UPLOADS_DIR } from "../lib/uploadStorage";

vi.mock("../lib/prisma", () => ({
  prisma: {
    conversation: { findUnique: vi.fn() },
    photoUpload: { create: vi.fn(), findUnique: vi.fn() },
  },
}));

const { createApp } = await import("../app");

const mockedConversationFindUnique = vi.mocked(prisma.conversation.findUnique);
const mockedPhotoCreate = vi.mocked(prisma.photoUpload.create);
const mockedPhotoFindUnique = vi.mocked(prisma.photoUpload.findUnique);

// Smallest possible valid PNG (1x1 transparent pixel).
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const filesToCleanup: string[] = [];
afterEach(() => {
  for (const f of filesToCleanup.splice(0)) {
    fs.rmSync(f, { force: true });
  }
});

const FAKE_CONVERSATION = { id: "conv-1", sessionToken: "session-abc", clientId: null };

describe("POST /api/v1/uploads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests with no admin token and no session token", async () => {
    const res = await request(createApp())
      .post("/api/v1/uploads")
      .field("purpose", "nail_reference")
      .attach("file", TINY_PNG, "photo.png");

    expect(res.status).toBe(401);
    expect(mockedPhotoCreate).not.toHaveBeenCalled();
  });

  it("accepts a valid image from an authenticated client session and persists it", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);
    mockedPhotoCreate.mockImplementation(
      async (args) => ({ id: "photo-1", ...(args as { data: object }).data }) as never,
    );

    const res = await request(createApp())
      .post("/api/v1/uploads")
      .set("X-Session-Token", "session-abc")
      .field("purpose", "nail_reference")
      .attach("file", TINY_PNG, "photo.png");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("photo-1");

    const createArg = mockedPhotoCreate.mock.calls[0][0] as { data: { conversationId: string; mimeType: string } };
    expect(createArg.data.conversationId).toBe("conv-1");
    expect(createArg.data.mimeType).toBe("image/png");

    const writtenPath = path.join(UPLOADS_DIR, res.body.filePath);
    expect(fs.existsSync(writtenPath)).toBe(true);
    filesToCleanup.push(writtenPath);
  });

  it("rejects a non-image file type before it reaches the database", async () => {
    const res = await request(createApp())
      .post("/api/v1/uploads")
      .set("X-Session-Token", "session-abc")
      .field("purpose", "nail_reference")
      .attach("file", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(mockedPhotoCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid purpose and deletes the file it had already written", async () => {
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp())
      .post("/api/v1/uploads")
      .set("X-Session-Token", "session-abc")
      .field("purpose", "not_a_real_purpose")
      .attach("file", TINY_PNG, "photo.png");

    expect(res.status).toBe(400);
    expect(mockedPhotoCreate).not.toHaveBeenCalled();

    // Give the async fs.unlink a tick, then confirm nothing was left behind in UPLOADS_DIR
    // beyond what existed before (best-effort — directory should not accumulate orphans).
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe("GET /api/v1/uploads/:id", () => {
  const testFilePath = "test-owned-photo.png";
  const absolutePath = path.join(UPLOADS_DIR, testFilePath);

  beforeEach(() => {
    vi.clearAllMocks();
    fs.writeFileSync(absolutePath, TINY_PNG);
    filesToCleanup.push(absolutePath);
  });

  it("returns 404 for a non-existent id", async () => {
    mockedPhotoFindUnique.mockResolvedValue(null);
    const res = await request(createApp()).get("/api/v1/uploads/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns 404 (not a leaking 403) when neither admin nor the owning session is presented", async () => {
    mockedPhotoFindUnique.mockResolvedValue({
      id: "photo-1",
      filePath: testFilePath,
      conversationId: "conv-1",
    } as never);
    mockedConversationFindUnique.mockResolvedValue(null);

    const res = await request(createApp()).get("/api/v1/uploads/photo-1").set("X-Session-Token", "wrong-token");

    expect(res.status).toBe(404);
  });

  it("serves the file when the requesting session token owns the conversation", async () => {
    mockedPhotoFindUnique.mockResolvedValue({
      id: "photo-1",
      filePath: testFilePath,
      conversationId: "conv-1",
    } as never);
    mockedConversationFindUnique.mockResolvedValue(FAKE_CONVERSATION as never);

    const res = await request(createApp()).get("/api/v1/uploads/photo-1").set("X-Session-Token", "session-abc");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
  });

  it("serves the file for a valid admin token regardless of session ownership", async () => {
    mockedPhotoFindUnique.mockResolvedValue({
      id: "photo-1",
      filePath: testFilePath,
      conversationId: "conv-1",
    } as never);
    const adminToken = signAdminToken({ sub: "admin-1", email: "admin@oopssnails.local" });

    const res = await request(createApp())
      .get("/api/v1/uploads/photo-1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});
