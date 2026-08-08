import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ApiError, apiFetch } from "../../lib/apiClient";
import { useAuthStore } from "../../lib/authStore";

interface LoginResponse {
  token: string;
  admin: { id: string; name: string; email: string };
}

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuth(res.token, res.admin);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <img src="/logo-lockup.png" alt="Oopss Nails" className="mb-4 h-10 w-auto rounded-md" />
        <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
          Panel Admin
        </h1>
        <p className="mb-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Inicia sesión para continuar
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Correo"
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
