import { useAuthStore } from "./authStore";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`/api/v1${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;

  if (res.status === 401 && token) {
    // A previously-valid session token was rejected (expired, or signed with an old secret) —
    // clear it and send the admin back to log in instead of leaving every page stuck showing
    // a generic fetch-error with no indication of what actually went wrong or how to recover.
    useAuthStore.getState().clearAuth();
    if (!window.location.pathname.startsWith("/admin/login")) {
      window.location.href = "/admin/login";
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? "Ocurrió un error inesperado");
  }

  return body as T;
}
