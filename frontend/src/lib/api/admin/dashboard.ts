import { apiFetch } from "../../apiClient";

export interface TodayAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  clientName: string;
  clientPhone: string;
  specialist: { id: string; name: string };
  services: string[];
}

export interface DashboardHealth {
  db: "ok" | "error";
  openai: "ok" | "not_configured";
  diskUsagePercent: number | null;
  openEscalationsCount: number;
  recentErrors: { id: string; source: string; message: string; createdAt: string }[];
  todayAppointments: TodayAppointment[];
}

export function fetchDashboardHealth(): Promise<DashboardHealth> {
  return apiFetch("/admin/dashboard/health");
}
