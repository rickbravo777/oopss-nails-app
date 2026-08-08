import { apiFetch } from "../../apiClient";

export type ServicePriceType = "fixed" | "starting_at" | "range";

export interface AdminService {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  priceType: ServicePriceType;
  price: string;
  priceMax: string | null;
  currency: string;
  requiresConsultation: boolean;
  requiresPhoto: boolean;
  defaultDurationMinutes: number;
  sessionPackageSize: number | null;
  active: boolean;
  sortOrder: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  displayOrder: number;
}

export interface ServiceInput {
  categoryId: string;
  name: string;
  description?: string;
  priceType: ServicePriceType;
  price: number;
  priceMax?: number;
  currency?: string;
  requiresConsultation?: boolean;
  requiresPhoto?: boolean;
  defaultDurationMinutes: number;
  sessionPackageSize?: number;
  active?: boolean;
  sortOrder?: number;
}

export function fetchAdminServices(): Promise<{ services: AdminService[] }> {
  return apiFetch("/admin/services");
}

export function createService(input: ServiceInput): Promise<AdminService> {
  return apiFetch("/admin/services", { method: "POST", body: JSON.stringify(input) });
}

export function updateService(id: string, input: ServiceInput): Promise<AdminService> {
  return apiFetch(`/admin/services/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deactivateService(id: string): Promise<AdminService> {
  return apiFetch(`/admin/services/${id}`, { method: "DELETE" });
}

export function fetchServiceCategories(): Promise<{ categories: ServiceCategory[] }> {
  return apiFetch("/admin/service-categories");
}

export function createServiceCategory(name: string, displayOrder?: number): Promise<ServiceCategory> {
  return apiFetch("/admin/service-categories", { method: "POST", body: JSON.stringify({ name, displayOrder }) });
}
