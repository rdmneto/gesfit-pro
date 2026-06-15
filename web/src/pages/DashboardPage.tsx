import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Timer,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useSessionStore } from "../store/session";
import type { WorkoutSession } from "../types/domain";
import { KpiGrid } from "../features/dashboard/KpiGrid";
import { TrainerWorkoutCard } from "../features/dashboard/TrainerWorkoutCard";
import {
  formatDate,
  formatDateTime,
  isSameDay,
} from "../features/dashboard/dashboardUtils";
import {
  useTeam,
  useWorkoutSessions,
  useTrainerStudents,
  useBookings,
  usePaidPurchases,
} from "../lib/hooks";

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

function TrainerDashboard() {
  const user = useSessionStore((state) => state.user);
  const teamId = useSessionStore((state) => state.claims.teamId);

  // Firestore hooks
  const { data: dbTeam, loading: teamLoading } = useTeam(teamId);
  const { data: dbStudents, loading: studentsLoading } = useTrainerStudents(user?.uid);
  const { data: dbWorkoutSessions, loading: workoutsLoading } = useWorkoutSessions(
    user ? { trainerId: user.uid } : {}
  );
  const { data: dbBookings } = useBookings(user ? { trainerId: user.uid } : {});
  const { data: dbPaidPurchases } = usePaidPurchases(teamId);

  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);

  const defaultBranding = {
    bannerPhotoURL: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80",
    primaryColor: "#0f766e",
    secondaryColor: "#f59e0b",
    welcomeMessage: "Foco nos treinos!",
    bio: "",
  };

  const team = dbTeam
    ? { ...dbTeam, branding: { ...defaultBranding, ...dbTeam.branding } }
    : { name: "Meu Time", branding: defaultBranding };

  const trainerWorkouts = useMemo(() => {
    const list = dbWorkoutSessions ?? [];
    return [...list].sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
  }, [dbWorkoutSessions]);

  const students = dbStudents ?? [];
  const bookings = dbBookings ?? [];

  // Alunos com vínculo ativo (a aprovação é por vínculo, não pelo doc do aluno).
  const activeStudents = useMemo(
    () => students.filter((s) => s.enrollment?.status === "active"),
    [students],
  );
  const pendingRequestCount = useMemo(
    () => students.filter((s) => s.enrollment?.status === "pending").length,
    [students],
  );

  const todayWorkouts = trainerWorkouts.filter((w) => isSameDay(w.startsAt, new Date()));
  const nextWorkouts = trainerWorkouts.filter((w) => new Date(w.startsAt).getTime() >= Date.now()).slice(0, 5);
  const totalMinutesToday = todayWorkouts.reduce((s, w) => s + w.durationMinutes, 0);
  const uniqueStudentsToday = new Set(todayWorkouts.map((w) => w.studentId)).size;

  // Faturamento real do mês: soma das compras pagas (PIX confirmado) no mês corrente.
  const monthRevenue = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return (dbPaidPurchases ?? [])
      .filter((p) => String(p.reviewedAt || p.submittedAt || "").startsWith(ym))
      .reduce((sum, p) => sum + (p.amountCents || 0), 0) / 100;
  }, [dbPaidPurchases]);

  const presenceRate = useMemo(() => {
    const pastBookings = bookings.filter((b) => b.status === "attended" || b.status === "no_show");
    if (pastBookings.length === 0) return 100;
    const attended = pastBookings.filter((b) => b.status === "attended").length;
    return Math.round((attended / pastBookings.length) * 100);
  }, [bookings]);

  const noShowCount = useMemo(() => {
    return bookings.filter((b) => b.status === "no_show").length;
  }, [bookings]);

  const expiringCount = useMemo(() => {
    return activeStudents.filter((s) => {
      const quota = s.enrollment?.classesQuota ?? 0;
      const used = s.enrollment?.classesUsed ?? 0;
      const remaining = quota - used;
      return remaining >= 0 && remaining <= 2;
    }).length;
  }, [activeStudents]);

  const loading = teamLoading || studentsLoading || workoutsLoading;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando dados do treinador...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      {/* Hero */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section
          className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950 text-white"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(12,19,16,0.92), rgba(12,19,16,0.45)), url(${team.branding.bannerPhotoURL})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Painel do treinador</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>Agenda e treinos do dia</h1>
            <p className="mt-3 max-w-2xl leading-7 text-stone-200">
              Visualize seus alunos de hoje, inicie treinos rapidamente.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <HeroMetric icon={CalendarClock} label="Treinos hoje" value={`${todayWorkouts.length}`} />
              <HeroMetric icon={Users} label="Alunos hoje" value={`${uniqueStudentsToday}`} />
              <HeroMetric icon={Timer} label="Carga do dia" value={`${totalMinutesToday} min`} />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <Clock aria-hidden="true" className="text-emerald-700" size={16} />
            </div>
            <h2 className="text-lg font-black text-stone-950">Próximo atendimento</h2>
          </div>
          {nextWorkouts[0] ? (
            <TrainerWorkoutCard
              activeWorkoutId={activeWorkout?.id}
              compact={false}
              onFinish={() => setActiveWorkout(null)}
              onStart={setActiveWorkout}
              workout={nextWorkouts[0]}
            />
          ) : (
            <p className="mt-4 text-sm text-stone-500">Nenhum treino agendado.</p>
          )}
        </section>
      </div>

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

      {/* KPI Grid */}
      <KpiGrid
        studentCount={activeStudents.length}
        estimatedRevenue={monthRevenue}
        presenceRate={presenceRate}
        noShowCount={noShowCount}
        expiringCount={expiringCount}
      />

      {/* Alunos do dia */}
      <section className="mt-4 card p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-black text-stone-950">Alunos do dia</h2>
            <p className="mt-1 text-sm text-stone-500">Inicie o treino direto pelo card do aluno.</p>
          </div>
          <span className="badge badge-green text-sm px-3 py-1.5">{formatDate(new Date().toISOString())}</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3 stagger">
          {todayWorkouts.length === 0 ? (
            <p className="text-sm text-stone-400 col-span-full">Nenhum treino para hoje.</p>
          ) : (
            todayWorkouts.map((workout) => (
              <TrainerWorkoutCard
                activeWorkoutId={activeWorkout?.id}
                key={workout.id}
                onFinish={() => setActiveWorkout(null)}
                onStart={setActiveWorkout}
                workout={workout}
              />
            ))
          )}
        </div>
      </section>

      {/* Active workout banner */}
      {activeWorkout && (
        <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 animate-slide-up">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Treino iniciado</p>
              <h2 className="mt-1 text-2xl font-black text-stone-950">{activeWorkout.studentName}</h2>
              <p className="mt-2 text-sm text-stone-600">
                {activeWorkout.proposedWorkout ?? activeWorkout.title} · {formatDateTime(activeWorkout.startsAt)}
              </p>
              <p className="mt-1 text-sm text-stone-500">{activeWorkout.address}</p>
            </div>
            <button type="button" className="focus-ring btn btn-primary" onClick={() => setActiveWorkout(null)}>
              <CheckCircle2 size={18} />
              Finalizar atendimento
            </button>
          </div>
        </section>
      )}

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
                <p className="mt-1 text-sm text-stone-500">{formatDateTime(workout.startsAt)}</p>
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
