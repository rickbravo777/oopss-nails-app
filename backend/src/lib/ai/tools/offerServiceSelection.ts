import { prisma } from "../../prisma";
import type { ToolDefinition } from "../types";

interface OfferServiceSelectionArgs {
  categories?: string[];
}

// A near-signal-only tool: its only real effect is validating the optional `categories` hint
// against the real catalog (never trust the model's own idea of what categories exist), but
// its purpose is to tell the frontend to render the click-only category → servicio selector
// inline in the chat (ChatPage.tsx checks each assistant message's toolCallMeta for this tool
// name). This lets the client tap through the same booking flow the welcome screen and the
// "📅 Agendar cita" modal already use, instead of having to type a service name.
export const offerServiceSelectionTool: ToolDefinition<OfferServiceSelectionArgs> = {
  name: "offer_service_selection",
  description:
    "Muestra a la clienta un selector visual (categoría → servicio) para que elija tocando, en vez de escribir el " +
    "nombre del servicio. Llama a esta herramienta SIEMPRE que la clienta exprese intención de agendar o de ver " +
    "servicios sin haber indicado ya un servicio específico (ej. \"quiero una cita\", \"quiero agendar\", \"quiero " +
    "hacerme las uñas\" sin precisar cuál). NO la llames si la clienta ya especificó el servicio exacto que quiere. " +
    "Si lo que dijo la clienta ya deja claro a qué categoría(s) del catálogo pertenece (aunque no sepa el servicio " +
    "exacto todavía), pasa esas categorías en `categories` para que el selector arranque ya filtrado, en vez de " +
    "mostrarle las 10 categorías completas del salón — por ejemplo \"las uñas\"/\"uñas de manos y pies\" sin más " +
    "detalle → [\"Manos\",\"Pies\"]; \"el cabello\"/\"el pelo\" → [\"Cabello\"]; \"las cejas\" → [\"Cejas\"]. Si no " +
    "tienes forma de saber la categoría (la clienta solo dijo algo genérico como \"quiero una cita\"), omite este " +
    "parámetro y se mostrarán todas.",
  parameters: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: { type: "string" },
        description: "Nombres exactos de categoría(s) del catálogo ya implícitas en lo que dijo la clienta, si aplica.",
      },
    },
  },
  handler: async ({ categories }) => {
    if (!categories || categories.length === 0) return { shown: true };
    // Defensive: only pass through categories that actually exist — never trust the model's
    // own idea of category names, the same principle already applied to prices/availability.
    const real = await prisma.serviceCategory.findMany({ where: { name: { in: categories } }, select: { name: true } });
    const validNames = real.map((c) => c.name);
    return { shown: true, categories: validNames.length > 0 ? validNames : undefined };
  },
};
