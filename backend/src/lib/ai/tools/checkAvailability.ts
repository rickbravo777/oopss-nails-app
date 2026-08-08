import { checkAvailability } from "../../availability";
import { prisma } from "../../prisma";
import type { ToolDefinition } from "../types";

interface CheckAvailabilityArgs {
  serviceNames: string[];
  specialistName?: string;
  dateFrom: string;
  dateTo: string;
}

export const checkAvailabilityTool: ToolDefinition<CheckAvailabilityArgs> = {
  name: "check_availability",
  description:
    "Consulta horarios reales disponibles para uno o más servicios (por nombre exacto del catálogo) en un rango de fechas. " +
    "Úsalo siempre antes de ofrecer un horario a la clienta — nunca inventes disponibilidad.",
  parameters: {
    type: "object",
    properties: {
      serviceNames: {
        type: "array",
        items: { type: "string" },
        description: "Nombres exactos de los servicios (del catálogo real) que la clienta quiere agendar",
      },
      specialistName: {
        type: "string",
        description: "Nombre de la especialista preferida, si la clienta indicó una. Omitir si no tiene preferencia.",
      },
      dateFrom: { type: "string", description: "Fecha de inicio del rango a consultar, formato YYYY-MM-DD" },
      dateTo: { type: "string", description: "Fecha final del rango a consultar, formato YYYY-MM-DD" },
    },
    required: ["serviceNames", "dateFrom", "dateTo"],
  },
  handler: async ({ serviceNames, specialistName, dateFrom, dateTo }) => {
    const services = await prisma.service.findMany({ where: { name: { in: serviceNames }, active: true } });
    const missing = serviceNames.filter((n) => !services.some((s) => s.name === n));
    if (missing.length > 0) {
      return { found: false, message: `No se encontraron estos servicios en el catálogo: ${missing.join(", ")}` };
    }

    let specialistId: string | undefined;
    if (specialistName) {
      const specialist = await prisma.specialist.findUnique({ where: { name: specialistName } });
      if (!specialist) {
        return { found: false, message: `No se encontró una especialista llamada "${specialistName}".` };
      }
      specialistId = specialist.id;
    }

    const slots = await checkAvailability({
      serviceIds: services.map((s) => s.id),
      specialistId,
      dateFrom,
      dateTo,
    });

    if (slots.length === 0) {
      return { found: false, message: "No hay horarios disponibles para esa combinación de servicio(s) y fechas." };
    }

    // Cap what's sent back to the model — it only needs enough options to offer the client,
    // not every 30-minute slot across two weeks.
    return { found: true, slots: slots.slice(0, 15) };
  },
};
