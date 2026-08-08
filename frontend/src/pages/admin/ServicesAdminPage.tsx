import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ApiError } from "../../lib/apiClient";
import {
  type AdminService,
  type ServiceInput,
  type ServicePriceType,
  createService,
  createServiceCategory,
  deactivateService,
  fetchAdminServices,
  fetchServiceCategories,
  updateService,
} from "../../lib/api/admin/services";

const PRICE_TYPE_LABELS: Record<ServicePriceType, string> = {
  fixed: "Fijo",
  starting_at: "Desde",
  range: "Rango",
};

interface FormState {
  categoryId: string;
  name: string;
  description: string;
  priceType: ServicePriceType;
  price: string;
  priceMax: string;
  currency: string;
  requiresConsultation: boolean;
  requiresPhoto: boolean;
  defaultDurationMinutes: string;
  sessionPackageSize: string;
  active: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  categoryId: "",
  name: "",
  description: "",
  priceType: "fixed",
  price: "",
  priceMax: "",
  currency: "USD",
  requiresConsultation: false,
  requiresPhoto: false,
  defaultDurationMinutes: "",
  sessionPackageSize: "",
  active: true,
  sortOrder: "0",
};

function serviceToForm(service: AdminService): FormState {
  return {
    categoryId: service.categoryId,
    name: service.name,
    description: service.description ?? "",
    priceType: service.priceType,
    price: service.price,
    priceMax: service.priceMax ?? "",
    currency: service.currency,
    requiresConsultation: service.requiresConsultation,
    requiresPhoto: service.requiresPhoto,
    defaultDurationMinutes: String(service.defaultDurationMinutes),
    sessionPackageSize: service.sessionPackageSize !== null ? String(service.sessionPackageSize) : "",
    active: service.active,
    sortOrder: String(service.sortOrder),
  };
}

