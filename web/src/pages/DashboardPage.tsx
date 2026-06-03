import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  List,
  Play,
  Ruler,
  Share2,
  Timer,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import {
  sampleMeasurements,
  sampleStudent,
  sampleStudents,
  sampleTeams,
  sampleWorkoutSessions,
} from "../data/sample";
import { bmi } from "../lib/format";
import { useSessionStore } from "../store/session";
import type { WorkoutSession } from "../types/domain";
import { KpiGrid } from "../features/dashboard/KpiGrid";
import { TrainerWorkoutCard } from "../features/dashboard/TrainerWorkoutCard";
import {
  type CalendarView,
  type CalendarMode,
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTime,
  getTrainerCalendarItems,
  isSameDay,
  monthGridDays,
  monthItems,
  trainerDaySlots,
  weekDays,
  workoutAtSlot,
} from "../features/dashboard/dashboardUtils";
import {
  useTeam,
  useStudent,
  useMeasurements,
  useWorkoutSessions,
  useStudents,
} from "../lib/hooks";
import { OnboardingPage } from "./OnboardingPage";

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
    return <OnboardingPage />;
  }

  return role === "trainer" ? <TrainerDashboard /> : <StudentDashboard />;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function StudentDashboard() {
  const user = useSessionStore((state) => state.user);
  const isDemo = useSessionStore((state) => state.isDemo);
  const teamIdLocal = useSessionStore((state) => state.claims.teamId);

  // Firestore hooks (só consultam se não for demo)
  const { data: dbStudent, loading: studentLoading } = useStudent(!isDemo && user ? user.uid : null);
  const { data: dbMeasurements, loading: measureLoading } = useMeasurements(!isDemo && user ? user.uid : null);
  const { data: dbWorkoutSessions, loading: workoutsLoading } = useWorkoutSessions(
    !isDemo && user ? { studentId: user.uid } : {}
  );
  
  const studentAssignedTeamId = dbStudent?.assignedTo || teamIdLocal;
  const { data: dbTeam } = useTeam(!isDemo ? studentAssignedTeamId : null);

  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [completedWorkout, setCompletedWorkout] = useState<WorkoutSession | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [calories, setCalories] = useState(0);

  const defaultBranding = {
    bannerPhotoURL: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80",
    primaryColor: "#0f766e",
    secondaryColor: "#f59e0b",
    welcomeMessage: "Bem-vindo!",
    bio: "",
  };

  const student = isDemo 
    ? sampleStudent 
    : (dbStudent || { uid: user?.uid || "", displayName: user?.displayName || "Aluno", physiological: { alturaCm: 175 } });
  
  const team = isDemo 
    ? sampleTeams[0] 
    : (dbTeam 
        ? { ...dbTeam, branding: { ...defaultBranding, ...dbTeam.branding } } 
        : { name: "Sem Treinador Vinculado", branding: defaultBranding });

  const measurements = isDemo ? sampleMeasurements : dbMeasurements;
  const workouts = isDemo ? sampleWorkoutSessions : dbWorkoutSessions;

  const nextWorkout = workouts && workouts.length > 0 ? workouts[0] : null;
  const currentMeasure = measurements && measurements.length > 0 ? measurements.at(-1) : null;
  const alturaCm = student.physiological?.alturaCm || 175;
  const currentBmi = currentMeasure ? bmi(currentMeasure.weightKg, alturaCm) : null;
  const calendarItems = calendarView === "week" ? workouts : monthItems(workouts);

  const measureChart = useMemo(
    () => measurements.map((m) => ({
      date: formatShortDate(m.measuredAt),
      peso: m.weightKg,
      cintura: m.waistCm,
      gordura: m.bodyFatPercent || 0,
    })),
    [measurements],
  );

  const loading = !isDemo && (studentLoading || measureLoading || workoutsLoading);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando dados do aluno...</p>
        </div>
      </div>
    );
  }

  function startWorkout(workout: WorkoutSession) {
    setActiveWorkout(workout);
    setCompletedWorkout(null);
    setDurationMinutes(workout.durationMinutes);
    setCalories(workout.plannedCalories);
  }

  function finishWorkout() {
    setCompletedWorkout(activeWorkout);
    setActiveWorkout(null);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      {/* Hero */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section
          className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950 text-white"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(12,19,16,0.92), rgba(12,19,16,0.5)), url(${team.branding.bannerPhotoURL})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Painel do aluno</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>Hoje e sua rotina</h1>
            <p className="mt-3 max-w-2xl leading-7 text-stone-200">
              {student.displayName}, seu próximo treino está pronto com {team.name}.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <HeroMetric icon={Clock} label="Próximo treino" value={nextWorkout ? formatDateTime(nextWorkout.startsAt) : "Sem treinos"} />
              <HeroMetric icon={Flame} label="Meta cal." value={nextWorkout ? `${nextWorkout.plannedCalories} kcal` : "–"} />
              <HeroMetric icon={Ruler} label="IMC atual" value={currentBmi ? `${currentBmi}` : "–"} />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <CalendarClock aria-hidden="true" className="text-emerald-700" size={16} />
            </div>
            <h2 className="text-lg font-black text-stone-950">Próximo treino</h2>
          </div>
          {nextWorkout ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{nextWorkout.modality}</p>
              <h3 className="mt-1 text-2xl font-black text-stone-950">{nextWorkout.title}</h3>
              <p className="mt-2 text-sm text-stone-600">{formatDateTime(nextWorkout.startsAt)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {nextWorkout.exercises?.map((e) => (
                  <span key={e} className="badge badge-green">{e}</span>
                ))}
              </div>
              <button
                type="button"
                className="focus-ring btn btn-primary mt-5 w-full"
                onClick={() => startWorkout(nextWorkout)}
              >
                <Play aria-hidden="true" size={18} />
                Iniciar treino
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-stone-200 p-8 text-center bg-stone-50">
              <p className="text-sm font-semibold text-stone-500">Nenhum treino agendado.</p>
              <p className="mt-1 text-xs text-stone-400">Entre em contato com seu treinador para planejar seu próximo treino.</p>
            </div>
          )}
        </section>
      </div>

      {/* Calendar + Chart */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="card p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-black text-stone-950">Agenda visual</h2>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-stone-100 p-1">
              {(["week", "month"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  className={[
                    "focus-ring h-8 rounded-md px-3 text-sm font-semibold transition-all",
                    calendarView === view ? "bg-white text-emerald-900 shadow-sm" : "text-stone-500",
                  ].join(" ")}
                  onClick={() => setCalendarView(view)}
                >
                  {view === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 stagger">
            {calendarItems.map((workout) => (
              <article key={workout.id} className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:grid-cols-[6rem_1fr_auto]">
                <div>
                  <p className="text-sm font-bold text-emerald-700">
                    {new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(workout.startsAt))}
                  </p>
                  <p className="text-xl font-black text-stone-950">
                    {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(workout.startsAt))}
                  </p>
                </div>
                <div>
                  <p className="font-black text-stone-950">{workout.title}</p>
                  <p className="mt-1 text-sm text-stone-500">{workout.modality} · {workout.durationMinutes} min</p>
                </div>
                <button
                  type="button"
                  className="focus-ring btn btn-secondary btn-sm h-10"
                  onClick={() => startWorkout(workout)}
                >
                  <Play aria-hidden="true" size={15} />
                  Iniciar
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-black text-stone-950">Progressão das medidas</h2>
              <p className="mt-1 text-sm text-stone-500">Peso, cintura e gordura corporal.</p>
            </div>
            <Link className="focus-ring btn btn-secondary btn-sm" to="/app/medidas">Atualizar</Link>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={measureChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" />
                <XAxis dataKey="date" stroke="#57534e" tick={{ fontSize: 12 }} />
                <YAxis stroke="#57534e" yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 50]} stroke="#2563eb" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="peso" name="Peso (kg)" stroke="#047857" strokeWidth={3} dot={{ r: 4 }} />
                <Line yAxisId="left" type="monotone" dataKey="cintura" name="Cintura (cm)" stroke="#be123c" strokeWidth={3} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="gordura" name="Gordura (%)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Active workout panel */}
      {activeWorkout && (
        <section className="mt-4 card p-5 animate-slide-up">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="flex items-center gap-2">
                <Timer aria-hidden="true" className="text-emerald-700" size={20} />
                <h2 className="text-lg font-black text-stone-950">Treino em andamento</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Edite os dados antes de finalizar.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Tempo (min)</span>
                  <input className="input mt-2" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Calorias</span>
                  <input className="input mt-2" type="number" value={calories} onChange={(e) => setCalories(Number(e.target.value))} />
                </label>
              </div>
              <button type="button" className="focus-ring btn btn-primary mt-5" onClick={finishWorkout}>
                <CheckCircle2 aria-hidden="true" size={18} />
                Finalizar treino
              </button>
            </div>
            <WorkoutSummaryCard calories={calories} durationMinutes={durationMinutes} workout={activeWorkout} />
          </div>
        </section>
      )}

      {/* Instagram share panel */}
      {completedWorkout && (
        <section className="mt-4 card p-5 animate-slide-up">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="flex items-center gap-2">
                <Share2 aria-hidden="true" className="text-emerald-700" size={20} />
                <h2 className="text-lg font-black text-stone-950">Resumo para Instagram</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Card no formato 4:5, ideal para o feed.
              </p>
              <button type="button" className="focus-ring btn mt-5" style={{ background: "#000", color: "#fff" }}>
                <Share2 aria-hidden="true" size={18} />
                Postar no Instagram
              </button>
            </div>
            <WorkoutSummaryCard calories={calories} durationMinutes={durationMinutes} workout={completedWorkout} />
          </div>
        </section>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function TrainerDashboard() {
  const user = useSessionStore((state) => state.user);
  const isDemo = useSessionStore((state) => state.isDemo);
  const teamId = useSessionStore((state) => state.claims.teamId);

  // Firestore hooks
  const { data: dbTeam, loading: teamLoading } = useTeam(!isDemo ? teamId : null);
  const { data: dbStudents, loading: studentsLoading } = useStudents(!isDemo ? user?.uid : null);
  const { data: dbWorkoutSessions, loading: workoutsLoading } = useWorkoutSessions(
    !isDemo && user ? { trainerId: user.uid } : {}
  );

  const [calendarView, setCalendarView] = useState<CalendarView>("day");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("visual");
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);

  const defaultBranding = {
    bannerPhotoURL: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80",
    primaryColor: "#0f766e",
    secondaryColor: "#f59e0b",
    welcomeMessage: "Foco nos treinos!",
    bio: "",
  };

  const team = isDemo 
    ? sampleTeams[0] 
    : (dbTeam 
        ? { ...dbTeam, branding: { ...defaultBranding, ...dbTeam.branding } } 
        : { name: "Meu Time", branding: defaultBranding });

  const trainerWorkouts = useMemo(() => {
    const list = isDemo 
      ? sampleWorkoutSessions.filter((w) => w.trainerId === "trainer-ana") 
      : dbWorkoutSessions;
    return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [isDemo, dbWorkoutSessions]);

  const students = isDemo ? sampleStudents : dbStudents;

  const todayWorkouts = trainerWorkouts.filter((w) => isSameDay(w.startsAt, new Date()));
  const visibleWorkouts = getTrainerCalendarItems(trainerWorkouts, calendarView);
  const nextWorkouts = trainerWorkouts.filter((w) => new Date(w.startsAt).getTime() >= Date.now()).slice(0, 5);
  const totalMinutesToday = todayWorkouts.reduce((s, w) => s + w.durationMinutes, 0);
  const uniqueStudentsToday = new Set(todayWorkouts.map((w) => w.studentId)).size;

  const loading = !isDemo && (teamLoading || studentsLoading || workoutsLoading);

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

      {/* KPI Grid */}
      <KpiGrid studentCount={students.length} />

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

      {/* Calendar */}
      <section className="mt-4 card p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-lg font-black text-stone-950">Agenda do treinador</h2>
            <p className="mt-1 text-sm text-stone-500">Alterne entre dia, semana e mês, em cards visuais ou lista.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-stone-100 p-1">
              {(["day", "week", "month"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  className={["focus-ring h-8 rounded-md px-3 text-sm font-semibold transition-all", calendarView === view ? "bg-white text-emerald-900 shadow-sm" : "text-stone-500"].join(" ")}
                  onClick={() => { setCalendarView(view); setSelectedMonthDay(null); }}
                >
                  {view === "day" ? "Dia" : view === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-stone-100 p-1">
              {(["visual", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={["focus-ring inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-all", calendarMode === mode ? "bg-white text-emerald-900 shadow-sm" : "text-stone-500"].join(" ")}
                  onClick={() => setCalendarMode(mode)}
                >
                  {mode === "visual" ? <CalendarDays size={14} /> : <List size={14} />}
                  {mode === "visual" ? "Visual" : "Lista"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {calendarMode === "visual" ? (
          <TrainerCalendarVisual
            selectedMonthDay={selectedMonthDay}
            view={calendarView}
            workouts={trainerWorkouts}
            activeWorkoutId={activeWorkout?.id}
            onCloseMonthDay={() => setSelectedMonthDay(null)}
            onFinish={() => setActiveWorkout(null)}
            onSelectMonthDay={setSelectedMonthDay}
            onStart={setActiveWorkout}
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <Th>Horário</Th><Th>Aluno</Th><Th>Endereço</Th><Th>Treino proposto</Th><Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {visibleWorkouts.map((workout) => (
                  <tr key={workout.id}>
                    <Td>{formatDateTime(workout.startsAt)}</Td>
                    <Td>{workout.studentName}</Td>
                    <Td>{workout.address}</Td>
                    <Td>{workout.proposedWorkout ?? workout.title}</Td>
                    <Td>
                      <button
                        type="button"
                        className={["focus-ring inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-bold text-white", activeWorkout?.id === workout.id ? "bg-stone-950" : "bg-emerald-700"].join(" ")}
                        onClick={() => activeWorkout?.id === workout.id ? setActiveWorkout(null) : setActiveWorkout(workout)}
                      >
                        {activeWorkout?.id === workout.id ? <CheckCircle2 size={13} /> : <Play size={13} />}
                        {activeWorkout?.id === workout.id ? "Finalizar" : "Iniciar"}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function WorkoutSummaryCard({ workout, durationMinutes, calories }: { workout: WorkoutSession; durationMinutes: number; calories: number }) {
  const chartData = [
    { label: "Tempo", value: durationMinutes },
    { label: "Cal.", value: Math.round(calories / 8) },
    { label: "Exerc.", value: workout.exercises.length * 12 },
  ];
  return (
    <div className="mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-xl bg-stone-950 p-5 text-white">
      <div
        className="flex h-full flex-col justify-between rounded-lg p-5"
        style={{ backgroundImage: "linear-gradient(180deg, rgba(4,120,87,0.95), rgba(12,19,16,0.96))" }}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Treino concluído</p>
          <h3 className="mt-2 text-3xl font-black leading-tight">{workout.title}</h3>
          <p className="mt-2 text-sm text-emerald-100">{workout.modality}</p>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <Area type="monotone" dataKey="value" fill="#fbbf24" stroke="#fde68a" strokeWidth={3} />
              <XAxis dataKey="label" stroke="#ecfdf5" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs text-emerald-100">Tempo</p>
            <p className="text-2xl font-black">{durationMinutes} min</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs text-emerald-100">Calorias</p>
            <p className="text-2xl font-black">{calories}</p>
          </div>
        </div>
        <p className="text-xs font-bold text-emerald-200">Gesfit Pro</p>
      </div>
    </div>
  );
}

// Calendar visual (week/month/day views) — kept inline as it's tightly coupled to the dashboard state
function TrainerCalendarVisual({
  view, workouts, selectedMonthDay, activeWorkoutId,
  onCloseMonthDay, onFinish, onSelectMonthDay, onStart,
}: {
  view: CalendarView; workouts: WorkoutSession[]; selectedMonthDay: Date | null;
  activeWorkoutId?: string; onCloseMonthDay: () => void; onFinish: () => void;
  onSelectMonthDay: (d: Date) => void; onStart: (w: WorkoutSession) => void;
}) {
  if (view === "week") {
    const days = weekDays(new Date());
    return (
      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7 gap-2">
          {days.map((day) => {
            const dayWorkouts = workouts.filter((w) => isSameDay(w.startsAt, day));
            return (
              <section key={day.toISOString()} className="min-h-64 rounded-xl border border-[var(--color-border)] bg-stone-50 p-2">
                <div className="rounded-lg bg-white p-2 text-center">
                  <p className="text-xs font-bold uppercase text-emerald-700">{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day)}</p>
                  <p className="text-2xl font-black text-stone-950">{day.getDate()}</p>
                </div>
                <div className="mt-2 space-y-2">
                  {dayWorkouts.length ? dayWorkouts.map((workout) => {
                    const isActive = activeWorkoutId === workout.id;
                    return (
                      <article key={workout.id} className="rounded-lg border border-[var(--color-border)] bg-white p-2 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <strong>{formatTime(workout.startsAt)}</strong>
                          <span className="badge badge-green">{workout.modality}</span>
                        </div>
                        <p className="mt-1.5 font-bold text-stone-950">{workout.studentName}</p>
                        <p className="mt-1 line-clamp-2 text-stone-500">{workout.proposedWorkout ?? workout.title}</p>
                        <button
                          type="button"
                          className={["focus-ring mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg text-xs font-bold text-white", isActive ? "bg-stone-950" : "bg-emerald-700"].join(" ")}
                          onClick={() => isActive ? onFinish() : onStart(workout)}
                        >
                          {isActive ? <CheckCircle2 size={12} /> : <Play size={12} />}
                          {isActive ? "Finalizar" : "Iniciar"}
                        </button>
                      </article>
                    );
                  }) : (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-center text-xs font-semibold text-emerald-700">Livre</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "month") {
    const today = new Date();
    const days = monthGridDays(today);
    const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    if (selectedMonthDay) {
      const dayWorkouts = workouts.filter((w) => isSameDay(w.startsAt, selectedMonthDay));
      return (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-stone-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Agenda do dia</p>
              <h3 className="mt-1 text-2xl font-black text-stone-950">{formatDate(selectedMonthDay.toISOString())}</h3>
            </div>
            <button type="button" aria-label="Fechar" className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white" onClick={onCloseMonthDay}>
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {trainerDaySlots.map((slot) => {
              const workout = workoutAtSlot(dayWorkouts, slot);
              const isActive = activeWorkoutId === workout?.id;
              return (
                <article key={slot} className={["grid gap-3 rounded-xl border p-3 sm:grid-cols-[5rem_1fr_auto]", workout ? "border-red-100 bg-red-50" : "border-emerald-100 bg-emerald-50"].join(" ")}>
                  <p className={["font-black", workout ? "text-red-800" : "text-emerald-800"].join(" ")}>{slot}</p>
                  {workout ? (
                    <div>
                      <p className="font-black text-stone-950">{workout.studentName}</p>
                      <p className="mt-1 text-sm text-stone-600">{workout.proposedWorkout ?? workout.title}</p>
                    </div>
                  ) : <p className="font-semibold text-emerald-700">Horário vago</p>}
                  {workout && (
                    <button
                      type="button"
                      className={["focus-ring inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-white", isActive ? "bg-stone-950" : "bg-emerald-700"].join(" ")}
                      onClick={() => isActive ? onFinish() : onStart(workout)}
                    >
                      {isActive ? <CheckCircle2 size={14} /> : <Play size={14} />}
                      {isActive ? "Finalizar" : "Iniciar"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <div className="grid grid-cols-7 gap-1">
          {WEEK_LABELS.map((d) => (
            <p key={d} className="py-2 text-center text-xs font-bold text-stone-400">{d}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayWorkouts = workouts.filter((w) => isSameDay(w.startsAt, day));
            const inCurrentMonth = day.getMonth() === today.getMonth();
            return (
              <button
                key={day.toISOString()}
                type="button"
                className={["focus-ring min-h-20 rounded-lg border p-1 text-left transition-all", inCurrentMonth ? "border-[var(--color-border)] bg-white hover:border-emerald-500" : "border-[var(--color-border-subtle)] bg-stone-50 opacity-50"].join(" ")}
                onClick={() => onSelectMonthDay(day)}
              >
                <span className="text-xs font-black text-stone-700">{day.getDate()}</span>
                <div className="mt-1 space-y-0.5">
                  {trainerDaySlots.map((slot) => {
                    const occupied = Boolean(workoutAtSlot(dayWorkouts, slot));
                    return <span key={slot} className={["block h-2.5 rounded-sm", occupied ? "bg-red-400" : "bg-emerald-300"].join(" ")} title={`${slot} ${occupied ? "ocupado" : "vago"}`} />;
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Day view
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {getTrainerCalendarItems(workouts, "day").map((workout) => (
        <TrainerWorkoutCard
          activeWorkoutId={activeWorkoutId}
          key={workout.id}
          onFinish={onFinish}
          onStart={onStart}
          workout={workout}
        />
      ))}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="border-b border-stone-200 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-stone-500">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-stone-100 px-3 py-3.5 align-top text-sm text-stone-700">{children}</td>;
}
