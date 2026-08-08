import { prisma } from "../../prisma";
import type { ToolDefinition } from "../types";

interface GetServiceInfoArgs {
  query: string;
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
    const services = await prisma.service.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: {
        category: { select: { name: true } },
        specialists: { include: { specialist: { select: { name: true } } } },
      },
      take: 10,
    });

    if (services.length === 0) {
      return { found: false, message: "No se encontró ningún servicio que coincida con esa búsqueda." };
    }

    return {
      found: true,
      services: services.map((s) => ({
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
