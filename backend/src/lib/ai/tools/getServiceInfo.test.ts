import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../prisma";

vi.mock("../../prisma", () => ({
  prisma: { service: { findMany: vi.fn() } },
}));

const { getServiceInfoTool } = await import("./getServiceInfo");
const mockedFindMany = vi.mocked(prisma.service.findMany);

const MANICURE_GEL = {
  id: "svc-manicure-gel",
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
};

const EXTENSION_POLYGEL = {
  id: "svc-extension-polygel",
  name: "Extensión Polygel",
  priceType: "fixed",
  price: 49,
  priceMax: null,
  currency: "USD",
  defaultDurationMinutes: 90,
  requiresConsultation: false,
  requiresPhoto: false,
  category: { name: "Manos" },
  specialists: [{ specialist: { name: "Tania" } }],
};

describe("getServiceInfoTool", () => {
  beforeEach(() => {
    mockedFindMany.mockReset();
  });

  it("returns matching services from the real catalog, not a hallucinated answer", async () => {
    mockedFindMany.mockResolvedValue([MANICURE_GEL] as never);

    const result = await getServiceInfoTool.handler({ query: "manicure gel" });

    expect(result).toEqual({
      found: true,
      services: [
        {
          id: "svc-manicure-gel",
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
    mockedFindMany.mockResolvedValue([MANICURE_GEL, EXTENSION_POLYGEL] as never);

    const result = await getServiceInfoTool.handler({ query: "servicio inexistente" });

    expect(result).toEqual({
      found: false,
      message: "No se encontró ningún servicio que coincida con esa búsqueda.",
    });
  });

  it("finds a real service even when the client's phrasing inserts an extra word and drops the accent", async () => {
    // Real client input that used to fail: literal-substring matching couldn't find "Extensión
    // Polygel" from "extension en polygel" (missing accent + an inserted "en").
    mockedFindMany.mockResolvedValue([MANICURE_GEL, EXTENSION_POLYGEL] as never);

    const result = await getServiceInfoTool.handler({ query: "como es eso de extension en polygel" });

    expect(result.found).toBe(true);
    expect((result as { services: { name: string }[] }).services.map((s) => s.name)).toEqual(["Extensión Polygel"]);
  });

  it("matches regardless of accents on either side (query accented, name isn't, or vice versa)", async () => {
    mockedFindMany.mockResolvedValue([MANICURE_GEL, EXTENSION_POLYGEL] as never);

    const result = await getServiceInfoTool.handler({ query: "extensión polygel" });

    expect(result.found).toBe(true);
    expect((result as { services: { name: string }[] }).services.map((s) => s.name)).toEqual(["Extensión Polygel"]);
  });

  it("requires every significant word to match, not just one — a single common word shouldn't over-match", async () => {
    mockedFindMany.mockResolvedValue([MANICURE_GEL, EXTENSION_POLYGEL] as never);

    // "manos" alone (the category both share) would match both if word-matching used OR
    // instead of AND — with a second, service-specific word it should narrow to one.
    const result = await getServiceInfoTool.handler({ query: "manos manicure" });

    expect(result.found).toBe(true);
    expect((result as { services: { name: string }[] }).services.map((s) => s.name)).toEqual(["Manicure Gel"]);
  });

  it("reports not found when the query is only stopwords, without even querying the DB", async () => {
    const result = await getServiceInfoTool.handler({ query: "de la el" });

    expect(result).toEqual({
      found: false,
      message: "No se encontró ningún servicio que coincida con esa búsqueda.",
    });
    expect(mockedFindMany).not.toHaveBeenCalled();
  });
});
