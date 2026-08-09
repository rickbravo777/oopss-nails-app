import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ApiError } from "../../lib/apiClient";
import { fetchAdminServices, fetchServiceCategories } from "../../lib/api/admin/services";
import {
  type ScheduleConstraint,
  type ScheduleException,
  createScheduleException,
  deleteScheduleException,
  fetchSpecialist,
  fetchSpecialistSchedule,
  updateSpecialistSchedule,
} from "../../lib/api/admin/specialists";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface DayRow {
  active: boolean;
  startTime: string;
  endTime: string;
}

function emptyWeek(): DayRow[] {
  return DAY_NAMES.map(() => ({ active: false, startTime: "09:00", endTime: "18:00" }));
}

export function SpecialistSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const specialistQuery = useQuery({
    queryKey: ["admin", "specialists", id],
    queryFn: () => fetchSpecialist(id!),
    enabled: Boolean(id),
  });
  const scheduleQuery = useQuery({
    queryKey: ["admin", "specialists", id, "schedule"],
    queryFn: () => fetchSpecialistSchedule(id!),
    enabled: Boolean(id),
  });
  const categoriesQuery = useQuery({ queryKey: ["admin", "service-categories"], queryFn: fetchServiceCategories });
  const servicesQuery = useQuery({ queryKey: ["admin", "services"], queryFn: fetchAdminServices });

  const [week, setWeek] = useState<DayRow[]>(emptyWeek());
  const [constraints, setConstraints] = useState<ScheduleConstraint[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleQuery.data) return;
    const nextWeek = emptyWeek();
    for (const rule of scheduleQuery.data.rules) {
      nextWeek[rule.dayOfWeek] = { active: true, startTime: rule.startTime, endTime: rule.endTime };
    }
    setWeek(nextWeek);
    setConstraints(scheduleQuery.data.constraints);
  }, [scheduleQuery.data]);

  const [newConstraint, setNewConstraint] = useState<ScheduleConstraint>({ latestStartTime: "16:00" });

  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState<"day_off" | "custom_hours">("day_off");
  const [exceptionStart, setExceptionStart] = useState("");
  const [exceptionEnd, setExceptionEnd] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [localExceptions, setLocalExceptions] = useState<ScheduleException[]>([]);

  useEffect(() => {
    if (scheduleQuery.data) setLocalExceptions(scheduleQuery.data.exceptions);
  }, [scheduleQuery.data]);

  async function handleSaveSchedule() {
    if (!id) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const rules = week
        .map((row, dayOfWeek) => ({ dayOfWeek, startTime: row.startTime, endTime: row.endTime, active: row.active }))
        .filter((r) => r.active)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));

      await updateSpecialistSchedule(id, rules, constraints);
      setSaveMessage("Horario guardado.");
      await scheduleQuery.refetch();
    } catch (err) {
      setSaveMessage(err instanceof ApiError ? err.message : "No se pudo guardar el horario");
    } finally {
      setSaving(false);
    }
  }

  function addConstraint() {
    setConstraints([...constraints, newConstraint]);
    setNewConstraint({ latestStartTime: "16:00" });
  }

  function removeConstraint(index: number) {
    setConstraints(constraints.filter((_, i) => i !== index));
  }

  async function handleAddException(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setExceptionError(null);
    try {
      const created = await createScheduleException(id, {
        date: exceptionDate,
        type: exceptionType,
        startTime: exceptionType === "custom_hours" ? exceptionStart : undefined,
        endTime: exceptionType === "custom_hours" ? exceptionEnd : undefined,
        reason: exceptionReason || undefined,
      });
      setLocalExceptions([...localExceptions, created].sort((a, b) => a.date.localeCompare(b.date)));
      setExceptionDate("");
      setExceptionReason("");
    } catch (err) {
      setExceptionError(err instanceof ApiError ? err.message : "No se pudo crear la excepción");
    }
  }

  async function handleDeleteException(exceptionId: string) {
    if (!id) return;
    await deleteScheduleException(id, exceptionId);
    setLocalExceptions(localExceptions.filter((e) => e.id !== exceptionId));
  }

  const activeServices = (servicesQuery.data?.services ?? []).filter((s) => s.active);

  return (
    <div className="flex flex-col gap-4 py-4">
      <div>
        <Link to="/admin/personal" className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
          ← Volver a Personal
        </Link>
        <h1 className="mt-1 text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
          Horario — {specialistQuery.data?.name ?? "…"}
        </h1>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Horario semanal
        </h2>
        <div className="flex flex-col gap-2">
          {DAY_NAMES.map((dayName, dayOfWeek) => {
            const row = week[dayOfWeek];
            return (
              <div key={dayName} className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => {
                      const next = [...week];
                      next[dayOfWeek] = { ...row, active: e.target.checked };
                      setWeek(next);
                    }}
                  />
                  {dayName}
                </label>
                {row.active && (
                  <>
                    <input
                      type="time"
                      value={row.startTime}
                      onChange={(e) => {
                        const next = [...week];
                        next[dayOfWeek] = { ...row, startTime: e.target.value };
                        setWeek(next);
                      }}
                      className="rounded-lg border bg-transparent px-2 py-1 text-sm"
                      style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
                    />
                    <span style={{ color: "var(--color-text-muted)" }}>a</span>
                    <input
                      type="time"
                      value={row.endTime}
                      onChange={(e) => {
                        const next = [...week];
                        next[dayOfWeek] = { ...row, endTime: e.target.value };
                        setWeek(next);
                      }}
                      className="rounded-lg border bg-transparent px-2 py-1 text-sm"
                      style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="mb-2 mt-6 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Restricciones de último horario reservable
        </h2>
        <div className="flex flex-col gap-2">
          {constraints.map((c, index) => (
            <div
              key={c.id ?? index}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}
            >
              <span style={{ color: "var(--color-text)" }}>
                {c.dayOfWeek !== undefined && c.dayOfWeek !== null ? DAY_NAMES[c.dayOfWeek] : "Todos los días"} · último
                inicio {c.latestStartTime}
                {c.serviceId && ` · ${activeServices.find((s) => s.id === c.serviceId)?.name ?? c.serviceId}`}
                {c.serviceCategoryId &&
                  ` · ${categoriesQuery.data?.categories.find((cat) => cat.id === c.serviceCategoryId)?.name ?? c.serviceCategoryId}`}
                {c.note && ` — ${c.note}`}
              </span>
              <button
                type="button"
                onClick={() => removeConstraint(index)}
                className="text-sm font-medium"
                style={{ color: "var(--color-error)" }}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Día
            </label>
            <select
              value={newConstraint.dayOfWeek ?? ""}
              onChange={(e) =>
                setNewConstraint({ ...newConstraint, dayOfWeek: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              className="rounded-lg border px-2 py-2 text-sm"
              style={{
                borderColor: "rgb(var(--color-border) / var(--color-border-alpha))",
                color: "var(--color-text)",
                backgroundColor: "rgb(var(--color-surface))",
              }}
            >
              <option value="">Todos los días</option>
              {DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Último inicio
            </label>
            <input
              type="time"
              value={newConstraint.latestStartTime}
              onChange={(e) => setNewConstraint({ ...newConstraint, latestStartTime: e.target.value })}
              className="rounded-lg border bg-transparent px-2 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Input
              label="Nota (opcional)"
              name="constraintNote"
              value={newConstraint.note ?? ""}
              onChange={(e) => setNewConstraint({ ...newConstraint, note: e.target.value })}
            />
          </div>
          <Button type="button" variant="secondary" onClick={addConstraint}>
            + Añadir restricción
          </Button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSaveSchedule} disabled={saving}>
            {saving ? "Guardando..." : "Guardar horario"}
          </Button>
          {saveMessage && (
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {saveMessage}
            </span>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Excepciones (día libre / horario especial)
        </h2>
        <div className="mb-3 flex flex-col gap-2">
          {localExceptions.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Sin excepciones registradas.
            </p>
          )}
          {localExceptions.map((exc) => (
            <div
              key={exc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}
            >
              <span style={{ color: "var(--color-text)" }}>
                {exc.date} — {exc.type === "day_off" ? "Día libre" : `Horario especial ${exc.startTime}–${exc.endTime}`}
                {exc.reason && ` (${exc.reason})`}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteException(exc.id)}
                className="text-sm font-medium"
                style={{ color: "var(--color-error)" }}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddException} className="flex flex-wrap items-end gap-2">
          <Input
            label="Fecha"
            name="exceptionDate"
            type="date"
            required
            value={exceptionDate}
            onChange={(e) => setExceptionDate(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Tipo
            </label>
            <select
              value={exceptionType}
              onChange={(e) => setExceptionType(e.target.value as "day_off" | "custom_hours")}
              className="rounded-lg border px-2 py-2 text-sm"
              style={{
                borderColor: "rgb(var(--color-border) / var(--color-border-alpha))",
                color: "var(--color-text)",
                backgroundColor: "rgb(var(--color-surface))",
              }}
            >
              <option value="day_off">Día libre</option>
              <option value="custom_hours">Horario especial</option>
            </select>
          </div>
          {exceptionType === "custom_hours" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Desde
                </label>
                <input
                  type="time"
                  required
                  value={exceptionStart}
                  onChange={(e) => setExceptionStart(e.target.value)}
                  className="rounded-lg border bg-transparent px-2 py-2 text-sm"
                  style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Hasta
                </label>
                <input
                  type="time"
                  required
                  value={exceptionEnd}
                  onChange={(e) => setExceptionEnd(e.target.value)}
                  className="rounded-lg border bg-transparent px-2 py-2 text-sm"
                  style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
                />
              </div>
            </>
          )}
          <div className="min-w-[160px] flex-1">
            <Input
              label="Motivo (opcional)"
              name="exceptionReason"
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
            />
          </div>
          <Button type="submit">+ Añadir excepción</Button>
        </form>
        {exceptionError && (
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--color-error)" }}>
            {exceptionError}
          </p>
        )}
      </Card>
    </div>
  );
}
