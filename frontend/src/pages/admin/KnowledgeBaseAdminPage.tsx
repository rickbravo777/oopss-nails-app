import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ApiError } from "../../lib/apiClient";
import { fetchAdminServices, fetchServiceCategories } from "../../lib/api/admin/services";
import {
  createSynonym,
  deletePolicy,
  deleteSynonym,
  fetchPolicies,
  fetchSynonyms,
  savePolicy,
} from "../../lib/api/admin/knowledgeBase";

export function KnowledgeBaseAdminPage() {
  const synonymsQuery = useQuery({ queryKey: ["admin", "kb", "synonyms"], queryFn: fetchSynonyms });
  const servicesQuery = useQuery({ queryKey: ["admin", "services"], queryFn: fetchAdminServices });
  const categoriesQuery = useQuery({ queryKey: ["admin", "service-categories"], queryFn: fetchServiceCategories });
  const policiesQuery = useQuery({ queryKey: ["admin", "kb", "policies"], queryFn: fetchPolicies });

  const [term, setTerm] = useState("");
  const [targetType, setTargetType] = useState<"service" | "category">("service");
  const [targetId, setTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [synonymError, setSynonymError] = useState<string | null>(null);

  async function handleAddSynonym(e: FormEvent) {
    e.preventDefault();
    setSynonymError(null);
    try {
      await createSynonym({
        term,
        canonicalServiceId: targetType === "service" ? targetId : undefined,
        canonicalCategoryId: targetType === "category" ? targetId : undefined,
        notes: notes || undefined,
      });
      setTerm("");
      setTargetId("");
      setNotes("");
      await synonymsQuery.refetch();
    } catch (err) {
      setSynonymError(err instanceof ApiError ? err.message : "No se pudo crear la equivalencia");
    }
  }

  async function handleDeleteSynonym(id: string) {
    await deleteSynonym(id);
    await synonymsQuery.refetch();
  }

  const [newPolicyKey, setNewPolicyKey] = useState("");
  const [newPolicyValue, setNewPolicyValue] = useState("");
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [editingPolicyKey, setEditingPolicyKey] = useState<string | null>(null);
  const [editingPolicyValue, setEditingPolicyValue] = useState("");

  async function handleAddPolicy(e: FormEvent) {
    e.preventDefault();
    setPolicyError(null);
    try {
      await savePolicy(newPolicyKey, newPolicyValue);
      setNewPolicyKey("");
      setNewPolicyValue("");
      await policiesQuery.refetch();
    } catch (err) {
      setPolicyError(err instanceof ApiError ? err.message : "No se pudo guardar la política");
    }
  }

  async function handleSaveExistingPolicy(key: string) {
    setPolicyError(null);
    try {
      await savePolicy(key, editingPolicyValue);
      setEditingPolicyKey(null);
      await policiesQuery.refetch();
    } catch (err) {
      setPolicyError(err instanceof ApiError ? err.message : "No se pudo guardar la política");
    }
  }

  async function handleDeletePolicy(key: string) {
    await deletePolicy(key);
    await policiesQuery.refetch();
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
        Base de Conocimiento
      </h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Equivalencias de términos
        </h2>
        <p className="mb-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Cuando una clienta usa un término coloquial (ej. "pintura en gel"), el asistente lo resuelve al servicio
          oficial indicado aquí.
        </p>
        <div className="mb-3 flex flex-col gap-2">
          {synonymsQuery.data?.synonyms.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}
            >
              <span style={{ color: "var(--color-text)" }}>
                "{s.term}" → {s.canonicalService?.name ?? s.canonicalCategory?.name}
                {s.notes && ` (${s.notes})`}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteSynonym(s.id)}
                className="text-sm font-medium"
                style={{ color: "var(--color-error)" }}
              >
                Eliminar
              </button>
            </div>
          ))}
          {synonymsQuery.data?.synonyms.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Sin equivalencias registradas.
            </p>
          )}
        </div>

        <form onSubmit={handleAddSynonym} className="flex flex-wrap items-end gap-2">
          <Input label="Término coloquial" name="term" required value={term} onChange={(e) => setTerm(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Tipo de destino
            </label>
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as "service" | "category");
                setTargetId("");
              }}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
            >
              <option value="service">Servicio</option>
              <option value="category">Categoría</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Destino
            </label>
            <select
              required
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
            >
              <option value="" disabled>
                Selecciona
              </option>
              {targetType === "service"
                ? servicesQuery.data?.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                : categoriesQuery.data?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <Input label="Nota (opcional)" name="synonymNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit">+ Añadir</Button>
        </form>
        {synonymError && (
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--color-error)" }}>
            {synonymError}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Políticas del asistente
        </h2>
        <p className="mb-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Fragmentos de texto libre que se añaden al comportamiento del asistente (ej. política de cancelación).
        </p>

        <div className="mb-3 flex flex-col gap-3">
          {policiesQuery.data?.policies.map((p) => (
            <div
              key={p.key}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))" }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium" style={{ color: "var(--color-text)" }}>
                  {p.key}
                </span>
                <div className="flex gap-2">
                  {editingPolicyKey !== p.key && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPolicyKey(p.key);
                        setEditingPolicyValue(p.value);
                      }}
                      className="text-sm font-medium"
                      style={{ color: "var(--color-primary)" }}
                    >
                      Editar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeletePolicy(p.key)}
                    className="text-sm font-medium"
                    style={{ color: "var(--color-error)" }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              {editingPolicyKey === p.key ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editingPolicyValue}
                    onChange={(e) => setEditingPolicyValue(e.target.value)}
                    rows={3}
                    className="rounded-lg border bg-transparent px-3 py-2 text-sm"
                    style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleSaveExistingPolicy(p.key)}>Guardar</Button>
                    <Button variant="secondary" onClick={() => setEditingPolicyKey(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <p style={{ color: "var(--color-text-muted)" }}>{p.value}</p>
              )}
            </div>
          ))}
          {policiesQuery.data?.policies.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Sin políticas registradas.
            </p>
          )}
        </div>

        <form onSubmit={handleAddPolicy} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Clave (ej. cancelaciones)"
                name="newPolicyKey"
                required
                value={newPolicyKey}
                onChange={(e) => setNewPolicyKey(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              Texto
            </label>
            <textarea
              required
              value={newPolicyValue}
              onChange={(e) => setNewPolicyValue(e.target.value)}
              rows={3}
              className="rounded-lg border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
            />
          </div>
          <Button type="submit" className="self-start">
            + Añadir política
          </Button>
        </form>
        {policyError && (
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--color-error)" }}>
            {policyError}
          </p>
        )}
      </Card>
    </div>
  );
}
