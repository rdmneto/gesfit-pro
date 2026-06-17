import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Timer,
  Users,
  Play,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useSessionStore } from "../store/session";
import { KpiGrid } from "../features/dashboard/KpiGrid";
import { ActiveTrainingDetails } from "../features/dashboard/ActiveTrainingDetails";
import {
  formatDate,
  formatDateTime,
  formatFriendlyDateTime,
} from "../features/dashboard/dashboardUtils";
import { useAttendance } from "../features/dashboard/useAttendance";
import { AlertCircle, FileX } from "lucide-react";
import { useCollection, usePendingPurchases } from "../lib/hooks";
import { PendingPurchasesList } from "../features/dashboard/PendingPurchasesList";
import { where } from "firebase/firestore";
import type { Training } from "../types/domain";

export function DashboardPage() {
  const role = useSessionStore((state) => state.claims.role);
  const loading = useSessionStore((state) => state.loading);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/app/onboarding" replace />;
  }

  // O painel é exclusivo do treinador. O aluno usa a aba "Aulas" como início.
  if (role === "trainer") return <TrainerDashboard />;
  return <Navigate to="/app/minhas-aulas" replace />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

import { useDashboardMetrics } from "../features/dashboard/useDashboardMetrics";

function TrainerDashboard() {
  const user = useSessionStore((state) => state.user);
  const teamId = useSessionStore((state) => state.claims.teamId);

  const { data: trainingsData } = useCollection<Training>(
    "trainings",
    user ? [where("trainerId", "==", user.uid)] : [],
    [],
    [user?.uid]
  );
  const trainings = trainingsData || [];

  const { startSession, completeSession, markNoShow } = useAttendance();

  const {
    loading: metricsLoading,
    team,
    pendingRequestCount,
    unfinishedPastWorkouts,
    todayWorkouts,
    nextWorkouts,
    totalMinutesToday,
    uniqueStudentsToday,
    monthRevenue,
    presenceRate,
    noShowCount,
    remainingCreditsCount,
    activeStudents,
    subTrainersPerformance,
  } = useDashboardMetrics(user?.uid, teamId);

  const { data: pendingPurchases } = usePendingPurchases(teamId);
  const pendingPurchasesCount = pendingPurchases?.length ?? 0;

  if (metricsLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="h-64 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-64 rounded-xl bg-stone-100 animate-pulse" />
        </div>
        <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
        </div>
        <div className="mt-4 h-[400px] rounded-xl bg-stone-100 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      {/* Hero */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Banner Hero com visual Premium/Glassmorphism para o próximo treino */}
        <section
          className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-950 text-white min-h-[18rem] sm:min-h-[22rem] flex flex-col justify-between"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(12,19,16,0.95), rgba(12,19,16,0.6)), url(${team?.branding?.bannerPhotoURL})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="p-6 sm:p-8 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Painel do treinador</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl text-white tracking-tight leading-tight">Agenda e treinos do dia</h1>
            <div className="mt-6 flex flex-wrap gap-4">
              <HeroMetric icon={CalendarClock} label="Treinos hoje" value={`${todayWorkouts.length}`} />
              <HeroMetric icon={Users} label="Alunos hoje" value={`${uniqueStudentsToday}`} />
              <HeroMetric icon={Timer} label="Carga do dia" value={`${totalMinutesToday} min`} />
            </div>
          </div>
          
          {nextWorkouts[0] && (
            <div className="backdrop-blur-md bg-white/10 border-t border-white/20 p-5 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12}/> Próximo atendimento</p>
                  <h3 className="text-lg font-black text-white mt-1">{nextWorkouts[0].studentName}</h3>
                  <p className="text-sm text-stone-300">{formatFriendlyDateTime(nextWorkouts[0].startsAt)} · {nextWorkouts[0].proposedWorkout ?? nextWorkouts[0].title}</p>
                </div>
                {nextWorkouts[0].status === 'in_progress' ? (
                  <button
                    type="button"
                    className="focus-ring flex h-10 px-4 items-center gap-2 rounded-lg bg-stone-800 text-sm font-bold text-white transition-all hover:bg-stone-700"
                    onClick={() => {
                      completeSession(nextWorkouts[0]);
                    }}
                  >
                    <CheckCircle2 size={16} /> Finalizar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="focus-ring flex h-10 px-4 items-center gap-2 rounded-lg bg-emerald-500 text-sm font-bold text-white transition-all hover:bg-emerald-400"
                    onClick={() => {
                      startSession(nextWorkouts[0]);
                    }}
                  >
                    <Play size={16} className="fill-white" /> Iniciar
                  </button>
                )}
              </div>
              {nextWorkouts[0].status === 'in_progress' && nextWorkouts[0].trainingId && (
                <div className="mt-4 pt-1 border-t border-white/10 brightness-110 contrast-125">
                  <ActiveTrainingDetails training={trainings.find(t => t.id === nextWorkouts[0].trainingId)} />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Unfinished Workouts Alert */}
      {unfinishedPastWorkouts.length > 0 && (
        <section className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-rose-600" size={20} />
            <h2 className="text-lg font-black text-rose-950">Treinos não finalizados</h2>
          </div>
          <p className="mt-1 text-sm text-rose-800">Você tem {unfinishedPastWorkouts.length} aula(s) que já passaram mas ainda não tiveram o status atualizado.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
            {unfinishedPastWorkouts.map(workout => (
              <article key={workout.id} className="rounded-xl border border-rose-200 bg-white p-4">
                <p className="text-sm font-bold text-rose-700">{formatDateTime(workout.startsAt)}</p>
                <h3 className="mt-1 font-black text-stone-950">{workout.studentName}</h3>
                <div className="mt-4 flex flex-col gap-2">
                  <button onClick={() => completeSession(workout)} className="focus-ring flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">
                    <CheckCircle2 size={16} />
                    Finalizar (Debitar)
                  </button>
                  <button onClick={() => markNoShow(workout)} className="focus-ring flex h-9 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 text-sm font-bold text-stone-600 hover:bg-stone-100 transition-colors">
                    <FileX size={16} />
                    Falta (Não realizado)
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Solicitações de vínculo pendentes */}
      {pendingRequestCount > 0 && (
        <Link
          to="/app/alunos"
          className="focus-ring mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100"
        >
          <p className="text-sm font-semibold text-amber-800">
            {pendingRequestCount} alun{pendingRequestCount > 1 ? "os" : "o"} aguardando sua aprovação.
          </p>
          <span className="text-sm font-bold text-amber-900">Revisar →</span>
        </Link>
      )}

      {/* Compras pendentes */}
      {pendingPurchasesCount > 0 && (
        <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-emerald-950">
              Pagamentos aguardando confirmação ({pendingPurchasesCount})
            </h2>
          </div>
          <p className="mt-1 text-sm text-emerald-800 mb-4">
            Você tem pagamentos pendentes de conferência. Confirme-os para liberar os créditos.
          </p>
          <PendingPurchasesList teamId={teamId} />
        </section>
      )}

      {/* KPI Grid */}
      <KpiGrid
        studentCount={activeStudents.length}
        estimatedRevenue={monthRevenue}
        presenceRate={presenceRate}
        noShowCount={noShowCount}
        remainingCreditsCount={remainingCreditsCount}
      />

      {/* Desempenho da Equipe */}
      {subTrainersPerformance && subTrainersPerformance.length > 0 && (
        <section className="mt-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-emerald-700" size={20} />
            <h2 className="text-lg font-black text-stone-950">Desempenho da Equipe (Mês atual)</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subTrainersPerformance.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 p-3">
                <span className="text-sm font-bold text-stone-700">{sub.name}</span>
                <span className="inline-flex h-7 items-center justify-center rounded-full bg-emerald-100 px-3 text-xs font-black text-emerald-800">
                  {sub.completed} aula{sub.completed !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Linha do Tempo: Alunos do dia */}
      <section className="mt-6 card p-5 sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-xl font-black text-stone-950 tracking-tight">Linha do tempo (Hoje)</h2>
            <p className="mt-1 text-sm text-stone-500">Acompanhe sua agenda em formato cronológico.</p>
          </div>
          <span className="badge badge-green text-sm px-3 py-1.5 font-bold shadow-sm">{formatDate(new Date().toISOString())}</span>
        </div>
        
        <div className="mt-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-200 before:to-transparent">
          {todayWorkouts.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-10 italic">Nenhum compromisso marcado para hoje.</p>
          ) : (
            todayWorkouts.map((workout) => {
              const isPast = new Date(workout.startsAt).getTime() < Date.now() && (workout.status === 'scheduled' || workout.status === 'in_progress');
              const isDone = workout.status === 'completed' || workout.status === 'no_show';
              return (
                <div key={workout.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-emerald-100 text-emerald-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors group-hover:bg-emerald-200">
                    <Clock size={16} strokeWidth={2.5} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md hover:border-emerald-200">
                    <div className="flex items-center justify-between mb-1">
                      <div className={["font-bold text-sm", isPast ? "text-rose-600" : "text-emerald-700"].join(" ")}>
                        {formatFriendlyDateTime(workout.startsAt)}
                      </div>
                      <span className={["badge text-3xs font-bold uppercase", isDone ? "bg-stone-100 text-stone-500" : (isPast ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700")].join(" ")}>
                        {isDone ? (workout.status === 'completed' ? "Concluído" : "Falta") : (isPast ? "Atrasado" : "Pendente")}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-stone-900">{workout.studentName}</h3>
                    <p className="text-sm text-stone-500 line-clamp-1">{workout.proposedWorkout ?? workout.title}</p>
                    
                    {!isDone && (
                      <div className="mt-4 pt-3 border-t border-stone-100 flex gap-2">
                        {workout.status === 'in_progress' ? (
                          <button onClick={() => completeSession(workout)} className="focus-ring flex-1 h-9 rounded-lg bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors">
                            Finalizar agora
                          </button>
                        ) : (
                          <button onClick={() => startSession(workout)} className="focus-ring flex-1 h-9 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors shadow-sm">
                            Iniciar treino
                          </button>
                        )}
                      </div>
                    )}
                    {workout.status === 'in_progress' && workout.trainingId && (
                      <ActiveTrainingDetails training={trainings.find(t => t.id === workout.trainingId)} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>


      {/* Next workouts list */}
      <section className="mt-4 card p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
            <CalendarClock aria-hidden="true" className="text-emerald-700" size={16} />
          </div>
          <h2 className="text-lg font-black text-stone-950">Próximos treinos</h2>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2 stagger">
          {nextWorkouts.map((workout) => (
            <article key={workout.id} className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-black text-stone-950">{workout.studentName}</p>
                <p className="mt-1 text-sm text-stone-500">{formatFriendlyDateTime(workout.startsAt)}</p>
                <p className="mt-2 text-sm font-semibold text-stone-700">{workout.proposedWorkout ?? workout.title}</p>
                <p className="mt-1 text-xs text-stone-400">{workout.address}</p>
              </div>
              <span className="badge badge-stone h-max">{workout.modality}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function HeroMetric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
      <Icon aria-hidden="true" className="text-emerald-200" size={20} />
      <p className="mt-2 text-sm text-stone-200">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
