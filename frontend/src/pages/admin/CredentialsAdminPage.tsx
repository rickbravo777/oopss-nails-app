import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ApiError } from "../../lib/apiClient";
import { fetchCredentials, updateCredential } from "../../lib/api/admin/credentials";

const KEY_LABELS: Record<string, string> = {
  OPENAI_API_KEY: "OpenAI API Key",
  GOOGLE_SERVICE_ACCOUNT_JSON: "Google Sheets — Clave de cuenta de servicio (JSON)",
  GOOGLE_SHEETS_SPREADSHEET_ID: "Google Sheets — ID de la hoja de cálculo",
};

const KEY_HELP: Record<string, string> = {
  GOOGLE_SERVICE_ACCOUNT_JSON:
    "Pega aquí el contenido completo del archivo JSON de la cuenta de servicio de Google Cloud (empieza con { \"type\": \"service_account\", ... }).",
  GOOGLE_SHEETS_SPREADSHEET_ID:
    "El ID de la hoja, tomado de su URL: docs.google.com/spreadsheets/d/ESTE-ES-EL-ID/edit — asegúrate de haber compartido la hoja con el correo de la cuenta de servicio.",
};

// The Google service account key is a multi-line JSON blob — a single-line password input
// would be unusable for pasting it, so that one key gets a textarea instead.
const MULTILINE_KEYS = new Set(["GOOGLE_SERVICE_ACCOUNT_JSON"]);

export function CredentialsAdminPage() {
  const credentialsQuery = useQuery({ queryKey: ["admin", "credentials"], queryFn: fetchCredentials });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function openEdit(key: string) {
    setEditingKey(key);
    setValue("");
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingKey) return;
    setError(null);
    setSaving(true);
    try {
      await updateCredential(editingKey, value);
      setSuccessMessage(`${KEY_LABELS[editingKey] ?? editingKey} actualizada.`);
      setEditingKey(null);
      setValue("");
      await credentialsQuery.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la credencial");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="text-xl font-semibold" style={{ color: "var(--color-primary-dark)" }}>
        Credenciales
      </h1>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Estas claves se almacenan cifradas. El valor completo nunca se muestra después de guardarlo.
      </p>

      {successMessage && (
        <p className="text-sm" style={{ color: "var(--color-primary)" }}>
          {successMessage}
        </p>
      )}

      {credentialsQuery.data?.credentials.map((cred) => (
        <Card key={cred.key}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium" style={{ color: "var(--color-text)" }}>
                {KEY_LABELS[cred.key] ?? cred.key}
              </h2>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {cred.configured ? `Configurada: ${cred.maskedValue}` : "No configurada"}
                {cred.updatedAt && ` · actualizada ${new Date(cred.updatedAt).toLocaleString("es")}`}
              </p>
              {KEY_HELP[cred.key] && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {KEY_HELP[cred.key]}
                </p>
              )}
            </div>
            {editingKey !== cred.key && (
              <Button variant="secondary" onClick={() => openEdit(cred.key)}>
                {cred.configured ? "Actualizar" : "Configurar"}
              </Button>
            )}
          </div>

          {editingKey === cred.key && (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              {MULTILINE_KEYS.has(cred.key) ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor="value" className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    Nuevo valor
                  </label>
                  <textarea
                    id="value"
                    name="value"
                    required
                    rows={8}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
                    style={{
                      borderColor: "rgb(var(--color-border) / var(--color-border-alpha))",
                      color: "var(--color-text)",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              ) : (
                <Input
                  label="Nuevo valor"
                  name="value"
                  type="password"
                  autoComplete="off"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
              {error && (
                <p role="alert" className="text-sm" style={{ color: "var(--color-error)" }}>
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditingKey(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </Card>
      ))}
    </div>
  );
}