function formToInput(form: FormState): ServiceInput {
  return {
    categoryId: form.categoryId,
    name: form.name,
    description: form.description || undefined,
    priceType: form.priceType,
    price: Number(form.price),
    priceMax: form.priceType === "range" ? Number(form.priceMax) : undefined,
    currency: form.currency || "USD",
    requiresConsultation: form.requiresConsultation,
    requiresPhoto: form.requiresPhoto,
    defaultDurationMinutes: Number(form.defaultDurationMinutes),
    sessionPackageSize: form.sessionPackageSize ? Number(form.sessionPackageSize) : undefined,
    active: form.active,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

export function ServicesAdminPage() {
  const servicesQuery = useQuery({ queryKey: ["admin", "services"], queryFn: fetchAdminServices });
  const categoriesQuery = useQuery({ queryKey: ["admin", "service-categories"], queryFn: fetchServiceCategories });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, AdminService[]>();
    for (const s of servicesQuery.data?.services ?? []) {
      const list = groups.get(s.categoryName) ?? [];
      list.push(s);
      groups.set(s.categoryName, list);
    }
    return groups;
  }, [servicesQuery.data]);

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categoriesQuery.data?.categories[0]?.id ?? "" });
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(service: AdminService) {
    setEditingId(service.id);
    setForm(serviceToForm(service));
    setError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input = formToInput(form);
      if (editingId) {
        await updateService(editingId, input);
      } else {
        await createService(input);
      }
      setFormOpen(false);
      await servicesQuery.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el servicio");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(service: AdminService) {
    if (service.active) {
      await deactivateService(service.id);
    } else {
      await updateService(service.id, {
        categoryId: service.categoryId,
        name: service.name,
        description: service.description ?? undefined,
        priceType: service.priceType,
        price: Number(service.price),
        priceMax: service.priceMax ? Number(service.priceMax) : undefined,
        currency: service.currency,
        requiresConsultation: service.requiresConsultation,
        requiresPhoto: service.requiresPhoto,
        defaultDurationMinutes: service.defaultDurationMinutes,
        sessionPackageSize: service.sessionPackageSize ?? undefined,
        active: true,
        sortOrder: service.sortOrder,
      });
    }
    await servicesQuery.refetch();
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    setCategoryError(null);
    try {
      await createServiceCategory(newCategoryName);
      setNewCategoryName("");
      await categoriesQuery.refetch();
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "No se pudo crear la categoría");
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
          Servicios
        </h1>
        <Button onClick={openCreateForm}>+ Nuevo servicio</Button>
      </div>

      {formOpen && (
        <Card>
          <h2 className="mb-3 font-medium" style={{ color: "var(--color-text)" }}>
            {editingId ? "Editar servicio" : "Nuevo servicio"}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                Categoría
              </label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="rounded-lg border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
              >
                <option value="" disabled>
                  Selecciona una categoría
                </option>
                {categoriesQuery.data?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Nombre"
              name="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Tipo de precio
                </label>
                <select
                  value={form.priceType}
                  onChange={(e) => setForm({ ...form, priceType: e.target.value as ServicePriceType })}
                  className="rounded-lg border bg-transparent px-3 py-2 text-sm"
                  style={{ borderColor: "rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
                >
                  {Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Duración (min)"
                name="defaultDurationMinutes"
                type="number"
                min={1}
                required
                value={form.defaultDurationMinutes}
                onChange={(e) => setForm({ ...form, defaultDurationMinutes: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={form.priceType === "range" ? "Precio mínimo" : "Precio"}
                name="price"
                type="number"
                step="0.01"
                min={0}
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              {form.priceType === "range" && (
                <Input
                  label="Precio máximo"
                  name="priceMax"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={form.priceMax}
                  onChange={(e) => setForm({ ...form, priceMax: e.target.value })}
                />
              )}
            </div>

            <Input
              label="Paquete de sesiones (opcional)"
              name="sessionPackageSize"
              type="number"
              min={1}
              value={form.sessionPackageSize}
              onChange={(e) => setForm({ ...form, sessionPackageSize: e.target.value })}
            />

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
                <input
                  type="checkbox"
                  checked={form.requiresConsultation}
                  onChange={(e) => setForm({ ...form, requiresConsultation: e.target.checked })}
                />
                Requiere consulta (precio final se confirma)
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
                <input
                  type="checkbox"
                  checked={form.requiresPhoto}
                  onChange={(e) => setForm({ ...form, requiresPhoto: e.target.checked })}
                />
                Requiere foto de referencia
              </label>
            </div>

            {error && (
              <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Categorías
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {categoriesQuery.data?.categories.map((c) => (
            <span
              key={c.id}
              className="rounded-full px-3 py-1 text-xs"
              style={{ border: "1px solid rgb(var(--color-border) / var(--color-border-alpha))", color: "var(--color-text)" }}
            >
              {c.name}
            </span>
          ))}
        </div>
        <form onSubmit={handleCreateCategory} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Nueva categoría"
              name="newCategory"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!newCategoryName.trim()}>
            Añadir
          </Button>
        </form>
        {categoryError && (
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--color-error)" }}>
            {categoryError}
          </p>
        )}
      </Card>

      {servicesQuery.isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando…</p>}
      {servicesQuery.isError && (
        <div className="flex items-center gap-3">
          <p className="text-sm" style={{ color: "var(--color-error)" }}>
            No se pudieron cargar los servicios.
          </p>
          <Button variant="secondary" onClick={() => servicesQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {[...grouped.entries()].map(([categoryName, services]) => (
        <Card key={categoryName}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {categoryName}
          </h2>
          <div className="flex flex-col gap-2">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: "rgb(var(--color-border) / var(--color-border-alpha))",
                  opacity: service.active ? 1 : 0.5,
                }}
              >
                <span className="font-medium" style={{ color: "var(--color-text)" }}>
                  {service.name}
                  {!service.active && " (inactivo)"}
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {PRICE_TYPE_LABELS[service.priceType]} · ${service.price}
                  {service.priceMax && `–$${service.priceMax}`} · {service.defaultDurationMinutes} min
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(service)}
                    className="text-sm font-medium"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(service)}
                    className="text-sm font-medium"
                    style={{ color: service.active ? "var(--color-error)" : "var(--color-primary)" }}
                  >
                    {service.active ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
