import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/availability", () => ({ checkAvailability: vi.fn() }));

const { createApp } = await import("../app");
const { checkAvailability } = await import("../lib/availability");
const mockedCheck = vi.mocked(checkAvailability);

describe("POST /api/v1/availability/check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is public and returns slots for a valid request", async () => {
    mockedCheck.mockResolvedValue([
      { specialistId: "sp-1", specialistName: "Tania", date: "2026-08-03", startTime: "09:00", endTime: "10:15" },
    ]);

    const res = await request(createApp())
      .post("/api/v1/availability/check")
      .send({ serviceIds: ["11111111-1111-1111-1111-111111111111"], dateFrom: "2026-08-03", dateTo: "2026-08-03" });

    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(1);
  });

  it("rejects a request with no serviceIds", async () => {
    const res = await request(createApp())
      .post("/api/v1/availability/check")
      .send({ serviceIds: [], dateFrom: "2026-08-03", dateTo: "2026-08-03" });

    expect(res.status).toBe(400);
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it("rejects dateTo before dateFrom", async () => {
    const res = await request(createApp())
      .post("/api/v1/availability/check")
      .send({
        serviceIds: ["11111111-1111-1111-1111-111111111111"],
        dateFrom: "2026-08-10",
        dateTo: "2026-08-03",
      });

    expect(res.status).toBe(400);
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it("returns a 400 (not 500) when a requested service doesn't exist", async () => {
    mockedCheck.mockRejectedValue(new Error("Uno o más servicios no existen o no están activos"));

    const res = await request(createApp())
      .post("/api/v1/availability/check")
      .send({ serviceIds: ["11111111-1111-1111-1111-111111111111"], dateFrom: "2026-08-03", dateTo: "2026-08-03" });

    expect(res.status).toBe(400);
  });
});
