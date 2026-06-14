import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  List,
  Play,
  UserPlus,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useTeam, useTrainerStudents, useWorkoutSessions } from "../lib/hooks";
import { DEFAULT_AVAILABILITY } from "../data/catalog";
import {
  type CalendarView,
  type CalendarMode,
  formatDate,
  formatDateTime,
  formatTime,
  getTrainerCalendarItems,
  isSameDay,
  monthGridDays,
  weekDays,
  workoutAtSlot,
} from "../features/dashboard/dashboardUtils";
import type { WorkoutSession, TrainerAvailabilityDay } from "../types/domain";

export function ClassesPage() {
  const teamId = useSessionStore((state) => state.claims.teamId);
  const user = useSessionStore((state) => state.user);

  // Firestore hooks
  const { data: dbTeam } = useTeam(teamId);
  const { data: dbStudents } = useTrainerStudents(user?.uid);
  const { data: dbWorkoutSessions } = useWorkoutSessions(
    user ? { trainerId: user.uid } : {}
  );

  const students = (dbStudents ?? []).filter((s) => s.enrollment?.status === "active");
  const trainerWorkouts = useMemo(() => {
    const list = dbWorkoutSessions ?? [];
    return [...list].sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
  }, [dbWorkoutSessions]);

  const availability: TrainerAvailabilityDay[] = dbTeam?.availability || DEFAULT_AVAILABILITY;

  // Calendar states
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("visual");
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);

  // Schedule class states
  const [selectedStudentIdx, setSelectedStudentIdx] = useState(0);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("60");
  const [scheduleFocus, setScheduleFocus] = useState("Musculação - Inferiores");
  const [recurrence, setRecurrence] = useState<"single" | "weekly" | "biweekly">("single");
  const [occurrences, setOccurrences] = useState("8");
  // Slot clicado na grade → abre o modal de agendamento rápido
  const [schedulerSlot, setSchedulerSlot] = useState<{ date: string; time: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleWorkouts = getTrainerCalendarItems(trainerWorkouts, calendarView);
  const nextWorkouts = trainerWorkouts.filter((w) => new Date(w.startsAt).getTime() >= Date.now()).slice(0, 5);

  // Highlights / statistics
  const weeklyWorkoutsCount = useMemo(() => {
    const today = new Date();
    const days = weekDays(today);
    const start = days[0];
    const end = new Date(days[6]);
    end.setHours(23, 59, 59);
    return trainerWorkouts.filter((w) => {
      const d = new Date(w.startsAt);
      return d >= start && d <= end;
    }).length;
  }, [trainerWorkouts]);

  const todayWorkouts = trainerWorkouts.filter((w) => isSameDay(w.startsAt, new Date()));
  const todayDuration = todayWorkouts.reduce((s, w) => s + w.durationMinutes, 0);

  const busiestHour = useMemo(() => {
    if (trainerWorkouts.length === 0) return "–";
    const counts: Record<string, number> = {};
    trainerWorkouts.forEach((w) => {
      const time = w.startsAt.split("T")[1]?.slice(0, 5) || "06:00";
      counts[time] = (counts[time] || 0) + 1;
    });
    let maxTime = "–";
    let maxCount = 0;
    Object.entries(counts).forEach(([time, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxTime = time;
      }
    });
    return maxTime;
  }, [trainerWorkouts]);

  // Duração padrão da aula no dia (da grade) — usada no agendamento por clique.
  function durationForDate(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00`);
    const weekdays: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const day = availability.find((a) => a.weekday === weekdays[d.getDay()]);
    return day?.classDurationMinutes ?? 60;
  }

  // Cria 1 (única) ou N aulas (semanal/quinzenal) a partir de um horário base.
  async function createSessions(opts: {
    student: { uid: string; displayName: string };
    dateStr: string;
    timeStr: string;
    durationMin: number;
    focus: string;
  }): Promise<boolean> {
    if (!db) {
      setError("Banco de dados indisponível no momento.");
      return false;
    }
    const base = new Date(`${opts.dateStr}T${opts.timeStr}`);
    if (isNaN(base.getTime())) {
      setError("Data ou hora inválida.");
      return false;
    }
    const stepDays = recurrence === "weekly" ? 7 : recurrence === "biweekly" ? 14 : 0;
    const count = recurrence === "single" ? 1 : Math.max(1, parseInt(occurrences, 10) || 1);
    const focus = opts.focus.trim() || "Treino";

    const sessions: Omit<WorkoutSession, "id">[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + stepDays * i);
      sessions.push({
        studentId: opts.student.uid,
        studentName: opts.student.displayName,
        trainerId: user?.uid || "",
        title: `Treino de ${focus}`,
        modality: "Musculação",
        startsAt: d.toISOString(),
        address: "",
        proposedWorkout: focus,
        durationMinutes: opts.durationMin,
        plannedCalories: 320,
        status: "scheduled",
        exercises: [focus],
      });
    }

    try {
      await Promise.all(sessions.map((s) => addDoc(collection(db!, "workoutSessions"), s)));
      return true;
    } catch (err: any) {
      console.error(err);
      setError("Erro ao agendar: " + err.message);
      return false;
    }
  }

  // Agendamento pelo formulário lateral
  async function handleScheduleClass() {
    const student = students[selectedStudentIdx];
    if (!student || !scheduleDate || !scheduleTime) {
      setError("Por favor, preencha o aluno, data e hora do agendamento.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const ok = await createSessions({
      student,
      dateStr: scheduleDate,
      timeStr: scheduleTime,
      durationMin: parseInt(scheduleDuration, 10) || 60,
      focus: scheduleFocus,
    });
    setSaving(false);
    if (ok) {
      setMessage(recurrence === "single" ? "Aula agendada com sucesso!" : "Aulas recorrentes agendadas!");
      setScheduleDate("");
      setScheduleTime("");
    }
  }

  // Agendamento rápido pelo clique no horário da grade
  async function handleScheduleSlot() {
    if (!schedulerSlot) return;
    const student = students[selectedStudentIdx];
    if (!student) {
      setError("Selecione um aluno.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const ok = await createSessions({
      student,
      dateStr: schedulerSlot.date,
      timeStr: schedulerSlot.time,
      durationMin: durationForDate(schedulerSlot.date),
      focus: scheduleFocus,
    });
    setSaving(false);
    if (ok) {
      setMessage(recurrence === "single" ? "Aula agendada!" : "Aulas recorrentes agendadas!");
      setSchedulerSlot(null);
    }
  }

  function openSchedulerForSlot(date: Date, time: string) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    setSchedulerSlot({ date: `${y}-${m}-${d}`, time });
    setError("");
    setMessage("");
  }

  // Calculate dynamic slots for details
  const detailDateSlots = useMemo(() => {
    const targetDate = selectedMonthDay || new Date();
    const weekdays: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const weekday = weekdays[targetDate.getDay()];
    const dayAvail = availability.find((d) => d.weekday === weekday);
    if (!dayAvail || !dayAvail.active) return ["08:00", "10:00", "14:00", "16:00"]; // default fallback
    
    return [
      ...periodSlots(dayAvail.morningStartTime, dayAvail.morningEndTime, dayAvail.classDurationMinutes),
      ...periodSlots(dayAvail.afternoonStartTime, dayAvail.afternoonEndTime, dayAvail.classDurationMinutes),
    ];
  }, [selectedMonthDay, availability]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Agenda do Treinador
          </p>
          <h1 className="text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
            Controle de Grade e Agendamentos
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Gerencie seus compromissos, visualize horários livres e marque novos atendimentos para seus alunos.
          </p>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm font-semibold text-emerald-800 animate-slide-up">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-semibold text-rose-800 animate-slide-up">
          {error}
        </div>
      )}

      {/* Main Grid: Agenda vs Sidebar */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        
        {/* COLUNA ESQUERDA: Calendário Visual */}
        <section className="card p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-stone-150 pb-4">
            <div>
              <h2 className="text-lg font-black text-stone-950">Visualização da Grade</h2>
              <p className="mt-0.5 text-xs text-stone-500">Monitore sua disponibilidade semanal e mensal.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-1">
                {(["day", "week", "month"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    className={[
                      "focus-ring h-8 rounded-md px-3 text-xs font-semibold transition-all",
                      calendarView === view ? "bg-white text-emerald-900 shadow-sm font-black" : "text-stone-500",
                    ].join(" ")}
                    onClick={() => { setCalendarView(view); setSelectedMonthDay(null); }}
                  >
                    {view === "day" ? "Dia" : view === "week" ? "Semana" : "Mês"}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-1">
                {(["visual", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={[
                      "focus-ring inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all",
                      calendarMode === mode ? "bg-white text-emerald-900 shadow-sm font-black" : "text-stone-500",
                    ].join(" ")}
                    onClick={() => setCalendarMode(mode)}
                  >
                    {mode === "visual" ? <CalendarDays size={13} /> : <List size={13} />}
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
              availability={availability}
              detailSlots={detailDateSlots}
              onCloseMonthDay={() => setSelectedMonthDay(null)}
              onFinish={() => setActiveWorkout(null)}
              onSelectMonthDay={setSelectedMonthDay}
              onStart={setActiveWorkout}
              onScheduleSlot={openSchedulerForSlot}
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-stone-200 pb-3 font-bold text-stone-500 text-xs uppercase tracking-wider">Horário</th>
                    <th className="border-b border-stone-200 pb-3 font-bold text-stone-500 text-xs uppercase tracking-wider">Aluno</th>
                    <th className="border-b border-stone-200 pb-3 font-bold text-stone-500 text-xs uppercase tracking-wider">Local</th>
                    <th className="border-b border-stone-200 pb-3 font-bold text-stone-500 text-xs uppercase tracking-wider">Treino</th>
                    <th className="border-b border-stone-200 pb-3 font-bold text-stone-500 text-xs uppercase tracking-wider">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWorkouts.map((workout) => (
                    <tr key={workout.id}>
                      <td className="border-b border-stone-100 py-3.5 text-xs font-semibold text-stone-700">{formatDateTime(workout.startsAt)}</td>
                      <td className="border-b border-stone-100 py-3.5 text-sm font-bold text-stone-900">{workout.studentName}</td>
                      <td className="border-b border-stone-100 py-3.5 text-xs text-stone-600 truncate max-w-48">{workout.address}</td>
                      <td className="border-b border-stone-100 py-3.5 text-xs font-medium text-stone-700">{workout.proposedWorkout ?? workout.title}</td>
                      <td className="border-b border-stone-100 py-3.5">
                        <button
                          type="button"
                          className={[
                            "focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-2xs font-bold text-white transition-colors",
                            activeWorkout?.id === workout.id ? "bg-stone-950" : "bg-emerald-750 hover:bg-emerald-750",
                          ].join(" ")}
                          onClick={() => activeWorkout?.id === workout.id ? setActiveWorkout(null) : setActiveWorkout(workout)}
                        >
                          {activeWorkout?.id === workout.id ? <CheckCircle2 size={12} /> : <Play size={12} />}
                          {activeWorkout?.id === workout.id ? "Finalizar" : "Iniciar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {visibleWorkouts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-stone-400 italic">
                        Nenhum compromisso agendado para este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Active Workout Row */}
          {activeWorkout && (
            <section className="mt-6 rounded-xl border border-emerald-250 bg-emerald-50/70 p-4 animate-slide-up">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-center">
                <div>
                  <p className="text-2xs font-bold uppercase tracking-wider text-emerald-800">Aula Iniciada</p>
                  <h3 className="mt-0.5 text-lg font-black text-stone-950">{activeWorkout.studentName}</h3>
                  <p className="text-xs text-stone-600 mt-1">
                    {activeWorkout.proposedWorkout ?? activeWorkout.title} · {formatDateTime(activeWorkout.startsAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-stone-950 px-5 text-xs font-bold text-white shadow"
                  onClick={() => setActiveWorkout(null)}
                >
                  <CheckCircle2 size={16} />
                  Finalizar aula
                </button>
              </div>
            </section>
          )}
        </section>

        {/* COLUNA DIREITA: Destaques & Agendamento */}
        <div className="space-y-4">
          
          {/* Destaques da Agenda */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
                <CalendarClock aria-hidden="true" className="text-amber-700" size={16} />
              </div>
              <h2 className="text-sm font-black text-stone-950 uppercase tracking-wider">Destaques da Agenda</h2>
            </div>
            <div className="mt-4 grid gap-3 grid-cols-2">
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="text-2xs font-semibold text-stone-500 uppercase">Aulas na Semana</p>
                <p className="mt-1 text-xl font-black text-stone-950">{weeklyWorkoutsCount}</p>
                <p className="text-2xs text-stone-400 mt-0.5">agendadas</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="text-2xs font-semibold text-stone-500 uppercase">Carga Hoje</p>
                <p className="mt-1 text-xl font-black text-stone-950">{todayDuration} min</p>
                <p className="text-2xs text-stone-400 mt-0.5">de atendimento</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="text-2xs font-semibold text-stone-500 uppercase">Horário de Pico</p>
                <p className="mt-1 text-base font-black text-stone-950">{busiestHour}</p>
                <p className="text-2xs text-stone-400 mt-1">mais concorrido</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="text-2xs font-semibold text-stone-500 uppercase">Próximo Aluno</p>
                <p className="mt-1 text-xs font-black text-stone-950 truncate">
                  {nextWorkouts[0] ? nextWorkouts[0].studentName : "Sem treinos"}
                </p>
                <p className="text-2xs text-stone-400 mt-1 truncate">
                  {nextWorkouts[0] ? formatTime(nextWorkouts[0].startsAt) : "–"}
                </p>
              </div>
            </div>
          </section>

          {/* Agendar Horário de Aula */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <UserPlus aria-hidden="true" className="text-emerald-800" size={18} />
              <h2 className="text-base font-black text-stone-950">Agendar horário de aula</h2>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Aluno</span>
                <select
                  className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs"
                  value={selectedStudentIdx}
                  onChange={(e) => setSelectedStudentIdx(parseInt(e.target.value, 10))}
                >
                  {students.map((std, idx) => (
                    <option key={std.uid} value={idx}>
                      {std.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Data</span>
                  <input
                    className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 px-3 text-xs"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Hora início</span>
                  <input
                    className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 px-3 text-xs"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Duração (min)</span>
                  <input
                    className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 px-3 text-xs text-center"
                    type="number"
                    value={scheduleDuration}
                    onChange={(e) => setScheduleDuration(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Foco do treino</span>
                  <input
                    className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 px-3 text-xs"
                    placeholder="ex: Membros Inferiores"
                    value={scheduleFocus}
                    onChange={(e) => setScheduleFocus(e.target.value)}
                  />
                </label>
              </div>

              <RecurrenceFields
                recurrence={recurrence}
                setRecurrence={setRecurrence}
                occurrences={occurrences}
                setOccurrences={setOccurrences}
              />
            </div>

            <button
              type="button"
              className="focus-ring btn btn-primary mt-4 w-full h-10 text-xs font-bold"
              disabled={saving}
              onClick={handleScheduleClass}
            >
              <UserPlus aria-hidden="true" size={14} />
              {saving ? "Agendando..." : "Confirmar Agendamento"}
            </button>
          </section>

          {/* Próximos Compromissos */}
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Clock aria-hidden="true" className="text-emerald-800" size={18} />
              <h2 className="text-base font-black text-stone-950">Próximos compromissos</h2>
            </div>
            <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {nextWorkouts.map((workout) => (
                <article key={workout.id} className="rounded-xl border border-stone-200 p-3 bg-stone-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-xs text-stone-950">{workout.studentName}</p>
                    <span className="rounded bg-stone-200 px-2 py-0.5 text-3xs font-bold text-stone-700 uppercase">
                      {workout.modality}
                    </span>
                  </div>
                  <p className="mt-1 text-3xs font-semibold text-stone-500">{formatDateTime(workout.startsAt)}</p>
                  <p className="mt-1.5 text-2xs font-bold text-stone-700">{workout.proposedWorkout ?? workout.title}</p>
                  <p className="mt-0.5 text-3xs text-stone-400 truncate">{workout.address}</p>
                </article>
              ))}
              {nextWorkouts.length === 0 && (
                <p className="text-xs text-stone-400 italic text-center py-6">Nenhum compromisso futuro.</p>
              )}
            </div>
          </section>
        </div>

      </div>

      {/* Modal de agendamento rápido (clique no horário) */}
      {schedulerSlot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setSchedulerSlot(null)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-emerald-800">Agendar horário</p>
                <h3 className="mt-0.5 text-xl font-black text-stone-950">
                  {new Date(`${schedulerSlot.date}T${schedulerSlot.time}`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} · {schedulerSlot.time}
                </h3>
              </div>
              <button type="button" aria-label="Fechar" className="focus-ring rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" onClick={() => setSchedulerSlot(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Aluno</span>
                <select
                  className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                  value={selectedStudentIdx}
                  onChange={(e) => setSelectedStudentIdx(parseInt(e.target.value, 10))}
                >
                  {students.length === 0 && <option value={0}>Nenhum aluno ativo</option>}
                  {students.map((std, idx) => (
                    <option key={std.uid} value={idx}>{std.displayName}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Foco do treino</span>
                <input
                  className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                  placeholder="ex: Membros Inferiores"
                  value={scheduleFocus}
                  onChange={(e) => setScheduleFocus(e.target.value)}
                />
              </label>

              <RecurrenceFields
                recurrence={recurrence}
                setRecurrence={setRecurrence}
                occurrences={occurrences}
                setOccurrences={setOccurrences}
              />
            </div>

            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="focus-ring btn btn-primary h-11 flex-1 text-sm font-bold"
                disabled={saving || students.length === 0}
                onClick={handleScheduleSlot}
              >
                <UserPlus size={15} />
                {saving ? "Agendando..." : "Confirmar"}
              </button>
              <button
                type="button"
                className="focus-ring btn btn-secondary h-11"
                onClick={() => setSchedulerSlot(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Campos de recorrência reutilizados (formulário lateral e modal)
function RecurrenceFields({
  recurrence,
  setRecurrence,
  occurrences,
  setOccurrences,
}: {
  recurrence: "single" | "weekly" | "biweekly";
  setRecurrence: (v: "single" | "weekly" | "biweekly") => void;
  occurrences: string;
  setOccurrences: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Repetição</span>
        <select
          className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as "single" | "weekly" | "biweekly")}
        >
          <option value="single">Aula única</option>
          <option value="weekly">Semanal</option>
          <option value="biweekly">Quinzenal</option>
        </select>
      </label>
      {recurrence !== "single" && (
        <label className="block">
          <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Qtd. de aulas</span>
          <input
            className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 px-3 text-xs text-center"
            type="number"
            min={1}
            max={52}
            value={occurrences}
            onChange={(e) => setOccurrences(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}

// ── Sub-componentes do Calendário ───────────────────────────────────────────

interface CalendarVisualProps {
  view: CalendarView;
  workouts: WorkoutSession[];
  selectedMonthDay: Date | null;
  activeWorkoutId?: string;
  availability: TrainerAvailabilityDay[];
  detailSlots: string[];
  onCloseMonthDay: () => void;
  onFinish: () => void;
  onSelectMonthDay: (d: Date) => void;
  onStart: (w: WorkoutSession) => void;
  onScheduleSlot: (date: Date, time: string) => void;
}

function TrainerCalendarVisual({
  view,
  workouts,
  selectedMonthDay,
  activeWorkoutId,
  availability,
  detailSlots,
  onCloseMonthDay,
  onFinish,
  onSelectMonthDay,
  onStart,
  onScheduleSlot,
}: CalendarVisualProps) {
  
  if (view === "week") {
    const days = weekDays(new Date());
    return (
      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {days.map((day) => {
            const dayWorkouts = workouts.filter((w) => isSameDay(w.startsAt, day));
            return (
              <section key={day.toISOString()} className="min-h-64 rounded-xl border border-stone-200 bg-stone-50 p-2">
                <div className="rounded-lg bg-white p-2 text-center shadow-2xs">
                  <p className="text-3xs font-bold uppercase text-emerald-800">
                    {new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day)}
                  </p>
                  <p className="text-xl font-black text-stone-900 mt-0.5">{day.getDate()}</p>
                </div>
                <div className="mt-2 space-y-2">
                  {dayWorkouts.length ? (
                    dayWorkouts.map((workout) => {
                      const isActive = activeWorkoutId === workout.id;
                      return (
                        <article key={workout.id} className="rounded-xl border border-stone-250 bg-white p-2 text-3xs hover:shadow-2xs transition-shadow">
                          <div className="flex items-center justify-between gap-1">
                            <strong className="text-stone-900">{formatTime(workout.startsAt)}</strong>
                            <span className="rounded bg-emerald-50 px-1 py-0.5 text-4xs font-bold text-emerald-800 uppercase">
                              {workout.modality}
                            </span>
                          </div>
                          <p className="mt-1.5 font-black text-stone-900">{workout.studentName}</p>
                          <p className="mt-1 line-clamp-2 text-stone-500 font-medium">
                            {workout.proposedWorkout ?? workout.title}
                          </p>
                          <button
                            type="button"
                            className={[
                              "focus-ring mt-2 inline-flex h-6 w-full items-center justify-center gap-1 rounded bg-emerald-700 text-4xs font-black text-white hover:bg-emerald-650 transition-colors",
                              isActive ? "bg-stone-950 hover:bg-stone-900" : "",
                            ].join(" ")}
                            onClick={() => isActive ? onFinish() : onStart(workout)}
                          >
                            {isActive ? <CheckCircle2 size={9} /> : <Play size={9} />}
                            {isActive ? "Finalizar" : "Iniciar"}
                          </button>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2 text-center text-3xs font-bold text-emerald-850">
                      Livre
                    </div>
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
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 animate-slide-up">
          <div className="flex items-start justify-between gap-3 border-b border-stone-150 pb-3">
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-emerald-800">Grade de horários do dia</p>
              <h3 className="mt-0.5 text-xl font-black text-stone-950">{formatDate(selectedMonthDay.toISOString())}</h3>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50"
              onClick={onCloseMonthDay}
            >
              <X size={15} />
            </button>
          </div>
          
          <div className="mt-4 grid gap-2.5">
            {detailSlots.map((slot) => {
              const workout = workoutAtSlot(dayWorkouts, slot);
              const isActive = activeWorkoutId === workout?.id;
              return (
                <article
                  key={slot}
                  className={[
                    "grid gap-3 rounded-xl border p-3.5 sm:grid-cols-[5rem_1fr_auto] items-center",
                    workout ? "border-amber-200 bg-amber-50/40" : "border-emerald-250 bg-emerald-50/45",
                  ].join(" ")}
                >
                  <p className={["font-black text-sm", workout ? "text-amber-800" : "text-emerald-850"].join(" ")}>
                    {slot}
                  </p>
                  {workout ? (
                    <div>
                      <p className="font-bold text-sm text-stone-950">{workout.studentName}</p>
                      <p className="mt-0.5 text-xs text-stone-600 font-medium">
                        {workout.proposedWorkout ?? workout.title} · {workout.durationMinutes} min
                      </p>
                    </div>
                  ) : (
                    <p className="font-bold text-xs text-emerald-800">Horário livre</p>
                  )}
                  {workout ? (
                    <button
                      type="button"
                      className={[
                        "focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-2xs font-bold text-white transition-colors shadow-2xs",
                        isActive ? "bg-stone-950" : "bg-emerald-700 hover:bg-emerald-650",
                      ].join(" ")}
                      onClick={() => isActive ? onFinish() : onStart(workout)}
                    >
                      {isActive ? <CheckCircle2 size={12} /> : <Play size={12} />}
                      {isActive ? "Finalizar" : "Iniciar"}
                    </button>
                  ) : (
                    selectedMonthDay && (
                      <button
                        type="button"
                        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 text-2xs font-bold text-emerald-800 transition-colors hover:bg-emerald-50"
                        onClick={() => onScheduleSlot(selectedMonthDay, slot)}
                      >
                        <UserPlus size={12} />
                        Agendar
                      </button>
                    )
                  )}
                </article>
              );
            })}
            {detailSlots.length === 0 && (
              <p className="text-center text-xs text-stone-400 italic py-6 bg-white border border-stone-200 rounded-xl">
                Você não tem horários de atendimento ativos configurados para este dia da semana.
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <div className="grid grid-cols-7 gap-1">
          {WEEK_LABELS.map((d) => (
            <p key={d} className="py-2 text-center text-3xs font-black uppercase text-stone-450">{d}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayWorkouts = workouts.filter((w) => isSameDay(w.startsAt, day));
            const inCurrentMonth = day.getMonth() === today.getMonth();
            
            // Calculate slots for dot grid
            const weekdays: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
            const weekday = weekdays[day.getDay()];
            const dayAvail = availability.find((d) => d.weekday === weekday);
            const activeSlots = dayAvail && dayAvail.active 
              ? [
                  ...periodSlots(dayAvail.morningStartTime, dayAvail.morningEndTime, dayAvail.classDurationMinutes),
                  ...periodSlots(dayAvail.afternoonStartTime, dayAvail.afternoonEndTime, dayAvail.classDurationMinutes),
                ]
              : [];

            return (
              <button
                key={day.toISOString()}
                type="button"
                className={[
                  "focus-ring min-h-20 rounded-xl border p-2 text-left transition-all hover:bg-stone-50/50 flex flex-col justify-between",
                  inCurrentMonth
                    ? "border-stone-200 bg-white hover:border-emerald-500"
                    : "border-stone-150 bg-stone-50 opacity-40",
                ].join(" ")}
                onClick={() => onSelectMonthDay(day)}
              >
                <span className="text-xs font-black text-stone-800">{day.getDate()}</span>
                <div className="mt-2 grid grid-cols-4 gap-0.5 w-full">
                  {activeSlots.slice(0, 8).map((slot) => {
                    const occupied = Boolean(workoutAtSlot(dayWorkouts, slot));
                    return (
                      <span
                        key={slot}
                        className={[
                          "block h-2 rounded-xs",
                          occupied ? "bg-red-400" : "bg-emerald-350",
                        ].join(" ")}
                        title={`${slot} ${occupied ? "ocupado" : "vago"}`}
                      />
                    );
                  })}
                  {activeSlots.length === 0 && (
                    <span className="col-span-full h-1 w-full bg-stone-200 rounded-sm opacity-50" title="Sem expediente" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Day view — agenda detalhada de hoje (todos os horários, livres e ocupados)
  const today = new Date();
  const dayWeekdays: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const dayAvail = availability.find((a) => a.weekday === dayWeekdays[today.getDay()]);
  const daySlots = dayAvail && dayAvail.active
    ? [
        ...periodSlots(dayAvail.morningStartTime, dayAvail.morningEndTime, dayAvail.classDurationMinutes),
        ...periodSlots(dayAvail.afternoonStartTime, dayAvail.afternoonEndTime, dayAvail.classDurationMinutes),
      ]
    : [];
  const dayWorkouts = workouts.filter((w) => isSameDay(w.startsAt, today));

  return (
    <div className="mt-4 grid gap-2.5">
      {daySlots.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400 italic rounded-xl border border-stone-200 bg-white">
          Sem expediente configurado para hoje. Defina sua grade em Ajustes → Agenda.
        </p>
      ) : (
        daySlots.map((slot) => {
          const workout = workoutAtSlot(dayWorkouts, slot);
          const isActive = activeWorkoutId === workout?.id;
          return (
            <article
              key={slot}
              className={[
                "grid gap-3 rounded-xl border p-3.5 sm:grid-cols-[5rem_1fr_auto] items-center",
                workout ? "border-amber-200 bg-amber-50/40" : "border-emerald-250 bg-emerald-50/45",
              ].join(" ")}
            >
              <p className={["font-black text-sm", workout ? "text-amber-800" : "text-emerald-850"].join(" ")}>{slot}</p>
              {workout ? (
                <div>
                  <p className="font-bold text-sm text-stone-950">{workout.studentName}</p>
                  <p className="mt-0.5 text-xs text-stone-600 font-medium">
                    {workout.proposedWorkout ?? workout.title} · {workout.durationMinutes} min
                  </p>
                </div>
              ) : (
                <p className="font-bold text-xs text-emerald-800">Horário livre</p>
              )}
              {workout ? (
                <button
                  type="button"
                  className={[
                    "focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-2xs font-bold text-white transition-colors shadow-2xs",
                    isActive ? "bg-stone-950" : "bg-emerald-700 hover:bg-emerald-650",
                  ].join(" ")}
                  onClick={() => (isActive ? onFinish() : onStart(workout))}
                >
                  {isActive ? <CheckCircle2 size={12} /> : <Play size={12} />}
                  {isActive ? "Finalizar" : "Iniciar"}
                </button>
              ) : (
                <button
                  type="button"
                  className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 text-2xs font-bold text-emerald-800 transition-colors hover:bg-emerald-50"
                  onClick={() => onScheduleSlot(today, slot)}
                >
                  <UserPlus size={12} />
                  Agendar
                </button>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}

// Helper slots parsing
function periodSlots(startTime: string | undefined | null, endTime: string | undefined | null, durationMinutes: number | undefined | null) {
  if (!startTime || !endTime || !durationMinutes || durationMinutes <= 0) return [];
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  const slots: string[] = [];

  for (let cursor = start; cursor + durationMinutes <= end; cursor += durationMinutes) {
    slots.push(timeFromMinutes(cursor));
  }

  return slots;
}

function minutesFromTime(value: string | undefined | null) {
  if (!value) return 0;
  const parts = value.split(":");
  if (parts.length < 2) return 0;
  const [hours, minutes] = parts.map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
