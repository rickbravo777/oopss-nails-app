import { apiFetch } from "../../apiClient";

export interface TermSynonym {
  id: string;
  term: string;
  notes: string | null;
  canonicalService: { id: string; name: string } | null;
  canonicalCategory: { id: string; name: string } | null;
}

export interface AssistantPolicy {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export function fetchSynonyms(): Promise<{ synonyms: TermSynonym[] }> {
  return apiFetch("/admin/knowledge-base/synonyms");
}

export function createSynonym(input: {
  term: string;
  canonicalServiceId?: string;
  canonicalCategoryId?: string;
  notes?: string;
}): Promise<TermSynonym> {
  return apiFetch("/admin/knowledge-base/synonyms", { method: "POST", body: JSON.stringify(input) });
}

export function deleteSynonym(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/knowledge-base/synonyms/${id}`, { method: "DELETE" });
}

export function fetchPolicies(): Promise<{ policies: AssistantPolicy[] }> {
  return apiFetch("/admin/knowledge-base/policies");
}

export function savePolicy(key: string, value: string): Promise<AssistantPolicy> {
  return apiFetch(`/admin/knowledge-base/policies/${key}`, { method: "PUT", body: JSON.stringify({ value }) });
}

export function deletePolicy(key: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/knowledge-base/policies/${key}`, { method: "DELETE" });
}
