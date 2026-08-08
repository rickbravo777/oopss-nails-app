import type { AdminAppointment } from "../../lib/api/admin/appointments";
import type { Specialist } from "../../lib/api/admin/specialists";
import { getSpecialistColor } from "../../lib/specialistColors";
import { CalendarGrid } from "./CalendarGrid";

// Columns = specialists instead of days — answers "who's free right now / who's booked
// solid today," which the week view (columns = days) can't show at a glance once more
// than one or two appointments land on the same day.
export function CalendarDayView({
  specialists,
  appointments,
  onSelectAppointment,
}: {
  specialists: Specialist[];
  appointments: AdminAppointment[];
  onSelectAppointment: (appt: AdminAppointment) => void;
}) {
  const active = specialists.filter((s) => s.active);

  const columns = active.map((s) => ({
    key: s.id,
    label: s.name,
    muted: !appointments.some((a) => a.specialist.id === s.id),
  }));

  const events = appointments
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({
      id: a.id,
      columnKey: a.specialist.id,
      startTime: a.startTime,
      endTime: a.endTime,
      title: a.client.name,
      subtitle: a.services.map((s) => s.name).join(", "),
      color: getSpecialistColor(a.specialist.id),
      onClick: () => onSelectAppointment(a),
    }));

  return <CalendarGrid columns={columns} events={events} />;
}
