import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Card } from "../../components/ui/Card";
import { fetchDashboardHealth } from "../../lib/api/admin/dashboard";

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Por confirmar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No se presentó",
};

function HealthBadge({ ok, okLabel, errorLabel }: { ok: boolean; okLabel: string; errorLabel: string }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: ok ? "var(--color-success, #16a34a)" : "var(--color-error)",
        color: "white",
      }}
    >
      {ok ? okLabel : errorLabel}
    </span>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "dashboard", "health"],
    queryFn: fetchDashboardHealth,
    refetchInterval: 30000,
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
        Dashboard
      </h1>

      {isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}
      {isError && <p style={{ color: "var(--color-error)" }}>No se pudo cargar el estado del sistema.</p>}

      {data && (
        <>
          <Card>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Salud del sistema
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Base de datos
                </span>
                <HealthBadge ok={data.db === "ok"} okLabel="OK" errorLabel="Error" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  OpenAI
                </span>
                <HealthBadge ok={data.openai === "ok"} okLabel="Configurado" errorLabel="No configurado" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Disco (uploads)
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {data.diskUsagePercent !== null ? `${data.diskUsagePercent}%` : "N/D"}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Escalamientos abiertos
              </h2>
              <Link to="/admin/escalamientos" className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                Ver todos →
              </Link>
            </div>
            <p className="text-2xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
              {data.openEscalationsCount}
            </p>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Citas de hoy ({data.todayAppointments.length})
              </h2>
              <Link to="/admin/citas" className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                Ver todas →
              </Link>
            </div>
            {data.todayAppointments.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No hay citas agendadas para hoy.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.todayAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}
                  >
                    <span className="font-medium" style={{ color: "var(--color-text)" }}>
                      {appt.startTime} — {appt.clientName}
                    </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {appt.services.join(", ")} · {appt.specialist.name}
                    </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {STATUS_LABELS[appt.status] ?? appt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {data.recentErrors.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Errores recientes
              </h2>
              <div className="flex flex-col gap-2">
                {data.recentErrors.map((err) => (
                  <div key={err.id} className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    <span className="font-medium">{err.source}</span> — {err.message}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
