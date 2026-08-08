import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ApiError } from "../../lib/apiClient";
import { fetchConversation } from "../../lib/api/admin/conversations";
import { fetchEscalations, resolveEscalation } from "../../lib/api/admin/escalations";

const ROLE_LABELS: Record<string, string> = {
  user: "Clienta",
  assistant: "Asistente",
  system: "Sistema",
  human_agent: "Especialista",
};

const REASON_LABELS: Record<string, string> = {
  facial_recommendation: "Recomendación facial",
  laser_zone_confirmation: "Confirmación de zona láser",
  hair_desde_pricing: "Precio de cabello 'desde'",
  ai_uncertain: "Asistente sin certeza",
  client_requested_human: "Clienta pidió hablar con una persona",
};

export function EscalationsAdminPage() {
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open");
  const escalationsQuery = useQuery({
    queryKey: ["admin", "escalations", statusFilter],
    queryFn: () => fetchEscalations(statusFilter),
  });

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [viewingConversationId, setViewingConversationId] = useState<string | null>(null);
  const conversationQuery = useQuery({
    queryKey: ["admin", "conversations", viewingConversationId],
    queryFn: () => fetchConversation(viewingConversationId!),
    enabled: Boolean(viewingConversationId),
  });

  function openResolve(id: string) {
    setResolvingId(id);
    setNotes("");
    setError(null);
  }

  async function handleResolve(id: string) {
    setError(null);
    setSaving(true);
    try {
      await resolveEscalation(id, notes || undefined);
      setResolvingId(null);
      await escalationsQuery.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo resolver el escalamiento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
        Escalamientos
      </h1>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("open")}
          className="rounded-full px-3 py-1.5 text-sm"
          style={{
            backgroundColor: statusFilter === "open" ? "var(--color-primary)" : "transparent",
            color: statusFilter === "open" ? "white" : "var(--color-text)",
            border: "1px solid rgb(var(--color-border) / var(--color-border-alpha))",
          }}
        >
          Abiertos
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("resolved")}
          className="rounded-full px-3 py-1.5 text-sm"
          style={{
            backgroundColor: statusFilter === "resolved" ? "var(--color-primary)" : "transparent",
            color: statusFilter === "resolved" ? "white" : "var(--color-text)",
            border: "1px solid rgb(var(--color-border) / var(--color-border-alpha))",
          }}
        >
          Resueltos
        </button>
      </div>

      {escalationsQuery.isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}
      {escalationsQuery.data?.escalations.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No hay escalamientos {statusFilter === "open" ? "abiertos" : "resueltos"}.
        </p>
      )}

      {escalationsQuery.data?.escalations.map((esc) => (
        <Card key={esc.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium" style={{ color: "var(--color-text)" }}>
                {REASON_LABELS[esc.reason] ?? esc.reason}
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {esc.client ? `${esc.client.name} (${esc.client.phone})` : "Cliente sin identificar"}
                {esc.assignedSpecialist && ` · asignado a ${esc.assignedSpecialist.name}`}
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {new Date(esc.createdAt).toLocaleString("es")}
                {esc.resolutionNotes && ` · nota: ${esc.resolutionNotes}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setViewingConversationId(viewingConversationId === esc.conversationId ? null : esc.conversationId)}
              >
                {viewingConversationId === esc.conversationId ? "Ocultar conversación" : "Ver conversación"}
              </Button>
              {esc.status === "open" && resolvingId !== esc.id && (
                <Button variant="secondary" onClick={() => openResolve(esc.id)}>
                  Marcar resuelto
                </Button>
              )}
            </div>
          </div>

          {viewingConversationId === esc.conversationId && (
            <div className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}>
              {conversationQuery.isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando conversación…</p>}
              {conversationQuery.isError && (
                <p className="text-sm" style={{ color: "var(--color-error)" }}>
                  No se pudo cargar la conversación.
                </p>
              )}
              {conversationQuery.data?.messages.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Esta conversación no tiene mensajes.
                </p>
              )}
              {conversationQuery.data?.messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="font-medium" style={{ color: "var(--color-text)" }}>
                    {ROLE_LABELS[msg.role] ?? msg.role}:
                  </span>{" "}
                  <span style={{ color: "var(--color-text-muted)" }}>{msg.content}</span>
                </div>
              ))}
            </div>
          )}

          {resolvingId === esc.id && (
            <div className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}>
              <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                Notas de resolución (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
              />
              {error && (
                <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={() => handleResolve(esc.id)} disabled={saving}>
                  {saving ? "Guardando..." : "Confirmar resolución"}
                </Button>
                <Button variant="secondary" onClick={() => setResolvingId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
