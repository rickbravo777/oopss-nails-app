import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { ThemeToggle } from "../components/ThemeToggle";
import { useAuthStore } from "../lib/authStore";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/servicios", label: "Servicios" },
  { to: "/admin/personal", label: "Personal" },
  { to: "/admin/citas", label: "Citas" },
  { to: "/admin/escalamientos", label: "Escalamientos" },
  { to: "/admin/credenciales", label: "Credenciales" },
  { to: "/admin/conocimiento", label: "Base de Conocimiento" },
];

export function AdminLayout() {
  const admin = useAuthStore((s) => s.admin);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate("/admin/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="glass-card m-4 flex w-56 flex-shrink-0 flex-col gap-1 p-4">
        <div className="mb-4 px-2">
          <img src="/logo-lockup.png" alt="Oopss Nails" className="h-8 w-auto rounded-md" />
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "font-semibold" : ""}`
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? "var(--color-primary)" : "transparent",
              color: isActive ? "white" : "var(--color-text)",
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 p-4">
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {admin?.name}
          </span>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="glass-card px-3 py-1.5 text-sm"
            style={{ color: "var(--color-text)" }}
          >
            Cerrar sesión
          </button>
        </header>
        <main className="flex-1 px-4 pb-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
