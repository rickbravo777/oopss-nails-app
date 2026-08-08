import { ServiceBookingFlow } from "./booking/ServiceBookingFlow";
import { Card } from "./ui/Card";

// A fully click-driven booking flow that sits alongside the free-text chat (not a
// replacement) — every option shown is real data from the same endpoints the AI/admin use
// (GET /services, GET /services/:id, POST /availability/check, POST /appointments), never
// invented, so there's no hallucination risk during the mechanical part of booking. This
// component is just the modal chrome; the actual flow lives in ServiceBookingFlow.tsx, shared
// with the chat's welcome screen and its inline mid-conversation picker.

export function GuidedBooking({ sessionToken, onClose }: { sessionToken: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <Card className="max-h-[85vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--color-primary-dark)" }}>
              📅 Agendar cita
            </h2>
            <button type="button" onClick={onClose} style={{ color: "var(--color-text-muted)" }} aria-label="Cerrar">
              ✕
            </button>
          </div>

          <ServiceBookingFlow sessionToken={sessionToken} onClose={onClose} />
        </Card>
      </div>
    </div>
  );
}
