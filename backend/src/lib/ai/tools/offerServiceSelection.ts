import type { ToolDefinition } from "../types";

// A signal-only tool: it has no real side effect (the handler just acknowledges), but calling
// it is what tells the frontend to render the click-only category → servicio selector inline
// in the chat (ChatPage.tsx checks each assistant message's toolCallMeta for this tool name).
// This lets the client tap through the same booking flow the welcome screen and the "📅
// Agendar cita" modal already use, instead of having to type a service name.
export const offerServiceSelectionTool: ToolDefinition = {
  name: "offer_service_selection",
  description:
    "Muestra a la clienta un selector visual (categoría → servicio) para que elija tocando, en vez de escribir el " +
    "nombre del servicio. Llama a esta herramienta SIEMPRE que la clienta exprese intención de agendar o de ver " +
    "servicios sin haber indicado ya un servicio específico (ej. \"quiero una cita\", \"quiero agendar\", \"quiero " +
    "hacerme las uñas\" sin precisar cuál). NO la llames si la clienta ya especificó el servicio exacto que quiere.",
  parameters: { type: "object", properties: {} },
  handler: async () => ({ shown: true }),
};
