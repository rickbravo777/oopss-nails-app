import { apiFetch } from "../../apiClient";

export interface AdminAppointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  confirmationCode: string;
  notes: string | null;
  source: string;
  createdAt: string;
  client: { name: string; phone: string };
  specialist: { id: string; name: string };
  services: { id: string; name: string; price: string; durationMinutes: number }[];
}

export interface AppointmentFilters {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  specialistId?: string;
  status?: string;
}

export function fetchAdminAppointments(filters: AppointmentFilters): Promise<{ appointments: AdminAppointment[] }> {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.specialistId) params.set("specialistId", filters.specialistId);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return apiFetch(`/admin/appointments${qs ? `?${qs}` : ""}`);
}

export interface AppointmentEditInput {
  date?: string;
  startTime?: string;
  specialistId?: string;
  status?: string;
  notes?: string;
}

export function updateAdminAppointment(id: string, input: AppointmentEditInput): Promise<AdminAppointment> {
  return apiFetch(`/admin/appointments/${id}`, { method: "PUT", body: JSON.stringify(input) });
}
