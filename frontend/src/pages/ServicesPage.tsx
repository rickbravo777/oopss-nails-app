import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../components/ui/Card";
import { fetchServices, formatPrice, type ServiceSummary } from "../lib/api/services";

function groupByCategory(services: ServiceSummary[]) {
  const groups = new Map<string, ServiceSummary[]>();
  for (const s of services) {
    const list = groups.get(s.categoryName) ?? [];
    list.push(s);
    groups.set(s.categoryName, list);
  }
  return groups;
}

export function ServicesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["services"],
    queryFn: () => fetchServices(),
  });

  const grouped = useMemo(() => groupByCategory(data?.services ?? []), [data]);
  const categories = [...grouped.keys()];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const visibleCategory = activeCategory ?? categories[0] ?? null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
        Nuestros Servicios
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Oopss Nails
      </p>

      {isLoading && <p style={{ color: "var(--color-text-muted)" }}>Cargando servicios…</p>}
      {isError && (
        <p style={{ color: "var(--color-error)" }}>No se pudo cargar el catálogo. Intenta de nuevo.</p>
      )}

      {categories.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className="rounded-full px-3 py-1.5 text-sm"
                style={{
                  backgroundColor: cat === visibleCategory ? "var(--color-primary)" : "transparent",
                  color: cat === visibleCategory ? "white" : "var(--color-text)",
                  border: "1px solid rgb(var(--color-border) / var(--color-border-alpha))",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(grouped.get(visibleCategory ?? "") ?? []).map((service) => (
              <Card key={service.id} className="flex flex-col gap-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium" style={{ color: "var(--color-text)" }}>
                    {service.name}
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold" style={{ color: "var(--color-primary-dark)" }}>
                    {formatPrice(service)}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {service.defaultDurationMinutes} min
                  {service.requiresConsultation && " · precio final se confirma en el salón"}
                </span>
                <Link
                  to={`/?service=${service.id}`}
                  className="mt-2 text-sm font-medium"
                  style={{ color: "var(--color-primary)" }}
                >
                  Agendar este servicio →
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
