import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { CalendarDayView } from "../../components/admin/CalendarDayView";
import { CalendarWeekView } from "../../components/admin/CalendarWeekView";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ApiError } from "../../lib/apiClient";
import { type AdminAppointment, fetchAdminAppointments, updateAdminAppointment } from "../../lib/api/admin/appointments";
import { fetchSpecialists } from "../../lib/api/admin/specialists";
import { addDays, mondayOf, toISODate } from "../../lib/calendarDates";
import { getSpecialistColor } from "../../lib/specialistColors";

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Pendiente de confirmación",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
};

type ViewMode = "semana" | "dia" | "lista";

interface EditState {
  date: string;
  startTime: string;
  status: string;
  notes: string;
}

function AppointmentEditModal({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: AdminAppointment;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const [edit, setEdit] = useState<EditState>({
    date: appointment.date,
    startTime: appointment.startTime,
    status: appointment.status,
    notes: appointment.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const input: { date?: string; startTime?: string; status?: string; notes?: string } = {};
      if (edit.date !== appointment.date || edit.startTime !== appointment.startTime) {
        input.date = edit.date;
        input.startTime = edit.startTime;
      }
      if (edit.status !== appointment.status) input.status = edit.status;
      if (edit.notes !== (appointment.notes ?? "")) input.notes = edit.notes;

      await updateAdminAppointment(appointment.id, input);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la cita");
    } finally {
      setSaving(false);
    }
  }

  // A dedicated one-click cancel, separate from "Guardar" — picking "Cancelada" from the
  // Estado dropdown and then having to also hit "Guardar" was easy to miss (a real client
  // clicked what they assumed was a cancel button and nothing happened, since it was actually
  // the dialog's dismiss button). Cancels immediately with the appointment's current date/time,
  // ignoring any unsaved date/time edits in the form — cancelling shouldn't also silently
  // apply an unrelated reschedule.
  async function handleCancelAppointment() {
    setError(null);
    setSaving(true);
    try {
      await updateAdminAppointment(appointment.id, { status: "cancelled" });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar la cita");
    } finally {
      setSaving(false);
    }
  }

  const isActive = appointment.status !== "cancelled" && appointment.status !== "completed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card>
          <h2 className="mb-1 font-medium" style={{ color: "var(--color-text)" }}>
            {appointment.client.name} ({appointment.client.phone})
          </h2>
          <p className="mb-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {appointment.specialist.name} · {appointment.services.map((s) => s.name).join(", ")} · código{" "}
            {appointment.confirmationCode}
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Input
                label="Fecha"
                name="editDate"
                type="date"
                value={edit.date}
                onChange={(e) => setEdit({ ...edit, date: e.target.value })}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Hora
                </label>
                <input
                  type="time"
                  value={edit.startTime}
                  onChange={(e) => setEdit({ ...edit, startTime: e.target.value })}
                  className="rounded-lg border bg-transparent px-2 py-2 text-sm"
                  style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Estado
                </label>
                <select
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: "rgb(var(--color-border) / var(--color-border-alpha))",
                    color: "var(--color-text)",
                    // The dropdown's own popup is rendered by the browser, not this component
                    // — without an explicit (non-transparent) background here, it defaulted to
                    // white, making light-on-dark-theme text on every unselected option
                    // unreadable. A solid background fixes it in both themes.
                    backgroundColor: "rgb(var(--color-surface))",
                  }}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Input label="Notas" name="editNotes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            {error && (
              <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
                {error}
              </p>
            )}

            {confirmingCancel ? (
              <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}>
                <p className="text-sm" style={{ color: "var(--color-text)" }}>
                  ¿Seguro que deseas cancelar esta cita?
                </p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleCancelAppointment} disabled={saving}>
                    {saving ? "Cancelando..." : "Sí, cancelar"}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingCancel(false)} disabled={saving}>
                    Volver
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                {isActive && (
                  <Button variant="destructive" onClick={() => setConfirmingCancel(true)} disabled={saving}>
                    Cancelar cita
                  </Button>
                )}
                <Button variant="secondary" onClick={onClose} disabled={saving}>
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function AppointmentsAdminPage() {
  const [view, setView] = useState<ViewMode>("semana");
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));

  // List-view-only filters — kept separate from the calendar views' own date navigation.
  const [listDate, setListDate] = useState("");
  const [listSpecialistId, setListSpecialistId] = useState("");
  const [listStatus, setListStatus] = useState("");

  const specialistsQuery = useQuery({ queryKey: ["admin", "specialists"], queryFn: fetchSpecialists });

  const weekEnd = addDays(weekStart, 5);
  const weekQuery = useQuery({
    queryKey: ["admin", "appointments", "week", toISODate(weekStart)],
    queryFn: () => fetchAdminAppointments({ dateFrom: toISODate(weekStart), dateTo: toISODate(weekEnd) }),
    enabled: view === "semana",
  });
  const dayQuery = useQuery({
    queryKey: ["admin", "appointments", "day", selectedDate],
    queryFn: () => fetchAdminAppointments({ date: selectedDate }),
    enabled: view === "dia",
  });
  const listQuery = useQuery({
    queryKey: ["admin", "appointments", "list", listDate, listSpecialistId, listStatus],
    queryFn: () =>
      fetchAdminAppointments({
        date: listDate || undefined,
        specialistId: listSpecialistId || undefined,
        status: listStatus || undefined,
      }),
    enabled: view === "lista",
  });

  const [editingAppt, setEditingAppt] = useState<AdminAppointment | null>(null);

  const activeQuery = view === "semana" ? weekQuery : view === "dia" ? dayQuery : listQuery;

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
          Citas
        </h1>
        <div className="flex gap-2">
          {(["semana", "dia", "lista"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="rounded-full px-3 py-1.5 text-sm"
              style={{
                backgroundColor: view === v ? "var(--color-primary)" : "transparent",
                color: view === v ? "white" : "var(--color-text)",
                border: "1px solid rgb(var(--color-border) / var(--color-border-alpha))",
              }}
            >
              {v === "semana" ? "Semana" : v === "dia" ? "Día por especialista" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {(view === "semana" || view === "dia") && specialistsQuery.isError && (
        <div className="flex items-center gap-3">
          <p className="text-sm" style={{ color: "var(--color-error)" }}>
            No se pudo cargar la lista de especialistas.
          </p>
          <Button variant="secondary" onClick={() => specialistsQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {(view === "semana" || view === "dia") && specialistsQuery.data && (
        <div className="flex flex-wrap gap-3">
          {specialistsQuery.data.specialists
            .filter((s) => s.active)
            .map((s) => {
              const color = getSpecialistColor(s.id);
              return (
                <span key={s.id} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.base }} />
                  {s.name}
                </span>
              );
            })}
        </div>
      )}

      {view === "semana" && (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                ← Semana anterior
              </Button>
              <Button variant="secondary" onClick={() => setWeekStart(mondayOf(new Date()))}>
                Hoy
              </Button>
              <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Semana siguiente →
              </Button>
            </div>
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {toISODate(weekStart)} — {toISODate(weekEnd)}
            </span>
          </div>
          {weekQuery.isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}
          {weekQuery.isError && (
            <div className="flex items-center gap-3">
              <p className="text-sm" style={{ color: "var(--color-error)" }}>
                No se pudieron cargar las citas.
              </p>
              <Button variant="secondary" onClick={() => weekQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {weekQuery.data && (
            <CalendarWeekView weekStart={weekStart} appointments={weekQuery.data.appointments} onSelectAppointment={setEditingAppt} />
          )}
        </Card>
      )}

      {view === "dia" && (
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setSelectedDate(toISODate(addDays(new Date(`${selectedDate}T00:00:00`), -1)))}
            >
              ← Día anterior
            </Button>
            <Button variant="secondary" onClick={() => setSelectedDate(toISODate(new Date()))}>
              Hoy
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelectedDate(toISODate(addDays(new Date(`${selectedDate}T00:00:00`), 1)))}
            >
              Día siguiente →
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border bg-transparent px-2 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
            />
          </div>
          {dayQuery.isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}
          {dayQuery.isError && (
            <div className="flex items-center gap-3">
              <p className="text-sm" style={{ color: "var(--color-error)" }}>
                No se pudieron cargar las citas.
              </p>
              <Button variant="secondary" onClick={() => dayQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {dayQuery.data && specialistsQuery.data && (
            <CalendarDayView
              specialists={specialistsQuery.data.specialists}
              appointments={dayQuery.data.appointments}
              onSelectAppointment={setEditingAppt}
            />
          )}
        </Card>
      )}

      {view === "lista" && (
        <>
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <Input label="Fecha" name="filterDate" type="date" value={listDate} onChange={(e) => setListDate(e.target.value)} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Especialista
                </label>
                <select
                  value={listSpecialistId}
                  onChange={(e) => setListSpecialistId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: "rgb(var(--color-border) / var(--color-border-alpha))",
                    color: "var(--color-text)",
                    backgroundColor: "rgb(var(--color-surface))",
                  }}
                >
                  <option value="">Todos</option>
                  {specialistsQuery.data?.specialists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Estado
                </label>
                <select
                  value={listStatus}
                  onChange={(e) => setListStatus(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: "rgb(var(--color-border) / var(--color-border-alpha))",
                    color: "var(--color-text)",
                    backgroundColor: "rgb(var(--color-surface))",
                  }}
                >
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {listQuery.isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}
          {listQuery.isError && (
            <div className="flex items-center gap-3">
              <p className="text-sm" style={{ color: "var(--color-error)" }}>
                No se pudieron cargar las citas.
              </p>
              <Button variant="secondary" onClick={() => listQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {listQuery.data?.appointments.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              No hay citas que coincidan con los filtros.
            </p>
          )}
          {listQuery.data?.appointments.map((appt) => (
            <Card key={appt.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium" style={{ color: "var(--color-text)" }}>
                    {appt.date} · {appt.startTime}–{appt.endTime} — {appt.client.name} ({appt.client.phone})
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {appt.specialist.name} · {appt.services.map((s) => s.name).join(", ")}
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {STATUS_LABELS[appt.status] ?? appt.status} · código {appt.confirmationCode}
                    {appt.notes && ` · nota: ${appt.notes}`}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setEditingAppt(appt)}>
                  Editar
                </Button>
              </div>
            </Card>
          ))}
        </>
      )}

      {editingAppt && (
        <AppointmentEditModal
          appointment={editingAppt}
          onClose={() => setEditingAppt(null)}
          onSaved={() => activeQuery.refetch()}
        />
      )}
    </div>
  );
}
