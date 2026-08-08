import { prisma } from "../../prisma";
import type { ToolDefinition } from "../types";

interface EscalateArgs {
  reason: "facial_recommendation" | "laser_zone_confirmation" | "hair_desde_pricing" | "ai_uncertain" | "client_requested_human";
  note?: string;
}

// Sonia handles faciales/estética and depilación láser; Aurora confirms final hair pricing
// for "desde" services — per the salon's source system-prompt document, section 9/11.
const SPECIALIST_BY_REASON: Record<EscalateArgs["reason"], string | undefined> = {
  facial_recommendation: "Sonia",
  laser_zone_confirmation: "Sonia",
  hair_desde_pricing: "Aurora",
  ai_uncertain: undefined,
  client_requested_human: undefined,
};

// Built per-conversation (not a static tool) because the handler needs to know which
// conversation the escalation belongs to — see src/routes/chat.ts.
export function createEscalateToHumanTool(conversationId: string): ToolDefinition<EscalateArgs> {
  return {
    name: "escalate_to_human",
    description:
      "Deriva la conversación a una especialista humana — SOLO cuando hay incertidumbre genuina que get_service_info " +
      "no puede resolver: la clienta no sabe qué tratamiento facial/estético le conviene y quiere que Sonia la " +
      "evalúe, no sabe qué zona de depilación láser le aplica a ELLA específicamente y quiere que Sonia la evalúe, " +
      "el precio final de un servicio de cabello 'desde' cuando la clienta no puede/quiere enviar foto (Aurora), o " +
      "la clienta pide hablar con una persona. NO la uses solo porque la pregunta es sobre un servicio facial, " +
      "láser o de cabello — si la clienta pregunta qué significa un servicio/zona, o cuánto cuesta, responde con " +
      "get_service_info como con cualquier otro servicio; escala solo si después de eso ella sigue sin saber qué " +
      "opción le conviene a su caso particular.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: [
            "facial_recommendation",
            "laser_zone_confirmation",
            "hair_desde_pricing",
            "ai_uncertain",
            "client_requested_human",
          ],
          description: "Motivo del escalamiento",
        },
        note: { type: "string", description: "Breve nota de contexto para la especialista, si aplica" },
      },
      required: ["reason"],
    },
    handler: async ({ reason, note }) => {
      const specialistName = SPECIALIST_BY_REASON[reason];
      const specialist = specialistName ? await prisma.specialist.findUnique({ where: { name: specialistName } }) : null;

      const flag = await prisma.escalationFlag.create({
        data: {
          conversationId,
          reason,
          assignedSpecialistId: specialist?.id,
          resolutionNotes: note,
        },
      });

      await prisma.conversation.update({ where: { id: conversationId }, data: { status: "handed_off" } });

      return {
        escalated: true,
        escalationId: flag.id,
        assignedSpecialist: specialist?.name ?? null,
      };
    },
  };
}
