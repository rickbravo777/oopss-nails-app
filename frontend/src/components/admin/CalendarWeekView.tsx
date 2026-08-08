import { addDays, toISODate } from "../../lib/calendarDates";
import type { AdminAppointment } from "../../lib/api/admin/appointments";
import { getSpecialistColor } from "../../lib/specialistColors";
import { CalendarGrid } from "./CalendarGrid";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function CalendarWeekView({
  weekStart,
  appointments,
  onSelectAppointment,
}: {
  weekStart: Date;
  appointments: AdminAppointment[];
  onSelectAppointment: (appt: AdminAppointment) => void;
}) {
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  const todayISO = toISODate(new Date());

  const columns = days.map((d) => ({
    key: toISODate(d),
    label: DAY_NAMES[d.getDay()],
    sublabel: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
    muted: toISODate(d) !== todayISO && !appointments.some((a) => a.date === toISODate(d)),
  }));

  const events = appointments
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({
      id: a.id,
      columnKey: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      title: a.specialist.name,
      subtitle: `${a.client.name} · ${a.services.map((s) => s.name).join(", ")}`,
      color: getSpecialistColor(a.specialist.id),
      onClick: () => onSelectAppointment(a),
    }));

  return <CalendarGrid columns={columns} events={events} />;
}
