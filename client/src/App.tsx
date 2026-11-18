import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { setLocale } from './i18n';
import { AppShell } from './components/layout/AppShell';
import { Login } from './components/auth/Login';
import { ForgotPassword, ResetPassword, VerifyEmail } from './components/auth/EmailLinkPages';
import { Dashboard } from './components/dashboard/Dashboard';
import { GameSetup } from './components/setup/GameSetup';
import { GameTable } from './components/game/GameTable';
import { Profile } from './components/profile/Profile';
import { RulesPage } from './components/rules/RulesPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const refresh = useAuthStore((s) => s.refresh);
  useEffect(() => {
    if (token) void refresh();
  }, [token, refresh]);
  return token ? <AppShell>{children}</AppShell> : <Navigate to="/login" replace />;
}

export function App() {
  // Idioma del perfil (o del navegador si no hay sesion).
  const locale = useAuthStore((s) => s.user?.locale);
  useEffect(() => setLocale(locale), [locale]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Enlaces de los correos: funcionan con o sin sesion iniciada. */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/setup" element={<RequireAuth><GameSetup /></RequireAuth>} />
      <Route path="/play" element={<RequireAuth><GameTable /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/rules" element={<RequireAuth><RulesPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
