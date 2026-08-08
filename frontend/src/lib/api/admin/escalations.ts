import { apiFetch } from "../../apiClient";

export interface Escalation {
  id: string;
  conversationId: string;
  reason: string;
  status: "open" | "resolved";
  assignedSpecialist: { id: string; name: string } | null;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  client: { name: string; phone: string } | null;
}

export function fetchEscalations(status?: "open" | "resolved"): Promise<{ escalations: Escalation[] }> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch(`/admin/escalations${qs}`);
}

export function resolveEscalation(id: string, resolutionNotes?: string): Promise<Escalation> {
  return apiFetch(`/admin/escalations/${id}/resolve`, { method: "PUT", body: JSON.stringify({ resolutionNotes }) });
}
