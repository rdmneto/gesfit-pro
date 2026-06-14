import { useEffect } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppFrame } from "./components/AppFrame";
import { ChangeRolePage } from "./pages/ChangeRolePage";
import { ClassesPage } from "./pages/ClassesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MeasurementsPage } from "./pages/MeasurementsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { StudentClassesPage } from "./pages/StudentClassesPage";
import { StudentProfilePage } from "./pages/StudentProfilePage";
import { StudentTrainersPage } from "./pages/StudentTrainersPage";
import { TeamLandingPage } from "./pages/TeamLandingPage";
import { TeamsPage } from "./pages/TeamsPage";
import { TrainerWorkspacePage } from "./pages/TrainerWorkspacePage";
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
          {/* Cadastro real acontece em /login (criar conta) + /app/onboarding.
              Rotas antigas redirecionam para não quebrar links existentes. */}
          <Route path="cadastro/aluno" element={<Navigate to="/login?signup=1" replace />} />
          <Route path="cadastro/treinador" element={<Navigate to="/login?signup=1" replace />} />
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

          {/* Authenticated routes — any role */}
          <Route path="app/mudar-perfil" element={<RequireAuth><ChangeRolePage /></RequireAuth>} />

          {/* Authenticated routes — student */}
          <Route path="app" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="app/meus-treinadores" element={<RequireStudent><StudentTrainersPage /></RequireStudent>} />
          <Route path="app/meu-cadastro" element={<RequireStudent><StudentProfilePage /></RequireStudent>} />
          <Route path="app/minhas-aulas" element={<RequireStudent><StudentClassesPage /></RequireStudent>} />
          <Route path="app/medidas" element={<RequireStudent><MeasurementsPage /></RequireStudent>} />

          {/* Authenticated routes — trainer */}
          <Route path="app/agenda" element={<RequireTrainer><ClassesPage /></RequireTrainer>} />
          <Route path="app/aulas" element={<Navigate to="/app/agenda" replace />} />
          <Route path="app/alunos" element={<RequireTrainer><MeasurementsPage /></RequireTrainer>} />
          <Route path="app/ajustes" element={<RequireTrainer><TrainerWorkspacePage /></RequireTrainer>} />
          {/* Rotas antigas → Ajustes (consolidou perfil, pacotes e regras) */}
          <Route path="app/treinador" element={<Navigate to="/app/ajustes" replace />} />
          <Route path="app/pacotes" element={<Navigate to="/app/ajustes" replace />} />
          <Route path="app/seguranca" element={<Navigate to="/app/ajustes" replace />} />
          <Route path="app/configuracoes" element={<Navigate to="/app/ajustes" replace />} />

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
