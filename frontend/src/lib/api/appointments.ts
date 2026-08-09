const API_BASE = "/api/v1";

export interface AppointmentDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  confirmationCode: string;
  specialist: { id: string; name: string };
  services: { id: string; name: string; durationMinutes: number; price: string }[];
}

export interface AvailabilitySlot {
  specialistId: string;
  specialistName: string;
  date: string;
  startTime: string;
  endTime: string;
}

async function parseErrorOr<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error ?? fallback);
}

export function lookupAppointment(phone: string, code: string) {
  const qs = new URLSearchParams({ phone, code }).toString();
  return fetch(`${API_BASE}/appointments/lookup?${qs}`).then((res) =>
    parseErrorOr<AppointmentDetail>(res, "No se pudo consultar la cita"),
  );
}

export function cancelAppointment(id: string, phone: string, confirmationCode: string) {
  return fetch(`${API_BASE}/appointments/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, confirmationCode }),
  }).then((res) => parseErrorOr<AppointmentDetail>(res, "No se pudo cancelar la cita"));
}

// specialistId omitted returns slots across every specialist who can perform the service(s) —
// used by the admin reschedule flow to let the client see (and switch to) any qualifying
// specialist, not just the one already assigned.
export function checkAvailability(serviceIds: string[], specialistId: string | undefined, dateFrom: string, dateTo: string) {
  return fetch(`${API_BASE}/availability/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceIds, specialistId, dateFrom, dateTo }),
  }).then((res) => parseErrorOr<{ slots: AvailabilitySlot[] }>(res, "No se pudo consultar disponibilidad"));
}

export interface CreateAppointmentInput {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  specialistId: string;
  date: string;
  startTime: string;
  services: string[];
}

// Session-token authenticated (requireSessionOrAdmin on the backend) — used by the guided
// booking flow (GuidedBooking.tsx), which creates the appointment directly via clicks/short
// inputs rather than through the AI's create_appointment tool.
export function createAppointment(sessionToken: string, input: CreateAppointmentInput) {
  return fetch(`${API_BASE}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
    body: JSON.stringify(input),
  }).then((res) => parseErrorOr<AppointmentDetail>(res, "No se pudo agendar la cita"));
}

export function rescheduleAppointment(
  id: string,
  phone: string,
  confirmationCode: string,
  newDate: string,
  newStartTime: string,
) {
  return fetch(`${API_BASE}/appointments/${id}/reschedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, confirmationCode, newDate, newStartTime }),
  }).then((res) => parseErrorOr<AppointmentDetail>(res, "No se pudo reprogramar la cita"));
}
