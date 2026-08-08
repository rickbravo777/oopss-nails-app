import { apiFetch } from "../apiClient";

export interface ServiceSummary {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  priceType: "fixed" | "starting_at" | "range";
  price: string;
  priceMax: string | null;
  currency: string;
  requiresConsultation: boolean;
  requiresPhoto: boolean;
  defaultDurationMinutes: number;
  sessionPackageSize: number | null;
}

export function fetchServices(category?: string): Promise<{ services: ServiceSummary[] }> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch(`/services${qs}`);
}

export interface ServiceDetail extends ServiceSummary {
  description: string | null;
  specialists: { id: string; name: string }[];
}

export function fetchServiceDetail(id: string): Promise<ServiceDetail> {
  return apiFetch(`/services/${id}`);
}

export function formatPrice(service: ServiceSummary): string {
  const currency = service.currency === "USD" ? "$" : service.currency;
  if (service.priceType === "range" && service.priceMax) {
    return `${currency}${service.price}–${currency}${service.priceMax}`;
  }
  if (service.priceType === "starting_at") {
    return `Desde ${currency}${service.price}`;
  }
  if (service.sessionPackageSize) {
    return `${currency}${service.price} (paquete ${service.sessionPackageSize} sesiones)`;
  }
  return `${currency}${service.price}`;
}
