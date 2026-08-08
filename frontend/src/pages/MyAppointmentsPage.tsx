import { type FormEvent, useState } from "react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import {
  type AppointmentDetail,
  type AvailabilitySlot,
  cancelAppointment,
  checkAvailability,
  lookupAppointment,
  rescheduleAppointment,
} from "../lib/api/appointments";
import { formatPhoneInput } from "../lib/phoneFormat";

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Pendiente de confirmación",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MyAppointmentsPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(todayISO());
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const found = await lookupAppointment(phone, code);
      setAppointment(found);
      setRescheduling(false);
      setSlots(null);
      setConfirmCancel(false);
    } catch (err) {
      setAppointment(null);
      setError(err instanceof Error ? err.message : "No se pudo consultar la cita");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!appointment) return;
    setError(null);
    try {
      const updated = await cancelAppointment(appointment.id, phone, code);
      setAppointment(updated);
      setConfirmCancel(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la cita");
    }
  }

  async function handleFindSlots() {
    if (!appointment) return;
    setError(null);
    setSlotsLoading(true);
    setSlots(null);
    try {
      const serviceIds = appointment.services.map((s) => s.id);
      const dateTo = new Date(new Date(newDate).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const res = await checkAvailability(serviceIds, appointment.specialist.id, newDate, dateTo);
      setSlots(res.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar disponibilidad");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handlePickSlot(slot: AvailabilitySlot) {
    if (!appointment) return;
    setError(null);
    try {
      const updated = await rescheduleAppointment(appointment.id, phone, code, slot.date, slot.startTime);
      setAppointment(updated);
      setRescheduling(false);
      setSlots(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reprogramar la cita");
    }
  }

  const isActive = appointment && appointment.status !== "cancelled" && appointment.status !== "completed";

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
        Mis Citas
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Consulta, reprograma o cancela tu cita con tu teléfono y código de confirmación.
      </p>

      <Card className="mb-4">
        <form onSubmit={handleLookup} className="flex flex-col gap-4">
          <Input
            label="Teléfono"
            name="phone"
            type="tel"
            inputMode="numeric"
            placeholder="6030-7210"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          />
          <Input
            label="Código de confirmación"
            name="code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Buscando..." : "Buscar mi cita"}
          </Button>
        </form>
      </Card>

      {appointment && (
        <Card>
          <h2 className="mb-2 font-medium" style={{ color: "var(--color-text)" }}>
            {STATUS_LABELS[appointment.status] ?? appointment.status}
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text)" }}>
            {appointment.date} · {appointment.startTime}–{appointment.endTime}
          </p>
          <p className="text-sm" style={{ color: "var(--color-text)" }}>
            Especialista: {appointment.specialist.name}
          </p>
          <ul className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {appointment.services.map((s) => (
              <li key={s.id}>
                {s.name} — ${s.price} ({s.durationMinutes} min)
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Código: {appointment.confirmationCode}
          </p>

          {isActive && !rescheduling && !confirmCancel && (
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => setRescheduling(true)}>
                Reprogramar
              </Button>
              <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                Cancelar cita
              </Button>
            </div>
          )}

          {confirmCancel && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-sm" style={{ color: "var(--color-text)" }}>
                ¿Seguro que deseas cancelar esta cita?
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleCancel}>
                  Sí, cancelar
                </Button>
                <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                  Volver
                </Button>
              </div>
            </div>
          )}

          {rescheduling && (
            <div className="mt-4 flex flex-col gap-3">
              <Input
                label="Nueva fecha"
                type="date"
                min={todayISO()}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleFindSlots} disabled={slotsLoading}>
                  {slotsLoading ? "Buscando..." : "Ver horarios disponibles"}
                </Button>
                <Button variant="secondary" onClick={() => setRescheduling(false)}>
                  Cancelar
                </Button>
              </div>
              {slots && slots.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No hay horarios disponibles en esa semana.
                </p>
              )}
              {slots && slots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.startTime}`}
                      type="button"
                      onClick={() => handlePickSlot(slot)}
                      className="glass-card px-3 py-1.5 text-sm"
                      style={{ color: "var(--color-text)" }}
                    >
                      {slot.date} {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
