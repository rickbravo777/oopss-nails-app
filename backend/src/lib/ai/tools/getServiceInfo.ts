import { prisma } from "../../prisma";
import type { ToolDefinition } from "../types";

interface GetServiceInfoArgs {
  query: string;
}

// Common short Spanish words that carry no search meaning on their own — stripped so a
// natural-language question ("como es eso de extension en polygel") doesn't dilute matching
// with noise words the client didn't mean as part of the service name.
const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en", "y", "o", "u",
  "que", "es", "eso", "esa", "ese", "como", "con", "para", "por", "se", "me", "te", "mi", "tu",
  "al", "lo", "le", "les", "su", "sus", "hay", "tiene", "tienen", "hace", "hacen",
]);

function normalize(text: string): string {
  // NFD + strip combining diacritical marks — makes "extension" match "Extensión" regardless
  // of whether the client typed the accent, which a plain case-insensitive `contains` won't do
  // (Postgres string matching is accent-sensitive by default).
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function significantWords(query: string): string[] {
  return normalize(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

export const getServiceInfoTool: ToolDefinition<GetServiceInfoArgs> = {
  name: "get_service_info",
  description:
    "Busca servicios en el catálogo real del salón por nombre o palabra clave de categoría, " +
    "incluyendo qué especialistas realizan cada uno. Úsalo siempre que la clienta pregunte por " +
    "un servicio, un precio, o quién lo hace — nunca respondas de memoria.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Nombre del servicio o palabra clave, ej. 'manicure gel' o 'balayage'",
      },
    },
    required: ["query"],
  },
  handler: async ({ query }) => {
    const words = significantWords(query);
    if (words.length === 0) {
      return { found: false, message: "No se encontró ningún servicio que coincida con esa búsqueda." };
    }

    const services = await prisma.service.findMany({
      where: { active: true },
      include: {
        category: { select: { name: true } },
        specialists: { include: { specialist: { select: { name: true } } } },
      },
    });

    // Every significant word from the query must appear somewhere in the service's name or
    // category (in any order, accent/case-insensitive) — a looser match than the old exact
    // substring-of-the-whole-phrase check, so a client's own phrasing ("extension en polygel")
    // still finds the real service ("Extensión Polygel") even with an inserted word or a
    // missing accent, without over-matching on a single common word alone.
    const matches = services.filter((s) => {
      const haystack = normalize(`${s.name} ${s.category.name}`);
      return words.every((word) => haystack.includes(word));
    });

    if (matches.length === 0) {
      return { found: false, message: "No se encontró ningún servicio que coincida con esa búsqueda." };
    }

    return {
      found: true,
      services: matches.slice(0, 10).map((s) => ({
        name: s.name,
        category: s.category.name,
        priceType: s.priceType,
        price: s.price,
        priceMax: s.priceMax,
        currency: s.currency,
        defaultDurationMinutes: s.defaultDurationMinutes,
        requiresConsultation: s.requiresConsultation,
        requiresPhoto: s.requiresPhoto,
        specialists: s.specialists.map((ss) => ss.specialist.name),
      })),
    };
  },
};
