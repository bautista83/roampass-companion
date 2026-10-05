import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { AppShell } from './components/layout/AppShell';
import { Login } from './components/auth/Login';
import { Dashboard } from './components/dashboard/Dashboard';
import { GameSetup } from './components/setup/GameSetup';
import { GameTable } from './components/game/GameTable';

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const refresh = useAuthStore((s) => s.refresh);
  useEffect(() => {
    if (token) void refresh();
  }, [token, refresh]);
  return token ? <AppShell>{children}</AppShell> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/setup" element={<RequireAuth><GameSetup /></RequireAuth>} />
      <Route path="/play" element={<RequireAuth><GameTable /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
