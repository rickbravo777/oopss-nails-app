import { apiFetch } from "../../apiClient";

export interface CredentialEntry {
  key: string;
  configured: boolean;
  maskedValue: string | null;
  updatedAt: string | null;
}

export function fetchCredentials(): Promise<{ credentials: CredentialEntry[] }> {
  return apiFetch("/admin/credentials");
}

export function updateCredential(key: string, value: string): Promise<CredentialEntry> {
  return apiFetch(`/admin/credentials/${key}`, { method: "PUT", body: JSON.stringify({ value }) });
}
