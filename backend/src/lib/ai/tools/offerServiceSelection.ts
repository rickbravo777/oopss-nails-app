import { prisma } from "../../prisma";
import type { ToolDefinition } from "../types";

interface OfferServiceSelectionArgs {
  categories?: string[];
  serviceName?: string;
}

// A near-signal-only tool: its only real effect is validating the optional `categories`/
// `serviceName` hints against the real catalog (never trust the model's own idea of what
// exists), but its purpose is to tell the frontend to render the click-only booking selector
// inline in the chat (ChatPage.tsx checks each assistant message's toolCallMeta for this tool
// name). This lets the client tap through the same booking flow the welcome screen and the
// "📅 Agendar cita" modal already use, instead of typing a service name or her contact details.
export const offerServiceSelectionTool: ToolDefinition<OfferServiceSelectionArgs> = {
  name: "offer_service_selection",
  description:
    "Muestra a la clienta un selector visual para agendar, tocando en vez de escribir. Llama a esta herramienta " +
    "SIEMPRE que la clienta exprese intención de agendar o de ver servicios (ej. \"quiero una cita\", \"quiero " +
    "agendar\", \"quiero hacerme las uñas\", o \"sí, creemos la cita\" después de haber aclarado dudas sobre un " +
    "servicio específico) — esto es una llamada de función real (tool call), NO basta con escribir en tu respuesta " +
    "de texto algo como \"aquí tienes nuestros servicios\" o pedirle día/hora/nombre/teléfono en prosa sin invocar " +
    "la función; si no invocas la función, la clienta no verá ningún selector y tu mensaje quedará incompleto. " +
    "Si la clienta YA confirmó el servicio exacto que quiere (se lo devolviste vía get_service_info y ella expresó " +
    "que quiere agendarlo), pasa ese nombre exacto en `serviceName` — esto la lleva directo al paso de elegir " +
    "especialista, fecha y hora para ESE servicio, saltando por completo el selector de categoría/servicio. Si en " +
    "cambio la clienta expresó intención de agendar sin haber precisado el servicio todavía, pero lo que dijo ya " +
    "deja clara la categoría (ej. \"las uñas\"/\"uñas de manos y pies\" → categories: [\"Manos\",\"Pies\"]; \"el " +
    "cabello\" → [\"Cabello\"]; \"las cejas\" → [\"Cejas\"]), pasa esas categorías en `categories` para que el " +
    "selector arranque ya filtrado en vez de mostrar las 10 categorías completas. Si no sabes ni el servicio ni la " +
    "categoría, omite ambos parámetros y se mostrará el selector completo. Nunca uses ambos parámetros a la vez.",
  parameters: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: { type: "string" },
        description: "Nombres exactos de categoría(s) del catálogo ya implícitas en lo que dijo la clienta, si aplica.",
      },
      serviceName: {
        type: "string",
        description:
          "Nombre EXACTO (tal cual lo devolvió get_service_info) del servicio que la clienta ya confirmó querer agendar.",
      },
    },
  },
  handler: async ({ categories, serviceName }) => {
    if (serviceName) {
      // Defensive, same principle as every other tool: never trust the model's own idea of the
      // service name — only pass through a real, active service the client can actually book.
      const service = await prisma.service.findFirst({
        where: { active: true, name: { equals: serviceName, mode: "insensitive" } },
        select: { id: true, name: true },
      });
      if (service) return { shown: true, serviceId: service.id, serviceName: service.name };
      // Falls through to the categories/plain-signal path below if the name didn't resolve —
      // better to show the client a working selector than nothing at all.
    }

    if (!categories || categories.length === 0) return { shown: true };
    const real = await prisma.serviceCategory.findMany({ where: { name: { in: categories } }, select: { name: true } });
    const validNames = real.map((c) => c.name);
    return { shown: true, categories: validNames.length > 0 ? validNames : undefined };
  },
};
