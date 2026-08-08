import { ServiceBookingFlow } from "./booking/ServiceBookingFlow";
import { Card } from "./ui/Card";

// The chat's landing experience (rendered inline in the message area, not a modal) — a
// static greeting immediately followed by the same single-tap categoría → servicio →
// especialista → fecha → hora flow (ServiceBookingFlow.tsx, shared with the "📅 Agendar
// cita" modal and the AI's inline mid-conversation picker) — no typing needed to start
// booking, and no separate "confirm your selection" step between tapping and moving on.

export function ChatWelcome({ sessionToken, onStartTyping }: { sessionToken: string; onStartTyping: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-start">
        <Card className="max-w-[90%] p-3 text-sm" style={{ color: "var(--color-text)" }}>
          ¡Bienvenida a Oopss Nails! 😊 Aquí te comparto nuestros servicios y te ayudo a agendar tu cita de la manera
          más rápida y sencilla. Si tienes cualquier duda, no dudes en preguntarme. Toca una categoría para empezar,
          o si prefieres, escríbeme directamente.
        </Card>
      </div>

      <Card>
        <ServiceBookingFlow sessionToken={sessionToken} onClose={onStartTyping} />
      </Card>

      <button
        type="button"
        onClick={onStartTyping}
        className="self-start text-sm"
        style={{ color: "var(--color-text-muted)" }}
      >
        Prefiero escribir mi pregunta →
      </button>
    </div>
  );
}
