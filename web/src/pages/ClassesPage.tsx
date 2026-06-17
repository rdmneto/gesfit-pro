import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  Play,
  Square,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc, writeBatch, increment, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useTeam, useTrainerStudents, useWorkoutSessions, useCollection, useTeamMembers, useAssignedSessions } from "../lib/hooks";
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
import { ActiveTrainingDetails } from "../features/dashboard/ActiveTrainingDetails";
import type { WorkoutSession, TrainerAvailabilityDay, Training } from "../types/domain";


export function ClassesPage() {
  const teamId = useSessionStore((state) => state.claims.teamId);
  const user = useSessionStore((state) => state.user);

  // Firestore hooks
  const { data: dbTeam } = useTeam(teamId);
  const { data: dbStudents } = useTrainerStudents(user?.uid);
  const { data: dbWorkoutSessions } = useWorkoutSessions(
    user ? { trainerId: user.uid } : {}
  );
  
  const { data: trainings } = useCollection<Training>(
    "trainings",
    user ? [where("trainerId", "==", user.uid)] : [],
    [],
    [user?.uid]
  );

  // Sub-trainers logic
  const isTrainerRole = useSessionStore((state) => state.claims.role === "trainer");
  const { data: teamMembers } = useTeamMembers(isTrainerRole ? user?.uid : null);
  const { data: assignedSessions } = useAssignedSessions(isTrainerRole ? user?.uid : null);
  
  // Filter for view (if a sub-trainer is selected to view their agenda)
  const [viewSubTrainerId, setViewSubTrainerId] = useState<string>("all");
  // Selection for assigning a class
  const [assignSubTrainerId, setAssignSubTrainerId] = useState<string>("owner");

  const students = (dbStudents ?? []).filter((s) => s.enrollment?.status === "active");
  const trainerWorkouts = useMemo(() => {
    let list = [...(dbWorkoutSessions ?? []), ...(assignedSessions ?? [])];
    
    // Deduplicate by ID just in case
    const unique = new Map(list.map(w => [w.id, w]));
    list = Array.from(unique.values());

    if (viewSubTrainerId !== "all") {
      if (viewSubTrainerId === "owner") {
        list = list.filter(w => !w.assignedToId || w.assignedToId === user?.uid);
      } else {
        list = list.filter(w => w.assignedToId === viewSubTrainerId);
      }
    }

    return list.sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || ""));
  }, [dbWorkoutSessions, assignedSessions, viewSubTrainerId, user?.uid]);

  const availability: TrainerAvailabilityDay[] = dbTeam?.availability || DEFAULT_AVAILABILITY;

  // Calendar states
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("visual");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null);

  // Schedule class states
  const [selectedStudentIdx, setSelectedStudentIdx] = useState(0);
  const [scheduleTrainingId, setScheduleTrainingId] = useState("");
  const [scheduleFocus, setScheduleFocus] = useState("");
  const [recurrence, setRecurrence] = useState<"single" | "weekly" | "biweekly">("single");
  const [occurrences, setOccurrences] = useState("8");
  const [schedulerSlot, setSchedulerSlot] = useState<{ date: string; time: string; duration: number } | null>(null);

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
  async function createSessions(opts: {
    student: { uid: string; displayName: string };
    dateStr: string;
    timeStr: string;
    durationMin: number;
    trainingId?: string;
    proposedWorkout?: string;
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
    const training = trainings?.find(t => t.id === opts.trainingId);

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
      let assignedToId: string | undefined;
      let assignedToName: string | undefined;

      if (assignSubTrainerId && assignSubTrainerId !== "owner") {
        const member = teamMembers.find(m => m.subTrainerId === assignSubTrainerId);
        if (member) {
          assignedToId = member.subTrainerId;
          assignedToName = member.subTrainerName;
        }
      }

      sessions.push({
        studentId: opts.student.uid,
        studentName: opts.student.displayName,
        trainerId: user?.uid || "",
        title: training ? `Treino: ${training.title}` : "Treino Personalizado",
        modality: "Musculação",
        startsAt: d.toISOString(),
        address: "",
        proposedWorkout: opts.proposedWorkout || training?.title || "Treino Livre",
        durationMinutes: opts.durationMin,
        plannedCalories: 320,
        status: "scheduled",
        exercises: training?.exercises?.map(e => e.name) || [],
        trainingId: opts.trainingId,
        assignedToId,
        assignedToName,
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

  // Start a session (scheduled → in_progress)
  async function startSession(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), {
        status: "in_progress",
        startedAt: new Date().toISOString(),
      });
      setError("");
      setMessage("Aula iniciada! O cronômetro está rodando.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao iniciar aula: " + err.message);
    }
  }

  // Complete a session (in_progress → completed) and deduct credit
  async function completeSession(workout: WorkoutSession) {
    if (!db) return;
    try {
      const now = new Date();
      const startedAt = workout.startedAt ? new Date(workout.startedAt) : now;
      const actualDurationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));

      const enrollmentId = `${workout.studentId}__${workout.trainerId}`;

      const batch = writeBatch(db);
      batch.update(doc(db, "workoutSessions", workout.id), {
        status: "completed",
        completedAt: now.toISOString(),
        actualDurationMinutes,
      });
      batch.update(doc(db, "enrollments", enrollmentId), {
        classesUsed: increment(1),
      });
      await batch.commit();

      setError("");
      setMessage(`Aula concluída! Duração: ${actualDurationMinutes} min. Crédito debitado.`);
      setTimeout(() => setMessage(""), 4000);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao concluir aula: " + err.message);
    }
  }

  // Mark no-show (does NOT deduct credit)
  async function markNoShow(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), {
        status: "no_show",
      });
      setError("");
      setMessage("Falta registrada.");
      setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao registrar falta: " + err.message);
    }
  }

  // Undo status back to scheduled
  async function undoAttendance(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), {
        status: "scheduled",
        startedAt: null,
        completedAt: null,
        actualDurationMinutes: null,
      });
      setError("");
      setMessage("Marcação desfeita.");
      setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao desfazer: " + err.message);
    }
  }

  // Exclui uma aula agendada.
  async function deleteSession(workout: WorkoutSession) {
    if (!db) return;
    if (!window.confirm(`Excluir a aula de ${workout.studentName} em ${formatDateTime(workout.startsAt)}?`)) return;
    try {
      await deleteDoc(doc(db, "workoutSessions", workout.id));
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
      durationMin: schedulerSlot.duration,
      trainingId: scheduleTrainingId || undefined,
      proposedWorkout: scheduleFocus || undefined,
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
    const dateStr = `${y}-${m}-${d}`;
    setSchedulerSlot({ date: dateStr, time, duration: durationForDate(dateStr) });
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
            <div className="flex-1">
              <h2 className="text-lg font-black text-stone-950">Visualização da Grade</h2>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <p className="text-xs text-stone-500">Monitore sua disponibilidade semanal e mensal.</p>
                
                {teamMembers && teamMembers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-600">Ver Agenda:</span>
                    <select
                      className="focus-ring h-8 rounded-lg border border-stone-200 bg-stone-50 px-2 text-xs font-semibold text-stone-700"
                      value={viewSubTrainerId}
                      onChange={(e) => setViewSubTrainerId(e.target.value)}
                    >
                      <option value="all">Todo o Time</option>
                      <option value="owner">Somente Minha</option>
                      {teamMembers.map(m => (
                        <option key={m.subTrainerId} value={m.subTrainerId}>{m.subTrainerName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
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
                availability={availability}
                detailSlots={detailDateSlots}
                onCloseMonthDay={() => setSelectedMonthDay(null)}
                onSelectMonthDay={setSelectedMonthDay}
                onScheduleSlot={openSchedulerForSlot}
                onDelete={deleteSession}
                onStart={startSession}
                onComplete={completeSession}
                onNoShow={markNoShow}
                onUndo={undoAttendance}
                trainings={trainings || []}
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
                    <Fragment key={workout.id}>
                      <tr>
                        <td className="border-b border-stone-100 py-3.5 text-xs font-semibold text-stone-700">{formatDateTime(workout.startsAt)}</td>
                        <td className="border-b border-stone-100 py-3.5 text-sm font-bold text-stone-900">{workout.studentName}</td>
                        <td className="border-b border-stone-100 py-3.5 text-xs text-stone-600 truncate max-w-48">{workout.address}</td>
                        <td className="border-b border-stone-100 py-3.5 text-xs font-medium text-stone-700">
                          {workout.proposedWorkout ?? workout.title}
                          {workout.assignedToName && (
                            <div className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-bold text-emerald-700 border border-emerald-200">
                              <UserPlus size={10} className="mr-1 inline" />
                              {workout.assignedToName}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-stone-100 py-3.5">
                          <div className="flex items-center gap-2">
                            <AttendanceControl workout={workout} onStart={startSession} onComplete={completeSession} onNoShow={markNoShow} onUndo={undoAttendance} />
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
                      {workout.status === 'in_progress' && workout.trainingId && (
                        <tr>
                          <td colSpan={5} className="bg-emerald-50/50 p-4 border-b border-emerald-100">
                            <ActiveTrainingDetails training={trainings?.find(t => t.id === workout.trainingId)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

              {teamMembers && teamMembers.length > 0 && (
                <label className="block">
                  <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Atribuir a (Sub-treinador)</span>
                  <select
                    className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                    value={assignSubTrainerId}
                    onChange={(e) => setAssignSubTrainerId(e.target.value)}
                  >
                    <option value="owner">Eu mesmo (Dono do Time)</option>
                    {teamMembers.map(m => (
                      <option key={m.subTrainerId} value={m.subTrainerId}>{m.subTrainerName}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Treino (Biblioteca)</span>
                <select
                  className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
                  value={scheduleTrainingId}
                  onChange={(e) => setScheduleTrainingId(e.target.value)}
                >
                  <option value="">Nenhum (apenas foco)</option>
                  {(trainings || []).map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <div className="mt-1 flex justify-end">
                  <a href="/app/treinos" target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:text-emerald-800 font-bold">
                    + Criar Novo Treino
                  </a>
                </div>
              </label>

              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Foco do treino (Opcional)</span>
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

// Controle de presença/falta de uma aula.
function AttendanceControl({
  workout,
  onStart,
  onComplete,
  onNoShow,
  onUndo,
}: {
  workout: WorkoutSession;
  onStart: (w: WorkoutSession) => void;
  onComplete: (w: WorkoutSession) => void;
  onNoShow: (w: WorkoutSession) => void;
  onUndo: (w: WorkoutSession) => void;
}) {
  const { status } = workout;

  if (status === "completed") {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-3xs font-bold text-emerald-800">
          <Check size={11} /> {workout.actualDurationMinutes ? `${workout.actualDurationMinutes} min` : "Concluída"}
        </span>
        <button
          type="button"
          title="Desfazer"
          className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:bg-stone-50 text-xs"
          onClick={() => onUndo(workout)}
        >
          ↩
        </button>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Finalizar aula"
          className="focus-ring flex h-8 items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-2 text-white text-3xs font-bold animate-pulse"
          onClick={() => onComplete(workout)}
        >
          <Square size={11} /> Finalizar
        </button>
      </div>
    );
  }

  if (status === "no_show") {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 text-3xs font-bold text-rose-800">
          <X size={11} /> Falta
        </span>
        <button
          type="button"
          title="Desfazer"
          className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:bg-stone-50 text-xs"
          onClick={() => onUndo(workout)}
        >
          ↩
        </button>
      </div>
    );
  }

  // status === 'scheduled'
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        title="Iniciar aula"
        aria-label="Iniciar aula"
        className="focus-ring flex h-7 items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-50 px-1.5 text-emerald-800 text-3xs font-bold hover:bg-emerald-100"
        onClick={() => onStart(workout)}
      >
        <Play size={10} /> Iniciar
      </button>
      <button
        type="button"
        title="Faltou"
        aria-label="Marcar falta"
        className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-rose-600 hover:bg-rose-50"
        onClick={() => onNoShow(workout)}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Sub-componentes do Calendário ───────────────────────────────────────────

interface CalendarVisualProps {
  view: CalendarView;
  workouts: WorkoutSession[];
  selectedMonthDay: Date | null;
  referenceDate: Date;
  availability: TrainerAvailabilityDay[];
  detailSlots: string[];
  onCloseMonthDay: () => void;
  onSelectMonthDay: (d: Date) => void;
  onScheduleSlot: (date: Date, time: string) => void;
  onDelete: (w: WorkoutSession) => void;
  onStart: (w: WorkoutSession) => void;
  onComplete: (w: WorkoutSession) => void;
  onNoShow: (w: WorkoutSession) => void;
  onUndo: (w: WorkoutSession) => void;
  trainings: Training[];
}

function TrainerCalendarVisual({
  view,
  workouts,
  selectedMonthDay,
  referenceDate,
  availability,
  detailSlots,
  onCloseMonthDay,
  onSelectMonthDay,
  onScheduleSlot,
  onDelete,
  onStart,
  onComplete,
  onNoShow,
  onUndo,
  trainings,
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
                      return (
                        <article
                          key={slot}
                          className={[
                            "overflow-hidden rounded-lg border bg-white p-1.5",
                            workout.status === "completed"
                              ? "border-emerald-300"
                              : workout.status === "no_show"
                                ? "border-rose-300"
                                : "border-amber-200",
                          ].join(" ")}
                        >
                          <strong className="block text-3xs text-stone-900">{slot}</strong>
                          <p className="mt-0.5 break-words text-4xs font-bold leading-tight text-stone-700 line-clamp-2">
                            {workout.studentName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                            <AttendanceControl workout={workout} onStart={onStart} onComplete={onComplete} onNoShow={onNoShow} onUndo={onUndo} />
                            <button
                              type="button"
                              aria-label="Excluir aula"
                              className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                              onClick={() => onDelete(workout)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </article>
                      );
                    }
                    const y = day.getFullYear();
                    const m = String(day.getMonth() + 1).padStart(2, "0");
                    const d = String(day.getDate()).padStart(2, "0");
                    const isPast = new Date(`${y}-${m}-${d}T${slot}:00`).getTime() < Date.now();

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isPast}
                        onClick={() => !isPast && onScheduleSlot(day, slot)}
                        className={[
                          "focus-ring flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-3xs font-bold transition-colors",
                          isPast 
                            ? "border-stone-200 bg-stone-100/50 text-stone-400 cursor-not-allowed" 
                            : "border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100"
                        ].join(" ")}
                      >
                        <span>{slot}</span>
                        {!isPast && <span className="inline-flex items-center"><UserPlus size={12} /></span>}
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
              
              let isPast = false;
              if (selectedMonthDay) {
                const y = selectedMonthDay.getFullYear();
                const m = String(selectedMonthDay.getMonth() + 1).padStart(2, "0");
                const d = String(selectedMonthDay.getDate()).padStart(2, "0");
                isPast = new Date(`${y}-${m}-${d}T${slot}:00`).getTime() < Date.now();
              }

              return (
                <article
                  key={slot}
                  className={[
                    "grid gap-3 rounded-xl border p-3.5 sm:grid-cols-[5rem_1fr_auto] items-center",
                    workout ? "border-amber-200 bg-amber-50/40" : (isPast ? "border-stone-200 bg-stone-50" : "border-emerald-250 bg-emerald-50/45"),
                  ].join(" ")}
                >
                  <p className={["font-black text-sm", workout ? "text-amber-800" : (isPast ? "text-stone-500" : "text-emerald-850")].join(" ")}>
                    {slot}
                  </p>
                  {workout ? (
                    <div>
                      <p className="font-bold text-sm text-stone-950">{workout.studentName}</p>
                      <p className="mt-0.5 text-xs text-stone-600 font-medium flex items-center gap-2 flex-wrap">
                        <span>{workout.proposedWorkout ?? workout.title} · {workout.durationMinutes} min</span>
                        {workout.assignedToName && (
                          <span className="inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-2xs font-bold text-emerald-700 border border-emerald-200">
                            <UserPlus size={10} className="mr-1" />
                            {workout.assignedToName}
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className={["font-bold text-xs", isPast ? "text-stone-500" : "text-emerald-800"].join(" ")}>Horário livre {isPast && "(Passado)"}</p>
                  )}
                  {workout ? (
                    <div className="flex items-center gap-2">
                      <AttendanceControl workout={workout} onStart={onStart} onComplete={onComplete} onNoShow={onNoShow} onUndo={onUndo} />
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
                        disabled={isPast}
                        className={[
                          "focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border px-3.5 text-2xs font-bold transition-colors",
                          isPast ? "border-stone-200 bg-stone-100/50 text-stone-400 cursor-not-allowed" : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                        ].join(" ")}
                        onClick={() => !isPast && onScheduleSlot(selectedMonthDay, slot)}
                      >
                        {isPast ? <X size={12} /> : <UserPlus size={12} />}
                        {isPast ? "Indisponível" : "Agendar"}
                      </button>
                    )
                  )}
                  {workout?.status === 'in_progress' && workout.trainingId && (
                    <div className="sm:col-span-3 mt-2 pt-2 border-t border-emerald-200">
                      <ActiveTrainingDetails training={trainings.find(t => t.id === workout.trainingId)} />
                    </div>
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
                  <AttendanceControl workout={workout} onStart={onStart} onComplete={onComplete} onNoShow={onNoShow} onUndo={onUndo} />
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
              {workout?.status === 'in_progress' && workout.trainingId && (
                <div className="sm:col-span-3 mt-2 pt-2 border-t border-emerald-200">
                  <ActiveTrainingDetails training={trainings.find(t => t.id === workout.trainingId)} />
                </div>
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
