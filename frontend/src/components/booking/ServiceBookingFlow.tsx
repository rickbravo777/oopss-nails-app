import { useEffect, useMemo, useState } from "react";

import { fetchServices, formatPrice, type ServiceSummary } from "../../lib/api/services";
import { useBookingFlow } from "../../lib/useBookingFlow";
import { type BookingSubStep, BookingStepsPanel, SummaryRow } from "./BookingStepsPanel";

// The full click-only booking flow (categoría → servicio → especialista → fecha → hora →
// contacto → confirmar → éxito), single-tap at every step — no typing, no checkboxes/submit.
// Extracted from GuidedBooking.tsx so the exact same flow can be reused in three places: the
// "📅 Agendar cita" modal (GuidedBooking.tsx), the chat's welcome screen (ChatWelcome.tsx),
// and inline mid-conversation whenever the AI calls offer_service_selection (ChatPage.tsx) —
// one implementation, so a fix can't silently diverge between entry points.

type Step = "categoria" | "servicio" | "steps";

const STEP_LABELS: Record<Exclude<Step, "steps"> | BookingSubStep, string> = {
  categoria: "Categoría",
  servicio: "Servicio",
  especialista: "Especialista",
  fecha: "Fecha",
  hora: "Hora",
  contacto: "Tus datos",
  confirmar: "Confirmar",
  exito: "¡Listo!",
};
const PROGRESS_ORDER: (Exclude<Step, "steps"> | BookingSubStep)[] = [
  "categoria",
  "servicio",
  "especialista",
  "fecha",
  "hora",
  "contacto",
  "confirmar",
];

const boxStyle = { border: "1px solid rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" };

export function ServiceBookingFlow({
  sessionToken,
  onClose,
  showProgress = true,
  initialCategories,
}: {
  sessionToken: string;
  onClose?: () => void;
  showProgress?: boolean;
  // Categories the AI already narrowed down from what the client said (e.g. "las uñas" ->
  // ["Manos","Pies"]) — when present, skips the "¿qué categoría?" step entirely and goes
  // straight to a combined services list across just those categories, instead of making
  // her pick a category she basically already told the assistant.
  initialCategories?: string[];
}) {
  const hasInitialCategories = Boolean(initialCategories && initialCategories.length > 0);
  const [step, setStep] = useState<Step>(hasInitialCategories ? "servicio" : "categoria");
  const [subStep, setSubStep] = useState<BookingSubStep>("especialista");
  const [servicesData, setServicesData] = useState<ServiceSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The category (or categories, when pre-narrowed by the AI) currently in scope for the
  // "servicio" step. A manual tap on the "categoria" step always narrows this to one.
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(
    hasInitialCategories ? (initialCategories as string[]) : null,
  );
  const [service, setService] = useState<ServiceSummary | null>(null);
  const [specialistAutoSelected, setSpecialistAutoSelected] = useState(false);

  const flow = useBookingFlow(sessionToken);

  useEffect(() => {
    fetchServices()
      .then((d) => setServicesData(d.services))
      .catch(() => setLoadError("No se pudo cargar el catálogo."));
  }, []);

  const categories = useMemo(() => {
    if (!servicesData) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of servicesData) {
      if (!seen.has(s.categoryName)) {
        seen.add(s.categoryName);
        list.push(s.categoryName);
      }
    }
    return list;
  }, [servicesData]);

  const servicesInScope = useMemo(
    () => (servicesData && selectedCategories ? servicesData.filter((s) => selectedCategories.includes(s.categoryName)) : []),
    [servicesData, selectedCategories],
  );

  async function selectService(s: ServiceSummary) {
    setService(s);
    const { autoSelected } = await flow.loadSpecialistsForService(s);
    setSpecialistAutoSelected(autoSelected);
    setSubStep(autoSelected ? "fecha" : "especialista");
    setStep("steps");
  }

  function reset() {
    setStep(hasInitialCategories ? "servicio" : "categoria");
    setSelectedCategories(hasInitialCategories ? (initialCategories as string[]) : null);
    setService(null);
    flow.reset();
  }

  const currentIndex = step === "steps" ? PROGRESS_ORDER.indexOf(subStep) : PROGRESS_ORDER.indexOf(step);

  return (
    <div className="flex flex-col gap-3">
      {showProgress && !(step === "steps" && subStep === "exito") && (
        <div className="flex flex-wrap gap-1 text-xs">
          {PROGRESS_ORDER.map((s, i) => (
            <span
              key={s}
              className="rounded-full px-2 py-1"
              style={{
                backgroundColor: i <= currentIndex ? "var(--color-primary)" : "transparent",
                color: i <= currentIndex ? "white" : "var(--color-text-muted)",
                border: i <= currentIndex ? "none" : "1px solid rgb(var(--color-border) / var(--color-border-alpha))",
              }}
            >
              {STEP_LABELS[s]}
            </span>
          ))}
        </div>
      )}

      {loadError && (
        <p className="text-sm" style={{ color: "var(--color-error)" }}>
          {loadError}
        </p>
      )}

      {(step === "servicio" || step === "steps") && selectedCategories && (
        <SummaryRow label="Categoría" value={selectedCategories.join(", ")} />
      )}
      {step === "steps" && service && <SummaryRow label="Servicio" value={service.name} />}

      {step === "categoria" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            ¿En qué servicio desearías agendar hoy?
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setSelectedCategories([c]);
                  setStep("servicio");
                }}
                className="rounded-full px-3 py-2 text-sm"
                style={boxStyle}
              >
                {c}
              </button>
            ))}
            {!servicesData && !loadError && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}
          </div>
        </div>
      )}

      {step === "servicio" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            ¿Cuál servicio de {selectedCategories?.join(" o ")} te gustaría?
          </p>
          {servicesInScope.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectService(s)}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm"
              style={boxStyle}
            >
              <span>{s.name}</span>
              <span style={{ color: "var(--color-primary-dark)" }}>{formatPrice(s)}</span>
            </button>
          ))}
          <div className="mt-2 flex gap-2 border-t pt-3" style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}>
            <button
              type="button"
              onClick={() => {
                // Always land on the full category list, even if this "servicio" step was
                // reached by skipping "categoria" entirely (a pre-narrowed category from the
                // AI) — otherwise there'd be no way back to see everything else the salon offers.
                setSelectedCategories(null);
                setStep("categoria");
              }}
              className="text-sm"
              style={{ color: "var(--color-primary)" }}
            >
              ← Atrás
            </button>
          </div>
        </div>
      )}

      {step === "steps" && service && (
        <BookingStepsPanel
          service={service}
          flow={flow}
          specialistAutoSelected={specialistAutoSelected}
          subStep={subStep}
          setSubStep={setSubStep}
          onExitToService={() => setStep("servicio")}
          onBookAnother={reset}
          onClose={onClose}
        />
      )}
    </div>
  );
}
