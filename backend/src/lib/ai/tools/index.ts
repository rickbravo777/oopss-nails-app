import type { ToolDefinition } from "../types";
import { checkAvailabilityTool } from "./checkAvailability";
import { createAppointmentTool } from "./createAppointment";
import { getServiceInfoTool } from "./getServiceInfo";
import { offerServiceSelectionTool } from "./offerServiceSelection";

export { createEscalateToHumanTool } from "./escalateToHuman";

// Stateless tools, safe to share across all conversations. escalate_to_human is NOT here —
// it needs to know which conversation it's escalating, so it's built per-request via
// createEscalateToHumanTool(conversationId) in src/routes/chat.ts instead.
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  getServiceInfoTool,
  checkAvailabilityTool,
  createAppointmentTool,
  offerServiceSelectionTool,
] as unknown as ToolDefinition[];
