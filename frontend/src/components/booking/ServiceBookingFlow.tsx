import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  initialServiceId,
  initialServiceNeedsConfirmation,
}: {
  sessionToken: string;
  onClose?: () => void;
  showProgress?: boolean;
  // Categories the AI already narrowed down from what the client said (e.g. "las uñas" ->
  // ["Manos","Pies"]). With exactly one category, there's nothing left to pick — skip the
  // "¿qué categoría?" step entirely and go straight to that category's services. With more
  // than one (still ambiguous — "uñas" alone doesn't say manos or pies), keep the normal
  // single-tap "categoria" step, just filtered down to only the relevant ones instead of
  // showing all 10.
  initialCategories?: string[];
  // The exact service the client already confirmed she wants (e.g. resolved via a Q&A earlier
  // in the chat). Skips categoría AND servicio entirely — jumps straight to especialista once
  // the catalog loads and this id is matched against it. Takes priority over initialCategories
  // if somehow both are given (the backend tool never sends both at once).
  initialServiceId?: string;
  // When the AI matched initialServiceId from imprecise/misspelled wording and isn't fully
  // confident, this shows a "¿Quieres agendar X? Sí/No" single-tap confirm before jumping to
  // especialista, instead of assuming the match is correct.
  initialServiceNeedsConfirmation?: boolean;
}) {
  const singleInitialCategory =
    initialCategories && initialCategories.length === 1 ? initialCategories[0] : null;
  // Fixed for the lifetime of this widget instance (derived from props, never reassigned) —
  // narrows which category buttons the "categoria" step offers, when the AI already narrowed
  // it from context. null means show every category, same as before this existed.
  const categoryFilter = initialCategories && initialCategories.length > 1 ? initialCategories : null;

  const [step, setStep] = useState<Step>(singleInitialCategory ? "servicio" : "categoria");
  const [subStep, setSubStep] = useState<BookingSubStep>("especialista");
  const [servicesData, setServicesData] = useState<ServiceSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The single category currently in scope for the "servicio" step — always exactly one,
  // since even a pre-narrowed multi-category hint (categoryFilter) still requires a single
  // tap to pick between them, same "selección simple" pattern used everywhere else.
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(
    singleInitialCategory ? [singleInitialCategory] : null,
  );
  const [service, setService] = useState<ServiceSummary | null>(null);
  const [specialistAutoSelected, setSpecialistAutoSelected] = useState(false);
  // Gates rendering the categoría/servicio steps until an initialServiceId lookup (if any) has
  // resolved — without this, there'd be a one-frame flash of the category picker before the
  // effect below fires selectService() and flips to "steps".
  const [serviceLookupDone, setServiceLookupDone] = useState(!initialServiceId);
  // Set (instead of calling selectService directly) when initialServiceNeedsConfirmation is
  // true — renders a "¿Quieres agendar X? Sí/No" step instead of assuming the match is right.
  const [pendingConfirmService, setPendingConfirmService] = useState<ServiceSummary | null>(null);

  const flow = useBookingFlow(sessionToken);

  // Each step keeps the previous ones visible as a running summary (see BookingStepsPanel's own
  // comment on why), so this widget keeps growing taller with every tap instead of replacing
  // itself. ChatPage only auto-scrolls the chat panel when a NEW message arrives (its effect
  // depends on `messages`), which never fires for an in-place step change — on a short viewport
  // (phone-sized), a client can tap through especialista → fecha → hora and have the "Tu
  // nombre/teléfono/correo" step render correctly but entirely below the fold, with nothing
  // prompting her to scroll down to see it. Scroll this widget's own bottom into view on every
  // step change so newly-revealed content is never invisible, regardless of which of the three
  // host surfaces (modal, welcome screen, inline chat) rendered it.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // "smooth" depends on the browser actually servicing animation frames for this tab —
    // verified in this project's own dev tooling that a backgrounded/non-composited tab silently
    // drops a smooth scrollIntoView entirely (it never moves, no error, nothing). "auto" (instant)
    // is a synchronous layout operation that doesn't have that dependency — worth the lost easing
    // for a fix whose entire point is "the client must actually see this content."
    rootRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [step, subStep, pendingConfirmService]);

  const selectService = useCallback(
    async (s: ServiceSummary) => {
      setService(s);
      const { autoSelected } = await flow.loadSpecialistsForService(s);
      setSpecialistAutoSelected(autoSelected);
      setSubStep(autoSelected ? "fecha" : "especialista");
      setStep("steps");
    },
    [flow],
  );

  useEffect(() => {
    fetchServices()
      .then((d) => setServicesData(d.services))
      .catch(() => setLoadError("No se pudo cargar el catálogo."));
  }, []);

  useEffect(() => {
    if (!initialServiceId || serviceLookupDone || !servicesData) return;
    const match = servicesData.find((s) => s.id === initialServiceId);
    if (match && initialServiceNeedsConfirmation) {
      setPendingConfirmService(match);
    } else if (match) {
      selectService(match);
    }
    // No match (shouldn't happen — the backend already validated it exists) falls back to the
    // normal categoría step once serviceLookupDone flips, rather than leaving the client stuck.
    setServiceLookupDone(true);
  }, [servicesData, initialServiceId, initialServiceNeedsConfirmation, serviceLookupDone, selectService]);

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

  // The "categoria" step's own button list — every category, unless the AI already narrowed
  // it down to more than one relevant option ("las uñas" -> Manos, Pies), in which case only
  // those show. A single pre-narrowed category skips this step entirely (see step init above).
  const visibleCategories = useMemo(
    () => (categoryFilter ? categories.filter((c) => categoryFilter.includes(c)) : categories),
    [categories, categoryFilter],
  );

  const servicesInScope = useMemo(
    () => (servicesData && selectedCategories ? servicesData.filter((s) => selectedCategories.includes(s.categoryName)) : []),
    [servicesData, selectedCategories],
  );

  function reset() {
    setStep(singleInitialCategory ? "servicio" : "categoria");
    setSelectedCategories(singleInitialCategory ? [singleInitialCategory] : null);
    setService(null);
    flow.reset();
    // Re-arms the same confirmed-service auto-select for "agendar otro" — the client
    // presumably wants another slot for the same service she just booked, not a fresh pick.
    if (initialServiceId) setServiceLookupDone(false);
  }

  const currentIndex = step === "steps" ? PROGRESS_ORDER.indexOf(subStep) : PROGRESS_ORDER.indexOf(step);

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
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

      {!serviceLookupDone && !loadError && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}

      {pendingConfirmService && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            ¿Quieres agendar {pendingConfirmService.name} ({formatPrice(pendingConfirmService)})?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const s = pendingConfirmService;
                setPendingConfirmService(null);
                selectService(s);
              }}
              className="rounded-full px-4 py-2 text-sm text-white"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirmService(null)}
              className="rounded-full px-4 py-2 text-sm"
              style={boxStyle}
            >
              No, buscar otro
            </button>
          </div>
        </div>
      )}

      {serviceLookupDone && !pendingConfirmService && step === "categoria" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            ¿En qué servicio desearías agendar hoy?
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((c) => (
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

      {serviceLookupDone && !pendingConfirmService && step === "servicio" && (
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
                // visibleCategories re-derives correctly either way: back to the narrowed
                // Manos/Pies-style pair if that's how we got here, or to every category if
                // this "servicio" step was reached by skipping a single pre-narrowed category.
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
