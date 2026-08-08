import type { AppointmentDetail } from "../../lib/api/appointments";
import { formatPrice, type ServiceSummary } from "../../lib/api/services";
import { formatPhoneInput } from "../../lib/phoneFormat";
import type { useBookingFlow } from "../../lib/useBookingFlow";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Everything after "which service" (especialista → fecha → hora → contacto → confirmar →
// éxito) — shared by the modal wizard (GuidedBooking.tsx) and the chat's inline welcome
// flow, so both entry points book through the exact same steps/validation/error handling.
// `subStep` is controlled by the caller (not owned here) so a single progress indicator up
// there can stay in sync across the categoría/servicio steps it owns AND these steps.
//
// Each step ALREADY completed renders as a static summary row instead of disappearing —
// the client asked for this explicitly ("me gustaría que quedara la historia en el chat")
// after finding it confusing that everything she'd picked vanished once she reached a later
// step. Only the CURRENT step renders its interactive picker; everything before it stays
// visible as a read-only trail, like a running conversation instead of a wizard that erases
// itself.

export type BookingSubStep = "especialista" | "fecha" | "hora" | "contacto" | "confirmar" | "exito";

const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

function next7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const boxStyle = { border: "1px solid rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" };

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm"
      style={{ backgroundColor: "rgb(var(--color-surface) / var(--color-surface-alpha))", color: "var(--color-text)" }}
    >
      <span style={{ color: "var(--color-text-muted)" }}>{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

const SUB_STEP_ORDER: BookingSubStep[] = ["especialista", "fecha", "hora", "contacto", "confirmar", "exito"];

export function BookingStepsPanel({
  service,
  flow,
  specialistAutoSelected,
  subStep,
  setSubStep,
  onExitToService,
  onBookAnother,
  onClose,
}: {
  service: ServiceSummary;
  flow: ReturnType<typeof useBookingFlow>;
  specialistAutoSelected: boolean;
  subStep: BookingSubStep;
  setSubStep: (s: BookingSubStep) => void;
  onExitToService: () => void;
  onBookAnother: () => void;
  onClose?: () => void;
}) {
  const currentIndex = SUB_STEP_ORDER.indexOf(subStep);
  const isPast = (step: BookingSubStep) => currentIndex > SUB_STEP_ORDER.indexOf(step);

  function goBack() {
    if (subStep === "especialista") onExitToService();
    else if (subStep === "fecha") {
      if (specialistAutoSelected) onExitToService();
      else setSubStep("especialista");
    } else if (subStep === "hora") setSubStep("fecha");
    else if (subStep === "contacto") setSubStep("hora");
    else if (subStep === "confirmar") setSubStep("contacto");
  }

  async function handleSelectDate(d: Date) {
    if (!flow.specialist) return;
    flow.setSelectedDateLabel(`${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`);
    setSubStep("hora");
    await flow.loadSlots(service, flow.specialist, toISODate(d));
  }

  async function handleConfirm() {
    const appt: AppointmentDetail | null = await flow.confirmBooking(service);
    if (appt) setSubStep("exito");
  }

  return (
    <div className="flex flex-col gap-3">
      {flow.error && (
        <p className="text-sm" style={{ color: "var(--color-error)" }}>
          {flow.error}
        </p>
      )}

      {isPast("especialista") && flow.specialist && <SummaryRow label="Especialista" value={flow.specialist.name} />}
      {isPast("fecha") && flow.selectedDateLabel && <SummaryRow label="Fecha" value={flow.selectedDateLabel} />}
      {isPast("hora") && flow.slot && <SummaryRow label="Hora" value={flow.slot.startTime} />}
      {isPast("contacto") && (
        <SummaryRow label="Tus datos" value={`${flow.clientName} · ${flow.clientPhone} · ${flow.clientEmail}`} />
      )}

      {subStep === "especialista" && flow.specialists && (
        <div className="flex flex-wrap gap-2">
          {flow.specialists.map((sp) => (
            <button
              key={sp.id}
              type="button"
              onClick={() => {
                flow.setSpecialist(sp);
                setSubStep("fecha");
              }}
              className="rounded-full px-3 py-2 text-sm"
              style={boxStyle}
            >
              {sp.name}
            </button>
          ))}
        </div>
      )}

      {subStep === "fecha" && (
        <div className="flex flex-wrap gap-2">
          {next7Days().map((d) => (
            <button
              key={toISODate(d)}
              type="button"
              onClick={() => handleSelectDate(d)}
              className="flex flex-col items-center rounded-lg px-3 py-2 text-xs"
              style={boxStyle}
            >
              <span className="font-medium">{DAY_NAMES[d.getDay()]}</span>
              <span>
                {d.getDate()} {MONTH_NAMES[d.getMonth()]}
              </span>
            </button>
          ))}
        </div>
      )}

      {subStep === "hora" && (
        <div className="flex flex-col gap-2">
          {flow.slots === null && !flow.error && <p style={{ color: "var(--color-text-muted)" }}>Buscando horarios…</p>}
          {flow.slots && flow.slots.length === 0 && (
            <p style={{ color: "var(--color-text-muted)" }}>No hay horarios disponibles ese día. Elige otra fecha.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {flow.slots?.map((sl) => (
              <button
                key={sl.startTime}
                type="button"
                onClick={() => {
                  flow.setSlot(sl);
                  setSubStep("contacto");
                }}
                className="rounded-full px-3 py-2 text-sm"
                style={boxStyle}
              >
                {sl.startTime}
              </button>
            ))}
          </div>
        </div>
      )}

      {subStep === "contacto" && (
        <div className="flex flex-col gap-3">
          <Input
            label="Tu nombre"
            name="clientName"
            placeholder="Ejm: Carolina Villa"
            value={flow.clientName}
            onChange={(e) => flow.setClientName(e.target.value)}
          />
          <Input
            label="Tu teléfono"
            name="clientPhone"
            type="tel"
            inputMode="numeric"
            placeholder="Ejm: 6095-8765"
            value={flow.clientPhone}
            onChange={(e) => flow.setClientPhone(formatPhoneInput(e.target.value))}
          />
          <Input
            label="Tu correo"
            name="clientEmail"
            type="email"
            placeholder="Ejm: carolina@correo.com"
            value={flow.clientEmail}
            onChange={(e) => flow.setClientEmail(e.target.value)}
            error={flow.clientEmail.length > 0 && !EMAIL_PATTERN.test(flow.clientEmail) ? "Correo inválido" : undefined}
          />
          <Button
            onClick={() => setSubStep("confirmar")}
            disabled={!flow.clientName.trim() || !flow.clientPhone.trim() || !EMAIL_PATTERN.test(flow.clientEmail)}
          >
            Continuar
          </Button>
        </div>
      )}

      {subStep === "confirmar" && flow.specialist && flow.slot && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "rgb(var(--color-surface) / var(--color-surface-alpha))" }}>
            <p>
              <strong>{service.name}</strong> — {formatPrice(service)}
            </p>
            <p>Especialista: {flow.specialist.name}</p>
            <p>
              {flow.slot.date} · {flow.slot.startTime}–{flow.slot.endTime}
            </p>
            <p>
              {flow.clientName} · {flow.clientPhone} · {flow.clientEmail}
            </p>
          </div>
          <Button onClick={handleConfirm} disabled={flow.submitting}>
            {flow.submitting ? "Agendando..." : "Confirmar cita ✅"}
          </Button>
        </div>
      )}

      {subStep === "exito" && flow.result && (
        <div className="flex flex-col gap-3 text-center">
          <p className="text-lg">🎉 ¡Cita agendada!</p>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Código de confirmación
          </p>
          <p className="text-2xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
            {flow.result.confirmationCode}
          </p>
          <p className="text-sm">
            {flow.result.services.map((s) => s.name).join(", ")} con {flow.result.specialist.name}
          </p>
          <p className="text-sm">
            {flow.result.date} · {flow.result.startTime}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="secondary" onClick={onBookAnother}>
              Agendar otra
            </Button>
            {onClose && <Button onClick={onClose}>Cerrar</Button>}
          </div>
        </div>
      )}

      {subStep !== "exito" && (
        <div className="mt-1 flex gap-2 border-t pt-3" style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}>
          <Button variant="secondary" onClick={goBack}>
            ← Atrás
          </Button>
        </div>
      )}
    </div>
  );
}
