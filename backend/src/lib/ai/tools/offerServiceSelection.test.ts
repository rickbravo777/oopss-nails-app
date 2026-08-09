import { describe, expect, it, vi } from "vitest";

import { prisma } from "../../prisma";

vi.mock("../../prisma", () => ({
  prisma: { serviceCategory: { findMany: vi.fn() } },
}));

const { offerServiceSelectionTool } = await import("./offerServiceSelection");
const mockedFindMany = vi.mocked(prisma.serviceCategory.findMany);

describe("offerServiceSelectionTool", () => {
  it("has the expected name and an optional categories parameter", () => {
    expect(offerServiceSelectionTool.name).toBe("offer_service_selection");
    expect(offerServiceSelectionTool.parameters).toEqual({
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: { type: "string" },
          description: expect.any(String),
        },
      },
    });
  });

  it("with no categories, is a pure signal — no side effect, no DB lookup", async () => {
    const result = await offerServiceSelectionTool.handler({});
    expect(result).toEqual({ shown: true });
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it("with real categories, passes through only the validated names — never a hallucinated one", async () => {
    mockedFindMany.mockResolvedValue([{ name: "Manos" }] as never);

    const result = await offerServiceSelectionTool.handler({ categories: ["Manos", "Categoría Inventada"] });

    expect(result).toEqual({ shown: true, categories: ["Manos"] });
  });

  it("falls back to showing everything if none of the given categories are real", async () => {
    mockedFindMany.mockResolvedValue([]);

    const result = await offerServiceSelectionTool.handler({ categories: ["Categoría Que No Existe"] });

    expect(result).toEqual({ shown: true, categories: undefined });
  });
});
