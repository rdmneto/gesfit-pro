import { useEffect, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppFrame } from "./components/AppFrame";
import { useSessionStore } from "./store/session";

const ChangeRolePage = lazy(() => import("./pages/ChangeRolePage").then(m => ({ default: m.ChangeRolePage })));
const ClassesPage = lazy(() => import("./pages/ClassesPage").then(m => ({ default: m.ClassesPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const HomePage = lazy(() => import("./pages/HomePage").then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then(m => ({ default: m.LoginPage })));
const MeasurementsPage = lazy(() => import("./pages/MeasurementsPage").then(m => ({ default: m.MeasurementsPage })));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage").then(m => ({ default: m.OnboardingPage })));
const StudentClassesPage = lazy(() => import("./pages/StudentClassesPage").then(m => ({ default: m.StudentClassesPage })));
const StudentProfilePage = lazy(() => import("./pages/StudentProfilePage").then(m => ({ default: m.StudentProfilePage })));
const StudentSettingsPage = lazy(() => import("./pages/StudentSettingsPage").then(m => ({ default: m.StudentSettingsPage })));
const StudentTrainersPage = lazy(() => import("./pages/StudentTrainersPage").then(m => ({ default: m.StudentTrainersPage })));
const TeamLandingPage = lazy(() => import("./pages/TeamLandingPage").then(m => ({ default: m.TeamLandingPage })));
const TeamsPage = lazy(() => import("./pages/TeamsPage").then(m => ({ default: m.TeamsPage })));
const TrainerWorkspacePage = lazy(() => import("./pages/TrainerWorkspacePage").then(m => ({ default: m.TrainerWorkspacePage })));
const TrainingPage = lazy(() => import("./pages/TrainingPage").then(m => ({ default: m.TrainingPage })));

function GlobalLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
        <p className="text-sm text-stone-400">Carregando...</p>
      </div>
    </div>
  );
}

export default function App() {
  const startSession = useSessionStore((state) => state.start);

  useEffect(() => startSession(), [startSession]);

  return (
    <BrowserRouter>
      <Suspense fallback={<GlobalLoader />}>
        <Routes>
          <Route element={<AppFrame />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="treinadores" element={<TeamsPage />} />
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
            <Route path="app/treinos" element={<RequireTrainer><TrainingPage /></RequireTrainer>} />
            <Route path="app/alunos" element={<RequireTrainer><MeasurementsPage /></RequireTrainer>} />
            <Route path="app/ajustes" element={<RequireAuth><AjustesRoute /></RequireAuth>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Ajustes é compartilhado: treinador vê o workspace; aluno vê o hub de ajustes.
function AjustesRoute() {
  const role = useSessionStore((state) => state.claims.role);
  if (role === "trainer") return <TrainerWorkspacePage />;
  return <StudentSettingsPage />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSessionStore((state) => state.user);
  const loading = useSessionStore((state) => state.loading);

  if (loading) {
    return <GlobalLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
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

  return <>{children}</>;
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
