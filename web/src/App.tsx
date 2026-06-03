import { useEffect } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppFrame } from "./components/AppFrame";
import { ClassesPage } from "./pages/ClassesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MeasurementsPage } from "./pages/MeasurementsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { SecurityPage } from "./pages/SecurityPage";
import { StudentClassesPage } from "./pages/StudentClassesPage";
import { StudentSignupPage } from "./pages/StudentSignupPage";
import { TeamLandingPage } from "./pages/TeamLandingPage";
import { TeamsPage } from "./pages/TeamsPage";
import { TrainerSettingsPage } from "./pages/TrainerSettingsPage";
import { TrainerWorkspacePage } from "./pages/TrainerWorkspacePage";
import { TrainerSignupPage } from "./pages/TrainerSignupPage";
import { useSessionStore } from "./store/session";

export default function App() {
  const startSession = useSessionStore((state) => state.start);

  useEffect(() => startSession(), [startSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppFrame />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="treinadores" element={<TeamsPage />} />
          <Route path="cadastro/aluno" element={<StudentSignupPage />} />
          <Route path="cadastro/treinador" element={<TrainerSignupPage />} />
          <Route path="t/:slug" element={<TeamLandingPage />} />

          {/* Onboarding — autenticado mas sem role definida ainda */}
          <Route
            path="app/onboarding"
            element={
              <RequireAuth>
                <RequireNoRole>
                  <OnboardingPage />
                </RequireNoRole>
              </RequireAuth>
            }
          />

          {/* Authenticated routes — student */}
          <Route path="app" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="app/minhas-aulas" element={<RequireStudent><StudentClassesPage /></RequireStudent>} />
          <Route path="app/medidas" element={<RequireStudent><MeasurementsPage /></RequireStudent>} />

          {/* Authenticated routes — trainer */}
          <Route path="app/agenda" element={<RequireTrainer><ClassesPage /></RequireTrainer>} />
          <Route path="app/aulas" element={<RequireTrainer><ClassesPage /></RequireTrainer>} />
          <Route path="app/alunos" element={<RequireTrainer><MeasurementsPage /></RequireTrainer>} />
          <Route path="app/treinador" element={<RequireTrainer><TrainerWorkspacePage /></RequireTrainer>} />
          <Route path="app/seguranca" element={<RequireTrainer><SecurityPage /></RequireTrainer>} />
          <Route path="app/configuracoes" element={<RequireTrainer><TrainerSettingsPage /></RequireTrainer>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSessionStore((state) => state.user);
  const loading = useSessionStore((state) => state.loading);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * Permite acesso apenas quando ainda NÃO há role definida.
 * Se o usuário já tem role, redireciona para /app.
 */
function RequireNoRole({ children }: { children: ReactNode }) {
  const role = useSessionStore((state) => state.claims.role);
  const loading = useSessionStore((state) => state.loading);

  if (loading) return null;

  if (role) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

function RequireTrainer({ children }: { children: ReactNode }) {
  const role = useSessionStore((state) => state.claims.role);
  const loading = useSessionStore((state) => state.loading);

  if (loading) return null;

  return (
    <RequireAuth>
      {role === "trainer" ? children : <Navigate to="/app" replace />}
    </RequireAuth>
  );
}

function RequireStudent({ children }: { children: ReactNode }) {
  const role = useSessionStore((state) => state.claims.role);
  const loading = useSessionStore((state) => state.loading);

  if (loading) return null;

  return (
    <RequireAuth>
      {role === "student" ? children : <Navigate to="/app" replace />}
    </RequireAuth>
  );
}
