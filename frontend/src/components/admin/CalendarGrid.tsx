import type { SpecialistColor } from "../../lib/specialistColors";

// Shared grid renderer for both the week view (columns = days) and the day view (columns =
// specialists) — both are fundamentally "N columns × a time axis with positioned blocks",
// so one component avoids duplicating the time-math between them.

const GRID_START_MINUTES = 9 * 60; // 09:00 — earliest any specialist starts
const GRID_END_MINUTES = 19 * 60; // 19:00 — latest any specialist ends (Yez, weekdays)
const GRID_TOTAL_MINUTES = GRID_END_MINUTES - GRID_START_MINUTES;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT_PX = 44;
const GRID_HEIGHT_PX = (GRID_TOTAL_MINUTES / SLOT_MINUTES) * SLOT_HEIGHT_PX;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function offsetPx(time: string): number {
  const minutes = Math.min(Math.max(timeToMinutes(time), GRID_START_MINUTES), GRID_END_MINUTES);
  return ((minutes - GRID_START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}

export interface CalendarColumn {
  key: string;
  label: string;
  sublabel?: string;
  muted?: boolean; // e.g. a day/specialist with nothing scheduled — dims the header slightly
}

export interface CalendarEvent {
  id: string;
  columnKey: string;
  startTime: string;
  endTime: string;
  title: string;
  subtitle: string;
  color: SpecialistColor;
  onClick: () => void;
}

const HOUR_LABELS = Array.from(
  { length: GRID_TOTAL_MINUTES / 60 + 1 },
  (_, i) => `${(9 + i).toString().padStart(2, "0")}:00`,
);

export function CalendarGrid({ columns, events }: { columns: CalendarColumn[]; events: CalendarEvent[] }) {
  return (
    <div className="flex overflow-x-auto">
      <div className="flex-shrink-0" style={{ width: 56 }}>
        <div style={{ height: 44 }} />
        {HOUR_LABELS.map((label) => (
          <div
            key={label}
            style={{ height: SLOT_HEIGHT_PX * 2 }}
            className="pr-2 text-right text-xs"
          >
            <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 gap-1">
        {columns.map((col) => (
          <div key={col.key} className="min-w-[140px] flex-1">
            <div
              className="mb-1 flex flex-col items-center justify-center rounded-lg py-2 text-center"
              style={{
                height: 44,
                backgroundColor: "rgb(var(--color-surface) / var(--color-surface-alpha))",
                opacity: col.muted ? 0.55 : 1,
              }}
            >
              <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                {col.label}
              </span>
              {col.sublabel && (
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {col.sublabel}
                </span>
              )}
            </div>

            <div
              className="relative rounded-lg"
              style={{
                height: GRID_HEIGHT_PX,
                backgroundColor: "rgb(var(--color-surface) / calc(var(--color-surface-alpha) * 0.5))",
                backgroundImage: `repeating-linear-gradient(to bottom, rgb(var(--color-border) / var(--color-border-alpha)) 0, rgb(var(--color-border) / var(--color-border-alpha)) 1px, transparent 1px, transparent ${SLOT_HEIGHT_PX * 2}px)`,
              }}
            >
              {events
                .filter((e) => e.columnKey === col.key)
                .map((event) => {
                  const top = offsetPx(event.startTime);
                  const height = Math.max(offsetPx(event.endTime) - top, 22);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={event.onClick}
                      className="absolute left-1 right-1 overflow-hidden rounded-md px-2 py-1 text-left text-xs shadow-sm transition-transform hover:z-10 hover:scale-[1.02]"
                      style={{
                        top,
                        height,
                        backgroundColor: event.color.bg,
                        borderLeft: `3px solid ${event.color.base}`,
                        color: "var(--color-text)",
                      }}
                      title={`${event.startTime}–${event.endTime} · ${event.title} · ${event.subtitle}`}
                    >
                      <span className="block truncate font-medium">
                        {event.startTime} {event.title}
                      </span>
                      <span className="block truncate" style={{ color: "var(--color-text-muted)" }}>
                        {event.subtitle}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
