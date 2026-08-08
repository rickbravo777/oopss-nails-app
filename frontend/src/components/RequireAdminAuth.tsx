import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "../lib/authStore";

export function RequireAdminAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
