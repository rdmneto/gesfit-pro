import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  List,
  Play,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useTeam, useTrainerStudents, useWorkoutSessions } from "../lib/hooks";
import { DEFAULT_AVAILABILITY } from "../data/catalog";
import {
  type CalendarView,
  type CalendarMode,
  formatDate,
  formatDateTime,
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
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);

  // Schedule class states
  const [selectedStudentIdx, setSelectedStudentIdx] = useState(0);
  const [scheduleFocus, setScheduleFocus] = useState("Musculação - Inferiores");
  const [recurrence, setRecurrence] = useState<"single" | "weekly" | "biweekly">("single");
  const [occurrences, setOccurrences] = useState("8");
  // Slot clicado na grade → abre o modal de agendamento rápido
  const [schedulerSlot, setSchedulerSlot] = useState<{ date: string; time: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleWorkouts = getTrainerCalendarItems(trainerWorkouts, calendarView);

  // Duração padrão da aula no dia (da grade) — usada no agendamento por clique.
  function durationForDate(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00`);
    const weekdays: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const day = availability.find((a) => a.weekday === weekdays[d.getDay()]);
    return day?.classDurationMinutes ?? 60;
  }

  // Cria 1 (única) ou N aulas (semanal/quinzenal) a partir de um horário base.
  // Pula horários já ocupados (verificação de conflito) e relata quantos.
  async function createSessions(opts: {
    student: { uid: string; displayName: string };
    dateStr: string;
    timeStr: string;
    durationMin: number;
    focus: string;
  }): Promise<{ created: number; skipped: number } | null> {
    if (!db) {
      setError("Banco de dados indisponível no momento.");
      return null;
    }
    const base = new Date(`${opts.dateStr}T${opts.timeStr}`);
    if (isNaN(base.getTime())) {
      setError("Data ou hora inválida.");
      return null;
    }
    const stepDays = recurrence === "weekly" ? 7 : recurrence === "biweekly" ? 14 : 0;
    const count = recurrence === "single" ? 1 : Math.max(1, parseInt(occurrences, 10) || 1);
    const focus = opts.focus.trim() || "Treino";

    // Horários já ocupados (mesmo instante) — para detectar conflitos.
    const occupied = new Set(trainerWorkouts.map((w) => new Date(w.startsAt).getTime()));

    const sessions: Omit<WorkoutSession, "id">[] = [];
    let skipped = 0;
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + stepDays * i);
      if (occupied.has(d.getTime())) {
        skipped++;
        continue;
      }
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

    if (sessions.length === 0) {
      setError("Todos os horários selecionados já estão ocupados.");
      return null;
    }

    try {
      await Promise.all(sessions.map((s) => addDoc(collection(db!, "workoutSessions"), s)));
      return { created: sessions.length, skipped };
    } catch (err: any) {
      console.error(err);
      setError("Erro ao agendar: " + err.message);
      return null;
    }
  }

  // Exclui uma aula agendada.
  async function deleteSession(workout: WorkoutSession) {
    if (!db) return;
    if (!window.confirm(`Excluir a aula de ${workout.studentName} em ${formatDateTime(workout.startsAt)}?`)) return;
    try {
      await deleteDoc(doc(db, "workoutSessions", workout.id));
      if (activeWorkout?.id === workout.id) setActiveWorkout(null);
      setError("");
      setMessage("Aula excluída.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao excluir: " + err.message);
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
    const result = await createSessions({
      student,
      dateStr: schedulerSlot.date,
      timeStr: schedulerSlot.time,
      durationMin: durationForDate(schedulerSlot.date),
      focus: scheduleFocus,
    });
    setSaving(false);
    if (result) {
      const base = result.created === 1 ? "Aula agendada!" : `${result.created} aulas agendadas!`;
      setMessage(result.skipped > 0 ? `${base} ${result.skipped} horário(s) já ocupado(s) foram pulados.` : base);
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

  // Navegação entre dias/semanas/meses
  function shiftReference(dir: 1 | -1) {
    setReferenceDate((prev) => {
      const d = new Date(prev);
      if (calendarView === "day") d.setDate(d.getDate() + dir);
      else if (calendarView === "week") d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
    setSelectedMonthDay(null);
  }

  const periodLabel = (() => {
    if (calendarView === "day") {
      return referenceDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    }
    if (calendarView === "week") {
      const ds = weekDays(referenceDate);
      const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `${fmt(ds[0])} – ${fmt(ds[6])}`;
    }
    return referenceDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

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

      {/* Agenda */}
      <div className="mt-6">
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
            <>
              {/* Navegação entre períodos */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Anterior"
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50"
                  onClick={() => shiftReference(-1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="min-w-[10rem] text-center text-sm font-black text-stone-800 capitalize">
                  {periodLabel}
                </span>
                <button
                  type="button"
                  aria-label="Próximo"
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50"
                  onClick={() => shiftReference(1)}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  className="focus-ring ml-1 h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600 hover:bg-stone-50"
                  onClick={() => { setReferenceDate(new Date()); setSelectedMonthDay(null); }}
                >
                  Hoje
                </button>
              </div>
              <TrainerCalendarVisual
                selectedMonthDay={selectedMonthDay}
                referenceDate={referenceDate}
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
                onDelete={deleteSession}
              />
            </>
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
                        <div className="flex items-center gap-2">
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
                          <button
                            type="button"
                            aria-label="Excluir aula"
                            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => deleteSession(workout)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
  referenceDate: Date;
  activeWorkoutId?: string;
  availability: TrainerAvailabilityDay[];
  detailSlots: string[];
  onCloseMonthDay: () => void;
  onFinish: () => void;
  onSelectMonthDay: (d: Date) => void;
  onStart: (w: WorkoutSession) => void;
  onScheduleSlot: (date: Date, time: string) => void;
  onDelete: (w: WorkoutSession) => void;
}

function TrainerCalendarVisual({
  view,
  workouts,
  selectedMonthDay,
  referenceDate,
  activeWorkoutId,
  availability,
  detailSlots,
  onCloseMonthDay,
  onFinish,
  onSelectMonthDay,
  onStart,
  onScheduleSlot,
  onDelete,
}: CalendarVisualProps) {

  if (view === "week") {
    const days = weekDays(referenceDate);
    const weekdayKeys: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    return (
      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {days.map((day) => {
            const dayWorkouts = workouts.filter((w) => isSameDay(w.startsAt, day));
            const dayAvail = availability.find((a) => a.weekday === weekdayKeys[day.getDay()]);
            const slots = dayAvail && dayAvail.active
              ? [
                  ...periodSlots(dayAvail.morningStartTime, dayAvail.morningEndTime, dayAvail.classDurationMinutes),
                  ...periodSlots(dayAvail.afternoonStartTime, dayAvail.afternoonEndTime, dayAvail.classDurationMinutes),
                ]
              : [];
            return (
              <section key={day.toISOString()} className="min-h-64 rounded-xl border border-stone-200 bg-stone-50 p-2">
                <div className="rounded-lg bg-white p-2 text-center shadow-2xs">
                  <p className="text-3xs font-bold uppercase text-emerald-800">
                    {new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day)}
                  </p>
                  <p className="text-xl font-black text-stone-900 mt-0.5">{day.getDate()}</p>
                </div>
                <div className="mt-2 space-y-1.5">
                  {slots.length === 0 && (
                    <p className="rounded-lg border border-stone-200 bg-white p-2 text-center text-4xs font-semibold text-stone-400">
                      Sem expediente
                    </p>
                  )}
                  {slots.map((slot) => {
                    const workout = workoutAtSlot(dayWorkouts, slot);
                    if (workout) {
                      const isActive = activeWorkoutId === workout.id;
                      return (
                        <article key={slot} className="overflow-hidden rounded-lg border border-amber-200 bg-white p-1.5">
                          <strong className="block text-3xs text-stone-900">{slot}</strong>
                          <p className="mt-0.5 break-words text-4xs font-bold leading-tight text-stone-700 line-clamp-2">
                            {workout.studentName}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            <button
                              type="button"
                              className={[
                                "focus-ring inline-flex h-6 flex-1 items-center justify-center gap-0.5 rounded bg-emerald-700 text-4xs font-black text-white hover:bg-emerald-650 transition-colors",
                                isActive ? "bg-stone-950 hover:bg-stone-900" : "",
                              ].join(" ")}
                              onClick={() => (isActive ? onFinish() : onStart(workout))}
                            >
                              {isActive ? <CheckCircle2 size={9} /> : <Play size={9} />}
                              {isActive ? "Fim" : "Iniciar"}
                            </button>
                            <button
                              type="button"
                              aria-label="Excluir aula"
                              className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                              onClick={() => onDelete(workout)}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </article>
                      );
                    }
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => onScheduleSlot(day, slot)}
                        className="focus-ring flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-2 py-1.5 text-3xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                      >
                        <span>{slot}</span>
                        <span className="inline-flex items-center gap-0.5"><UserPlus size={10} /> Livre</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "month") {
    const today = referenceDate;
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
                    <div className="flex items-center gap-2">
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
                      <button
                        type="button"
                        aria-label="Excluir aula"
                        className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                        onClick={() => onDelete(workout)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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

  // Day view — agenda detalhada do dia selecionado (todos os horários)
  const today = referenceDate;
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
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    aria-label="Excluir aula"
                    className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => onDelete(workout)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
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
