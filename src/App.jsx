import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Spinner } from "./components/ui/Spinner";
import { useAuth } from "./context/AuthContext";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const SessionMonitorPage = lazy(() =>
  import("./pages/AttendancePage").then((module) => ({ default: module.AttendancePage }))
);
const TeacherRegistryPage = lazy(() =>
  import("./pages/StudentRegistryPage").then((module) => ({
    default: module.StudentRegistryPage
  }))
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage }))
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage }))
);

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50">
        <Spinner label="Loading…" size="md" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-50">
          <Spinner label="Loading…" size="md" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/monitor" element={<SessionMonitorPage />} />
          <Route path="/teacher-registry" element={<TeacherRegistryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
