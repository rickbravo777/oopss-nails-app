import { Route, Routes } from "react-router-dom";

import { RequireAdminAuth } from "./components/RequireAdminAuth";
import { AdminLayout } from "./layouts/AdminLayout";
import { AppointmentsAdminPage } from "./pages/admin/AppointmentsAdminPage";
import { CredentialsAdminPage } from "./pages/admin/CredentialsAdminPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { EscalationsAdminPage } from "./pages/admin/EscalationsAdminPage";
import { KnowledgeBaseAdminPage } from "./pages/admin/KnowledgeBaseAdminPage";
import { LoginPage } from "./pages/admin/LoginPage";
import { ServicesAdminPage } from "./pages/admin/ServicesAdminPage";
import { SpecialistSchedulePage } from "./pages/admin/SpecialistSchedulePage";
import { StaffAdminPage } from "./pages/admin/StaffAdminPage";
import { ChatPage } from "./pages/ChatPage";
import { MyAppointmentsPage } from "./pages/MyAppointmentsPage";
import { ServicesPage } from "./pages/ServicesPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/servicios" element={<ServicesPage />} />
      <Route path="/mis-citas" element={<MyAppointmentsPage />} />

      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdminAuth>
            <AdminLayout />
          </RequireAdminAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="servicios" element={<ServicesAdminPage />} />
        <Route path="personal" element={<StaffAdminPage />} />
        <Route path="personal/:id/horario" element={<SpecialistSchedulePage />} />
        <Route path="citas" element={<AppointmentsAdminPage />} />
        <Route path="escalamientos" element={<EscalationsAdminPage />} />
        <Route path="credenciales" element={<CredentialsAdminPage />} />
        <Route path="conocimiento" element={<KnowledgeBaseAdminPage />} />
      </Route>
    </Routes>
  );
}

export default App;
