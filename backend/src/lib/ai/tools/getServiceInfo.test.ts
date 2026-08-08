import { describe, expect, it, vi } from "vitest";

import { prisma } from "../../prisma";

vi.mock("../../prisma", () => ({
  prisma: { service: { findMany: vi.fn() } },
}));

const { getServiceInfoTool } = await import("./getServiceInfo");
const mockedFindMany = vi.mocked(prisma.service.findMany);

describe("getServiceInfoTool", () => {
  it("returns matching services from the real catalog, not a hallucinated answer", async () => {
    mockedFindMany.mockResolvedValue([
      {
        name: "Manicure Gel",
        priceType: "fixed",
        price: 24,
        priceMax: null,
        currency: "USD",
        defaultDurationMinutes: 60,
        requiresConsultation: false,
        requiresPhoto: false,
        category: { name: "Manos" },
        specialists: [{ specialist: { name: "Tania" } }, { specialist: { name: "Mariangely" } }],
      },
    ] as never);

    const result = await getServiceInfoTool.handler({ query: "manicure gel" });

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          OR: [
            { name: { contains: "manicure gel", mode: "insensitive" } },
            { category: { name: { contains: "manicure gel", mode: "insensitive" } } },
          ],
        }),
      }),
    );
    expect(result).toEqual({
      found: true,
      services: [
        {
          name: "Manicure Gel",
          category: "Manos",
          priceType: "fixed",
          price: 24,
          priceMax: null,
          currency: "USD",
          defaultDurationMinutes: 60,
          requiresConsultation: false,
          requiresPhoto: false,
          specialists: ["Tania", "Mariangely"],
        },
      ],
    });
  });

  it("reports not found instead of guessing when nothing matches", async () => {
    mockedFindMany.mockResolvedValue([]);

    const result = await getServiceInfoTool.handler({ query: "servicio inexistente" });

    expect(result).toEqual({
      found: false,
      message: "No se encontró ningún servicio que coincida con esa búsqueda.",
    });
  });
});
