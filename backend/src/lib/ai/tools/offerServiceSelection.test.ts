import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../prisma";

vi.mock("../../prisma", () => ({
  prisma: { serviceCategory: { findMany: vi.fn() }, service: { findFirst: vi.fn() } },
}));

const { offerServiceSelectionTool } = await import("./offerServiceSelection");
const mockedCategoryFindMany = vi.mocked(prisma.serviceCategory.findMany);
const mockedServiceFindFirst = vi.mocked(prisma.service.findFirst);

describe("offerServiceSelectionTool", () => {
  beforeEach(() => {
    mockedCategoryFindMany.mockReset();
    mockedServiceFindFirst.mockReset();
  });

  it("has the expected name and optional categories/serviceName/confirmFirst parameters", () => {
    expect(offerServiceSelectionTool.name).toBe("offer_service_selection");
    expect(offerServiceSelectionTool.parameters).toEqual({
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: { type: "string" },
          description: expect.any(String),
        },
        serviceName: {
          type: "string",
          description: expect.any(String),
        },
        confirmFirst: {
          type: "boolean",
          description: expect.any(String),
        },
      },
    });
  });

  it("with neither argument, is a pure signal — no side effect, no DB lookup", async () => {
    const result = await offerServiceSelectionTool.handler({});
    expect(result).toEqual({ shown: true });
    expect(mockedCategoryFindMany).not.toHaveBeenCalled();
    expect(mockedServiceFindFirst).not.toHaveBeenCalled();
  });

  it("with real categories, passes through only the validated names — never a hallucinated one", async () => {
    mockedCategoryFindMany.mockResolvedValue([{ name: "Manos" }] as never);

    const result = await offerServiceSelectionTool.handler({ categories: ["Manos", "Categoría Inventada"] });

    expect(result).toEqual({ shown: true, categories: ["Manos"] });
  });

  it("falls back to showing everything if none of the given categories are real", async () => {
    mockedCategoryFindMany.mockResolvedValue([]);

    const result = await offerServiceSelectionTool.handler({ categories: ["Categoría Que No Existe"] });

    expect(result).toEqual({ shown: true, categories: undefined });
  });

  it("with a real, confirmed serviceName, jumps straight to that service's id — no category step at all", async () => {
    mockedServiceFindFirst.mockResolvedValue({ id: "svc-1", name: "Extensión Polygel" } as never);

    const result = await offerServiceSelectionTool.handler({ serviceName: "Extensión Polygel" });

    expect(result).toEqual({ shown: true, serviceId: "svc-1", serviceName: "Extensión Polygel" });
    expect(mockedCategoryFindMany).not.toHaveBeenCalled();
  });

  it("never trusts a hallucinated serviceName — falls back to the plain signal if it doesn't resolve", async () => {
    mockedServiceFindFirst.mockResolvedValue(null);

    const result = await offerServiceSelectionTool.handler({ serviceName: "Servicio Que No Existe" });

    expect(result).toEqual({ shown: true });
  });

  it("with confirmFirst and a real serviceName, flags needsConfirmation so the client sees a Sí/No prompt", async () => {
    mockedServiceFindFirst.mockResolvedValue({ id: "svc-1", name: "Mani Spa (regular)" } as never);

    const result = await offerServiceSelectionTool.handler({ serviceName: "Mani Spa (regular)", confirmFirst: true });

    expect(result).toEqual({
      shown: true,
      serviceId: "svc-1",
      serviceName: "Mani Spa (regular)",
      needsConfirmation: true,
    });
  });

  it("without confirmFirst, never includes needsConfirmation even when the service resolves", async () => {
    mockedServiceFindFirst.mockResolvedValue({ id: "svc-1", name: "Mani Spa (regular)" } as never);

    const result = await offerServiceSelectionTool.handler({ serviceName: "Mani Spa (regular)" });

    expect(result).toEqual({ shown: true, serviceId: "svc-1", serviceName: "Mani Spa (regular)" });
  });
});
