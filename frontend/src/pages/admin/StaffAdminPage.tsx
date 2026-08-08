import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ApiError } from "../../lib/apiClient";
import { fetchAdminServices } from "../../lib/api/admin/services";
import {
  createSpecialist,
  deactivateSpecialist,
  fetchSpecialist,
  fetchSpecialists,
  updateSpecialist,
  updateSpecialistServices,
} from "../../lib/api/admin/specialists";

interface SpecialistFormState {
  name: string;
  photoUrl: string;
  bio: string;
}

const EMPTY_FORM: SpecialistFormState = { name: "", photoUrl: "", bio: "" };

export function StaffAdminPage() {
  const specialistsQuery = useQuery({ queryKey: ["admin", "specialists"], queryFn: fetchSpecialists });
  const servicesQuery = useQuery({ queryKey: ["admin", "services"], queryFn: fetchAdminServices });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SpecialistFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin", "specialists", selectedId],
    queryFn: () => fetchSpecialist(selectedId!),
    enabled: Boolean(selectedId),
  });

  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [savingServices, setSavingServices] = useState(false);
  const [serviceSaveMessage, setServiceSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (detailQuery.data) {
      setSelectedServiceIds(new Set(detailQuery.data.services.map((s) => s.id)));
      setForm({
        name: detailQuery.data.name,
        photoUrl: detailQuery.data.photoUrl ?? "",
        bio: detailQuery.data.bio ?? "",
      });
    }
  }, [detailQuery.data]);

  const groupedServices = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }[]>();
    for (const s of servicesQuery.data?.services ?? []) {
      if (!s.active) continue;
      const list = groups.get(s.categoryName) ?? [];
      list.push({ id: s.id, name: s.name });
      groups.set(s.categoryName, list);
    }
    return groups;
  }, [servicesQuery.data]);

  function openCreate() {
    setSelectedId(null);
    setCreating(true);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await createSpecialist({
        name: form.name,
        photoUrl: form.photoUrl || undefined,
        bio: form.bio || undefined,
      });
      setCreating(false);
      await specialistsQuery.refetch();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el especialista");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !detailQuery.data) return;
    setError(null);
    setSaving(true);
    try {
      await updateSpecialist(selectedId, {
        name: form.name,
        photoUrl: form.photoUrl || undefined,
        bio: form.bio || undefined,
        active: detailQuery.data.active,
      });
      await Promise.all([specialistsQuery.refetch(), detailQuery.refetch()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el especialista");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!selectedId || !detailQuery.data) return;
    if (detailQuery.data.active) {
      await deactivateSpecialist(selectedId);
    } else {
      await updateSpecialist(selectedId, { name: detailQuery.data.name, active: true });
    }
    await Promise.all([specialistsQuery.refetch(), detailQuery.refetch()]);
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSaveServices() {
    if (!selectedId) return;
    setSavingServices(true);
    setServiceSaveMessage(null);
    try {
      await updateSpecialistServices(selectedId, [...selectedServiceIds]);
      setServiceSaveMessage("Servicios actualizados.");
      await detailQuery.refetch();
    } catch (err) {
      setServiceSaveMessage(err instanceof ApiError ? err.message : "No se pudieron guardar los servicios");
    } finally {
      setSavingServices(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
          Personal
        </h1>
        <Button onClick={openCreate}>+ Nuevo especialista</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <Card className="flex flex-col gap-1 p-3">
          {specialistsQuery.data?.specialists.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedId(s.id);
              }}
              className="rounded-lg px-3 py-2 text-left text-sm"
              style={{
                backgroundColor: selectedId === s.id ? "var(--color-primary)" : "transparent",
                color: selectedId === s.id ? "white" : "var(--color-text)",
                opacity: s.active ? 1 : 0.5,
              }}
            >
              {s.name}
              {!s.active && " (inactivo)"}
            </button>
          ))}
        </Card>

        <div className="flex flex-col gap-4">
          {creating && (
            <Card>
              <h2 className="mb-3 font-medium" style={{ color: "var(--color-text)" }}>
                Nuevo especialista
              </h2>
              <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
                <Input
                  label="Nombre"
                  name="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  label="URL de foto (opcional)"
                  name="photoUrl"
                  value={form.photoUrl}
                  onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                />
                <Input
                  label="Bio (opcional)"
                  name="bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
                {error && (
                  <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando..." : "Crear"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {selectedId && detailQuery.data && (
            <>
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-medium" style={{ color: "var(--color-text)" }}>
                    {detailQuery.data.name}
                  </h2>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/admin/personal/${selectedId}/horario`}
                      className="text-sm font-medium"
                      style={{ color: "var(--color-primary)" }}
                    >
                      Configurar horario →
                    </Link>
                    <button
                      type="button"
                      onClick={handleToggleActive}
                      className="text-sm font-medium"
                      style={{ color: detailQuery.data.active ? "var(--color-error)" : "var(--color-primary)" }}
                    >
                      {detailQuery.data.active ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                </div>
                <form onSubmit={handleUpdateSubmit} className="flex flex-col gap-3">
                  <Input
                    label="Nombre"
                    name="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <Input
                    label="URL de foto (opcional)"
                    name="photoUrl"
                    value={form.photoUrl}
                    onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                  />
                  <Input
                    label="Bio (opcional)"
                    name="bio"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                  {error && (
                    <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
                      {error}
                    </p>
                  )}
                  <Button type="submit" disabled={saving} className="self-start">
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </form>
              </Card>

              <Card>
                <h2 className="mb-3 font-medium" style={{ color: "var(--color-text)" }}>
                  Servicios que atiende
                </h2>
                <div className="flex flex-col gap-3">
                  {[...groupedServices.entries()].map(([categoryName, services]) => (
                    <div key={categoryName}>
                      <h3 className="mb-1 text-xs font-semibold uppercase" style={{ color: "var(--color-text-muted)" }}>
                        {categoryName}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {services.map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-2 text-sm"
                            style={{ color: "var(--color-text)" }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.has(service.id)}
                              onChange={() => toggleService(service.id)}
                            />
                            {service.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={handleSaveServices} disabled={savingServices}>
                    {savingServices ? "Guardando..." : "Guardar servicios"}
                  </Button>
                  {serviceSaveMessage && (
                    <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      {serviceSaveMessage}
                    </span>
                  )}
                </div>
              </Card>
            </>
          )}

          {!creating && !selectedId && (
            <Card>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Selecciona un especialista de la lista, o crea uno nuevo.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
