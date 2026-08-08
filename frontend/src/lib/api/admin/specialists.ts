import { apiFetch } from "../../apiClient";

export interface Specialist {
  id: string;
  name: string;
  active: boolean;
  photoUrl: string | null;
  bio: string | null;
}

export interface SpecialistDetail extends Specialist {
  services: { id: string; name: string; categoryId: string; durationOverrideMinutes: number | null }[];
}

export interface ScheduleRule {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export interface ScheduleConstraint {
  id?: string;
  serviceId?: string | null;
  serviceCategoryId?: string | null;
  dayOfWeek?: number | null;
  latestStartTime: string;
  note?: string | null;
}

export interface ScheduleException {
  id: string;
  date: string;
  type: "day_off" | "custom_hours";
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

export interface SpecialistSchedule {
  rules: ScheduleRule[];
  constraints: ScheduleConstraint[];
  exceptions: ScheduleException[];
}

export function fetchSpecialists(): Promise<{ specialists: Specialist[] }> {
  return apiFetch("/admin/specialists");
}

export function fetchSpecialist(id: string): Promise<SpecialistDetail> {
  return apiFetch(`/admin/specialists/${id}`);
}

export function createSpecialist(input: { name: string; photoUrl?: string; bio?: string }): Promise<Specialist> {
  return apiFetch("/admin/specialists", { method: "POST", body: JSON.stringify(input) });
}

export function updateSpecialist(
  id: string,
  input: { name: string; photoUrl?: string; bio?: string; active?: boolean },
): Promise<Specialist> {
  return apiFetch(`/admin/specialists/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deactivateSpecialist(id: string): Promise<Specialist> {
  return apiFetch(`/admin/specialists/${id}`, { method: "DELETE" });
}

export function updateSpecialistServices(
  id: string,
  serviceIds: string[],
  durationOverrides?: Record<string, number>,
): Promise<{ services: SpecialistDetail["services"] }> {
  return apiFetch(`/admin/specialists/${id}/services`, {
    method: "PUT",
    body: JSON.stringify({ serviceIds, durationOverrides }),
  });
}

export function fetchSpecialistSchedule(id: string): Promise<SpecialistSchedule> {
  return apiFetch(`/admin/specialists/${id}/schedule`);
}

export function updateSpecialistSchedule(
  id: string,
  rules: ScheduleRule[],
  constraints: ScheduleConstraint[],
): Promise<{ rules: ScheduleRule[]; constraints: ScheduleConstraint[] }> {
  return apiFetch(`/admin/specialists/${id}/schedule`, {
    method: "PUT",
    body: JSON.stringify({ rules, constraints }),
  });
}

export function createScheduleException(
  specialistId: string,
  input: { date: string; type: "day_off" | "custom_hours"; startTime?: string; endTime?: string; reason?: string },
): Promise<ScheduleException> {
  return apiFetch(`/admin/specialists/${specialistId}/schedule-exceptions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteScheduleException(specialistId: string, exceptionId: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/specialists/${specialistId}/schedule-exceptions/${exceptionId}`, { method: "DELETE" });
}
