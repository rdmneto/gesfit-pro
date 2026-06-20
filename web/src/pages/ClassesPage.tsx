import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  List,
  Play,
  Square,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useState, useMemo, Fragment, useRef } from "react";
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
import { WorkoutSummaryModal, type WorkoutSummaryData } from "../components/WorkoutSummaryModal";


export function ClassesPage() {
  const teamId = useSessionStore((state) => state.claims.teamId);
  const user = useSessionStore((state) => state.user);

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

  const isTrainerRole = useSessionStore((state) => state.claims.role === "trainer");
  const { data: teamMembers } = useTeamMembers(isTrainerRole ? user?.uid : null);
  const { data: assignedSessions } = useAssignedSessions(isTrainerRole ? user?.uid : null);

  const [viewSubTrainerId, setViewSubTrainerId] = useState<string>("all");
  const [assignSubTrainerId, setAssignSubTrainerId] = useState<string>("owner");
  const [completedSummary, setCompletedSummary] = useState<WorkoutSummaryData | null>(null);

  const students = (dbStudents ?? []).filter((s) => s.enrollment?.status === "active");
  const trainerWorkouts = useMemo(() => {
    let list = [...(dbWorkoutSessions ?? []), ...(assignedSessions ?? [])];
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

  const [calendarView, setCalendarView] = useState<CalendarView>("day");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("visual");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null);

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

  function durationForDate(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00`);
    const weekdays: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const day = availability.find((a) => a.weekday === weekdays[d.getDay()]);
    return day?.classDurationMinutes ?? 60;
  }

  async function createSessions(opts: {
    student: { uid: string; displayName: string };
    dateStr: string;
    timeStr: string;
    durationMin: number;
    trainingId?: string;
    proposedWorkout?: string;
  }): Promise<{ created: number; skipped: number } | null> {
    if (!db) { setError("Banco de dados indisponível no momento."); return null; }
    const base = new Date(`${opts.dateStr}T${opts.timeStr}`);
    if (isNaN(base.getTime())) { setError("Data ou hora inválida."); return null; }
    const stepDays = recurrence === "weekly" ? 7 : recurrence === "biweekly" ? 14 : 0;
    const count = recurrence === "single" ? 1 : Math.max(1, parseInt(occurrences, 10) || 1);
    const training = trainings?.find(t => t.id === opts.trainingId);

    const occupied = new Set(trainerWorkouts.map((w) => new Date(w.startsAt).getTime()));
    const sessions: Omit<WorkoutSession, "id">[] = [];
    let skipped = 0;
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + stepDays * i);
      if (occupied.has(d.getTime())) { skipped++; continue; }
      let assignedToId: string | null = null;
      let assignedToName: string | null = null;
      if (assignSubTrainerId && assignSubTrainerId !== "owner") {
        const member = teamMembers.find(m => m.subTrainerId === assignSubTrainerId);
        if (member) { assignedToId = member.subTrainerId; assignedToName = member.subTrainerName; }
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
        plannedCalories: training?.caloriesPerMinute
          ? Math.round(training.caloriesPerMinute * opts.durationMin)
          : Math.round(opts.durationMin * 7),
        status: "scheduled",
        exercises: training?.exercises?.map(e => e.name) || [],
        trainingId: opts.trainingId,
        assignedToId: assignedToId ?? null,
        assignedToName: assignedToName ?? null,
      });
    }
    if (sessions.length === 0) { setError("Todos os horários selecionados já estão ocupados."); return null; }
    try {
      await Promise.all(sessions.map((s) => addDoc(collection(db!, "workoutSessions"), s)));
      return { created: sessions.length, skipped };
    } catch (err: any) {
      console.error(err);
      setError("Erro ao agendar: " + err.message);
      return null;
    }
  }

  async function startSession(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), { status: "in_progress", startedAt: new Date().toISOString() });
      setError(""); setMessage("Aula iniciada! O cronômetro está rodando."); setTimeout(() => setMessage(""), 3000);
    } catch (err: any) { console.error(err); setError("Erro ao iniciar aula: " + err.message); }
  }

  async function completeSession(workout: WorkoutSession) {
    if (!db) return;
    try {
      const now = new Date();
      const startedAt = workout.startedAt ? new Date(workout.startedAt) : now;
      const actualDurationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));
      const enrollmentId = `${workout.studentId}__${workout.trainerId}`;
      const batch = writeBatch(db);
      batch.update(doc(db, "workoutSessions", workout.id), { status: "completed", completedAt: now.toISOString(), actualDurationMinutes });
      batch.update(doc(db, "enrollments", enrollmentId), { classesUsed: increment(1) });
      await batch.commit();
      setError("");
      setCompletedSummary({
        studentFirstName: (workout.studentName || "Aluno").split(" ")[0],
        focus: workout.proposedWorkout || workout.title || "Treino",
        durationMinutes: actualDurationMinutes,
        calories: workout.plannedCalories || Math.round(actualDurationMinutes * 6),
      });
    } catch (err: any) { console.error(err); setError("Erro ao concluir aula: " + err.message); }
  }

  async function markNoShow(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), { status: "no_show" });
      setError(""); setMessage("Falta registrada."); setTimeout(() => setMessage(""), 2500);
    } catch (err: any) { console.error(err); setError("Erro ao registrar falta: " + err.message); }
  }

  async function undoAttendance(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), { status: "scheduled", startedAt: null, completedAt: null, actualDurationMinutes: null });
      setError(""); setMessage("Marcação desfeita."); setTimeout(() => setMessage(""), 2500);
    } catch (err: any) { console.error(err); setError("Erro ao desfazer: " + err.message); }
  }

  async function deleteSession(workout: WorkoutSession) {
    if (!db) return;
    if (!window.confirm(`Excluir a aula de ${workout.studentName} em ${formatDateTime(workout.startsAt)}?`)) return;
    try {
      await deleteDoc(doc(db, "workoutSessions", workout.id));
      setError(""); setMessage("Aula excluída."); setTimeout(() => setMessage(""), 3000);
    } catch (err: any) { console.error(err); setError("Erro ao excluir: " + err.message); }
  }

  async function handleScheduleSlot() {
    if (!schedulerSlot) return;
    const student = students[selectedStudentIdx];
    if (!student) { setError("Selecione um aluno."); return; }
    setSaving(true); setError(""); setMessage("");
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
    setError(""); setMessage("");
  }

  const detailDateSlots = useMemo(() => {
    const targetDate = selectedMonthDay || new Date();
    const weekdays: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const weekday = weekdays[targetDate.getDay()];
    const dayAvail = availability.find((d) => d.weekday === weekday);
    if (!dayAvail || !dayAvail.active) return ["08:00", "10:00", "14:00", "16:00"];
    return [
      ...periodSlots(dayAvail.morningStartTime, dayAvail.morningEndTime, dayAvail.classDurationMinutes),
      ...periodSlots(dayAvail.afternoonStartTime, dayAvail.afternoonEndTime, dayAvail.classDurationMinutes),
    ];
  }, [selectedMonthDay, availability]);

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
    <section className="mx-auto max-w-6xl px-4 pt-4 pb-6 animate-fade-in">
      {message && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm font-semibold text-emerald-800 animate-slide-up">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-semibold text-rose-800 animate-slide-up">{error}</div>
      )}

      <div>
        <section className="card p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-stone-150 pb-4">
            <div className="flex-1">
              <h2 className="text-lg font-black text-stone-950">Agenda do Treinador</h2>
              {teamMembers && teamMembers.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
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
              <div className="mt-4 flex items-center justify-center gap-2">
                <button type="button" aria-label="Anterior" className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50" onClick={() => shiftReference(-1)}>
                  <ChevronLeft size={18} />
                </button>
                <span className="min-w-[10rem] text-center text-sm font-black text-stone-800 capitalize">{periodLabel}</span>
                <button type="button" aria-label="Próximo" className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50" onClick={() => shiftReference(1)}>
                  <ChevronRight size={18} />
                </button>
                <button type="button" className="focus-ring ml-1 h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600 hover:bg-stone-50" onClick={() => { setReferenceDate(new Date()); setSelectedMonthDay(null); }}>
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
                onNavigate={shiftReference}
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
                              <UserPlus size={10} className="mr-1 inline" />{workout.assignedToName}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-stone-100 py-3.5">
                          <div className="flex items-center gap-2">
                            <AttendanceControl workout={workout} onStart={startSession} onComplete={completeSession} onNoShow={markNoShow} onUndo={undoAttendance} />
                            <button type="button" aria-label="Excluir aula" className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => deleteSession(workout)}>
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
                      <td colSpan={5} className="py-8 text-center text-sm text-stone-400 italic">Nenhum compromisso agendado para este período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {schedulerSlot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setSchedulerSlot(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
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
                <select className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm" value={selectedStudentIdx} onChange={(e) => setSelectedStudentIdx(parseInt(e.target.value, 10))}>
                  {students.length === 0 && <option value={0}>Nenhum aluno ativo</option>}
                  {students.map((std, idx) => (<option key={std.uid} value={idx}>{std.displayName}</option>))}
                </select>
              </label>

              {teamMembers && teamMembers.length > 0 && (
                <label className="block">
                  <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Atribuir a (Sub-treinador)</span>
                  <select className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm" value={assignSubTrainerId} onChange={(e) => setAssignSubTrainerId(e.target.value)}>
                    <option value="owner">Eu mesmo (Dono do Time)</option>
                    {teamMembers.map(m => (<option key={m.subTrainerId} value={m.subTrainerId}>{m.subTrainerName}</option>))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Treino (Biblioteca)</span>
                <select className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm" value={scheduleTrainingId} onChange={(e) => setScheduleTrainingId(e.target.value)}>
                  <option value="">Nenhum (apenas foco)</option>
                  {(trainings || []).map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                </select>
                <div className="mt-1 flex justify-end">
                  <a href="/app/treinos" target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:text-emerald-800 font-bold">+ Criar Novo Treino</a>
                </div>
              </label>

              <label className="block">
                <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Foco do treino (Opcional)</span>
                <input className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm" placeholder="ex: Membros Inferiores" value={scheduleFocus} onChange={(e) => setScheduleFocus(e.target.value)} />
              </label>

              <RecurrenceFields recurrence={recurrence} setRecurrence={setRecurrence} occurrences={occurrences} setOccurrences={setOccurrences} />
            </div>

            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button type="button" className="focus-ring btn btn-primary h-11 flex-1 text-sm font-bold" disabled={saving || students.length === 0} onClick={handleScheduleSlot}>
                <UserPlus size={15} />{saving ? "Agendando..." : "Confirmar"}
              </button>
              <button type="button" className="focus-ring btn btn-secondary h-11" onClick={() => setSchedulerSlot(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {completedSummary && (
        <WorkoutSummaryModal
          {...completedSummary}
          onClose={() => setCompletedSummary(null)}
        />
      )}
    </section>
  );
}

function RecurrenceFields({
  recurrence, setRecurrence, occurrences, setOccurrences,
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
        <select className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs" value={recurrence} onChange={(e) => setRecurrence(e.target.value as "single" | "weekly" | "biweekly")}>
          <option value="single">Aula única</option>
          <option value="weekly">Semanal</option>
          <option value="biweekly">Quinzenal</option>
        </select>
      </label>
      {recurrence !== "single" && (
        <label className="block">
          <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Qtd. de aulas</span>
          <input className="focus-ring mt-1.5 h-10 w-full rounded-xl border border-stone-200 px-3 text-xs text-center" type="number" min={1} max={52} value={occurrences} onChange={(e) => setOccurrences(e.target.value)} />
        </label>
      )}
    </div>
  );
}

function AttendanceControl({
  workout, onStart, onComplete, onNoShow, onUndo,
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
        <button type="button" title="Desfazer" className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:bg-stone-50 text-xs" onClick={() => onUndo(workout)}>↩</button>
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="flex items-center gap-1">
        <button type="button" title="Finalizar aula" className="focus-ring flex h-8 items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-2 text-white text-3xs font-bold animate-pulse" onClick={() => onComplete(workout)}>
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
        <button type="button" title="Desfazer" className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:bg-stone-50 text-xs" onClick={() => onUndo(workout)}>↩</button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" title="Iniciar aula" aria-label="Iniciar aula" className="focus-ring flex h-7 items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-50 px-1.5 text-emerald-800 text-3xs font-bold hover:bg-emerald-100" onClick={() => onStart(workout)}>
        <Play size={10} /> Iniciar
      </button>
      <button type="button" title="Faltou" aria-label="Marcar falta" className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-rose-600 hover:bg-rose-50" onClick={() => onNoShow(workout)}>
        <X size={12} />
      </button>
    </div>
  );
}

// ── Ícone "zero cortado" (indicador de falta na grade visual) ──────────────────
function SlashedZero({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="5" y1="15" x2="15" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Sub-componentes do Calendário ──────────────────────────────────────────────

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
  onNavigate: (dir: 1 | -1) => void;
}

function getInitials(name: string | undefined | null) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  onNavigate,
}: CalendarVisualProps) {
  // All hooks unconditionally at the top
  const [expandedCell, setExpandedCell] = useState<{ day: Date; slot: string; workout: WorkoutSession | null } | null>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [expandedTrainingId, setExpandedTrainingId] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const weekdayKeys: TrainerAvailabilityDay["weekday"][] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

  function getSlotsForDay(day: Date): string[] {
    const avail = availability.find(a => a.weekday === weekdayKeys[day.getDay()]);
    if (!avail || !avail.active) return [];
    return [
      ...periodSlots(avail.morningStartTime, avail.morningEndTime, avail.classDurationMinutes),
      ...periodSlots(avail.afternoonStartTime, avail.afternoonEndTime, avail.classDurationMinutes),
    ];
  }

  function isSlotPast(day: Date, slot: string): boolean {
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    return new Date(`${y}-${m}-${d}T${slot}:00`).getTime() < Date.now();
  }

  // ── SEMANA: grade compacta, clique para ampliar ───────────────────────────
  if (view === "week") {
    const days = weekDays(referenceDate);

    const allSlots = Array.from(new Set(
      days.flatMap(day => getSlotsForDay(day))
    )).sort();

    return (
      <>
        <div className="mt-4 overflow-x-auto rounded-xl">
          <div className="min-w-[500px]">
            {/* Cabeçalho dos dias */}
            <div className="grid border-b border-stone-100 pb-2 mb-1" style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}>
              <div />
              {days.map(day => {
                const isToday = isSameDay(day.toISOString(), new Date());
                return (
                  <div key={day.toISOString()} className="text-center py-1.5">
                    <p className={["text-3xs font-black uppercase tracking-wider", isToday ? "text-emerald-700" : "text-stone-400"].join(" ")}>
                      {new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day).replace('.', '').substring(0, 3)}
                    </p>
                    <div className={["mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black", isToday ? "bg-emerald-600 text-white" : "text-stone-800"].join(" ")}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Linhas por horário */}
            {allSlots.length === 0 ? (
              <p className="py-10 text-center text-sm italic text-stone-400">Nenhum horário de expediente configurado para esta semana.</p>
            ) : (
              allSlots.map(slot => (
                <div
                  key={slot}
                  className="grid items-center border-b border-stone-50 hover:bg-stone-50/60 transition-colors"
                  style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}
                >
                  <p className="py-2 pr-2 text-right text-3xs font-black text-stone-400 select-none">{slot}</p>
                  {days.map(day => {
                    const inDaySlots = getSlotsForDay(day).includes(slot);
                    if (!inDaySlots) return <div key={day.toISOString()} className="py-1 px-0.5" />;

                    const dayWorkouts = workouts.filter(w => isSameDay(w.startsAt, day));
                    const workout = workoutAtSlot(dayWorkouts, slot);
                    const past = isSlotPast(day, slot);

                    return (
                      <div key={day.toISOString()} className="py-1 px-0.5">
                        <button
                          type="button"
                          onClick={() => { if (workout || !past) setExpandedCell({ day, slot, workout: workout || null }); }}
                          disabled={!workout && past}
                          title={workout ? workout.studentName : past ? "Horário passado" : "Horário livre — clique para agendar"}
                          className={[
                            "w-full rounded-lg py-2 text-center text-2xs font-black transition-all focus-ring",
                            workout
                              ? "bg-rose-100 text-rose-800 border border-rose-200 hover:scale-105 hover:shadow-md hover:bg-rose-200 cursor-pointer"
                              : past
                                ? "bg-stone-100 text-stone-300 border border-transparent cursor-not-allowed opacity-60"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 hover:scale-105 hover:border-emerald-300 cursor-pointer"
                          ].join(" ")}
                        >
                          {workout ? getInitials(workout.studentName) : (past ? "—" : "+")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal flutuante do horário selecionado */}
        {expandedCell && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setExpandedCell(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden animate-scale-in"
              onClick={e => e.stopPropagation()}
            >
              <div className="border-b border-stone-100 bg-stone-50 px-6 py-4 flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400 capitalize">
                    {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(expandedCell.day)}
                  </p>
                  <p className="mt-0.5 text-3xl font-black text-stone-900">{expandedCell.slot}</p>
                </div>
                <button type="button" onClick={() => setExpandedCell(null)} className="mt-1 rounded-full p-1.5 hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 py-5">
                {expandedCell.workout ? (
                  <>
                    <p className="text-xl font-black text-stone-900">{expandedCell.workout.studentName}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {expandedCell.workout.proposedWorkout ?? expandedCell.workout.title} · {expandedCell.workout.durationMinutes} min
                    </p>
                    {expandedCell.workout.assignedToName && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <UserPlus size={11} /> {expandedCell.workout.assignedToName}
                      </span>
                    )}
                    <div className="mt-5 flex items-center gap-2 flex-wrap">
                      {/* Play / Finalizar */}
                      {(expandedCell.workout.status === 'scheduled' || expandedCell.workout.status === 'in_progress') && (
                        <button
                          type="button"
                          title={expandedCell.workout.status === 'in_progress' ? "Finalizar aula" : "Iniciar aula"}
                          onClick={() => {
                            if (expandedCell.workout!.status === 'in_progress') onComplete(expandedCell.workout!);
                            else onStart(expandedCell.workout!);
                            setExpandedCell(null);
                          }}
                          className={["flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold shadow-sm transition-all", expandedCell.workout.status === 'in_progress' ? "bg-emerald-600 text-white animate-pulse" : "bg-emerald-500 text-white hover:bg-emerald-600"].join(" ")}
                        >
                          <Play size={14} className="ml-0.5 shrink-0" />
                          {expandedCell.workout.status === 'in_progress' ? "Finalizar" : "Iniciar"}
                        </button>
                      )}
                      {/* Falta (zero cortado) */}
                      {(expandedCell.workout.status === 'scheduled' || expandedCell.workout.status === 'in_progress') && (
                        <button type="button" title="Marcar falta" onClick={() => { onNoShow(expandedCell.workout!); setExpandedCell(null); }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all">
                          <SlashedZero size={16} />
                        </button>
                      )}
                      {/* Desfazer */}
                      {(expandedCell.workout.status === 'completed' || expandedCell.workout.status === 'no_show') && (
                        <button type="button" title="Desfazer" onClick={() => { onUndo(expandedCell.workout!); setExpandedCell(null); }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 text-sm transition-all">↩</button>
                      )}
                      {/* Excluir */}
                      <button type="button" title="Excluir aula" onClick={() => { onDelete(expandedCell.workout!); setExpandedCell(null); }} className="focus-ring ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-500 bg-white hover:bg-rose-50 shadow-sm transition-all">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {expandedCell.workout.status === 'in_progress' && expandedCell.workout.trainingId && (
                      <div className="mt-4 pt-4 border-t border-stone-100">
                        <ActiveTrainingDetails training={trainings.find(t => t.id === expandedCell.workout!.trainingId)} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-emerald-700">Horário livre — disponível para agendamento</p>
                    <button type="button" className="focus-ring mt-4 w-full btn btn-primary h-11 text-sm font-bold" onClick={() => { onScheduleSlot(expandedCell.day, expandedCell.slot); setExpandedCell(null); }}>
                      <UserPlus size={16} /> Agendar Aluno
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── MÊS: grade mensal (mantida como está) — clique abre modal do dia ─────
  if (view === "month") {
    const today = referenceDate;
    const days = monthGridDays(today);
    const WEEK_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const selectedDayWorkouts = selectedMonthDay ? workouts.filter((w) => isSameDay(w.startsAt, selectedMonthDay)) : [];

    return (
      <>
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
              const weekday = weekdayKeys[day.getDay()];
              const dayAvail = availability.find((d) => d.weekday === weekday);
              const hasExpediente = dayAvail && dayAvail.active;
              const occupancy = dayWorkouts.length;
              const isSel = selectedMonthDay && isSameDay(day.toISOString(), selectedMonthDay);
              const totalSlots = dayAvail && dayAvail.active ? (periodSlots(dayAvail.morningStartTime, dayAvail.morningEndTime, dayAvail.classDurationMinutes).length + periodSlots(dayAvail.afternoonStartTime, dayAvail.afternoonEndTime, dayAvail.classDurationMinutes).length) : 0;
              const radius = 16;
              const circumference = 2 * Math.PI * radius;
              const percentage = totalSlots > 0 ? Math.min((occupancy / totalSlots) * 100, 100) : 0;
              const offset = circumference - (percentage / 100) * circumference;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={[
                    "focus-ring min-h-16 rounded-xl border p-1 sm:p-2 text-center transition-all flex items-center justify-center relative",
                    inCurrentMonth ? "bg-white border-stone-200 hover:scale-105 hover:border-emerald-300 shadow-sm hover:shadow-md z-10" : "bg-stone-50 border-stone-150 opacity-40",
                    !hasExpediente && inCurrentMonth ? "bg-stone-50/50" : "",
                    isSel ? "ring-2 ring-emerald-500 ring-offset-1 scale-105 z-20 shadow-md" : ""
                  ].join(" ")}
                  onClick={() => onSelectMonthDay(day)}
                >
                  <div className="relative flex items-center justify-center w-10 h-10">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
                      {hasExpediente && <circle cx="20" cy="20" r={radius} className="stroke-stone-100" strokeWidth="3" fill="none" />}
                      {hasExpediente && occupancy > 0 && <circle cx="20" cy="20" r={radius} className="stroke-emerald-500 transition-all duration-500 ease-out" strokeWidth="3" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />}
                    </svg>
                    <span className={["relative text-sm font-black z-10", hasExpediente ? "text-stone-900" : "text-stone-400"].join(" ")}>{day.getDate()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal flutuante do dia selecionado */}
        {selectedMonthDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onCloseMonthDay}>
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white/80 backdrop-blur-md px-6 py-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Agenda do dia</p>
                  <h3 className="mt-1 text-2xl font-black text-stone-900">{formatDate(selectedMonthDay.toISOString())}</h3>
                </div>
                <button type="button" className="focus-ring flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-900 transition-colors" onClick={onCloseMonthDay}>
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto px-6 pt-6 pb-10 flex flex-col gap-4">
                {detailSlots.map((slot) => {
                  const workout = workoutAtSlot(selectedDayWorkouts, slot);
                  let isPast = false;
                  if (selectedMonthDay) {
                    const y = selectedMonthDay.getFullYear();
                    const m = String(selectedMonthDay.getMonth() + 1).padStart(2, "0");
                    const d = String(selectedMonthDay.getDate()).padStart(2, "0");
                    isPast = new Date(`${y}-${m}-${d}T${slot}:00`).getTime() < Date.now();
                  }
                  return (
                    <article key={slot} className={["grid gap-3 rounded-2xl border p-4 sm:grid-cols-[4rem_1fr_auto] items-center transition-all", workout ? "border-amber-200 bg-amber-50/40" : (isPast ? "border-stone-150 bg-stone-50" : "border-emerald-200 bg-white shadow-sm hover:shadow-md")].join(" ")}>
                      <p className={["font-black text-base text-right sm:text-left", workout ? "text-amber-800" : (isPast ? "text-stone-400" : "text-emerald-800")].join(" ")}>{slot}</p>
                      {workout ? (
                        <div>
                          <p className="font-bold text-base text-stone-950">{workout.studentName}</p>
                          <p className="mt-0.5 text-sm text-stone-600 font-medium flex items-center gap-2 flex-wrap">
                            <span>{workout.proposedWorkout ?? workout.title} · {workout.durationMinutes} min</span>
                            {workout.assignedToName && (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                                <UserPlus size={12} className="mr-1" />{workout.assignedToName}
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className={["font-bold text-sm", isPast ? "text-stone-400" : "text-emerald-700"].join(" ")}>Horário livre {isPast && "(Passado)"}</p>
                      )}
                      {workout ? (
                        <div className="flex items-center justify-end gap-2">
                          <AttendanceControl workout={workout} onStart={onStart} onComplete={onComplete} onNoShow={onNoShow} onUndo={onUndo} />
                          <button type="button" aria-label="Excluir aula" className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 shadow-sm" onClick={() => { onDelete(workout); onCloseMonthDay(); }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        selectedMonthDay && (
                          <button type="button" disabled={isPast} className={["focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold shadow-sm transition-all sm:w-auto w-full", isPast ? "border-transparent bg-stone-100/50 text-stone-400 cursor-not-allowed" : "border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md"].join(" ")} onClick={() => { if (!isPast) { onScheduleSlot(selectedMonthDay, slot); onCloseMonthDay(); } }}>
                            {isPast ? <X size={16} /> : <UserPlus size={16} />}
                            {isPast ? "Indisponível" : "Agendar Aluno"}
                          </button>
                        )
                      )}
                    </article>
                  );
                })}
                {detailSlots.length === 0 && (
                  <p className="text-center text-sm text-stone-500 italic py-10 bg-stone-50 border border-stone-200 rounded-2xl">
                    Você não tem horários de expediente configurados para este dia da semana.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── DIA: carrossel 3D (ontem | hoje | amanhã) ─────────────────────────────
  const prevDay = new Date(referenceDate);
  prevDay.setDate(referenceDate.getDate() - 1);
  const nextDay = new Date(referenceDate);
  nextDay.setDate(referenceDate.getDate() + 1);

  function handleTouchStart(e: React.TouchEvent) {
    setDragStartX(e.touches[0].clientX);
    setDragOffset(0);
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartX === null) return;
    setDragOffset(e.touches[0].clientX - dragStartX);
  }
  function handleTouchEnd() {
    if (dragOffset < -60) onNavigate(1);
    else if (dragOffset > 60) onNavigate(-1);
    setDragStartX(null);
    setDragOffset(0);
  }

  function renderCarouselDaySlots(day: Date) {
    const slots = getSlotsForDay(day);
    const dayWorkouts = workouts.filter(w => isSameDay(w.startsAt, day));

    if (slots.length === 0) {
      return <p className="py-8 text-center text-xs text-stone-400 italic">Sem expediente configurado para este dia.</p>;
    }

    return slots.map(slot => {
      const workout = workoutAtSlot(dayWorkouts, slot);
      const past = isSlotPast(day, slot);

      if (workout) {
        return (
          <article
            key={slot}
            className={[
              "rounded-2xl border p-4 transition-all",
              workout.status === "completed" ? "bg-emerald-50 border-emerald-200"
              : workout.status === "no_show" ? "bg-rose-50 border-rose-200"
              : workout.status === "in_progress" ? "bg-amber-50 border-amber-300 shadow-md"
              : "bg-white border-amber-200 shadow-sm"
            ].join(" ")}
          >
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black text-stone-400">{slot}</span>
                <p className="font-black text-stone-900 text-base leading-tight truncate">{workout.studentName}</p>
                <p className="text-xs text-stone-500 mt-0.5 truncate">{workout.proposedWorkout ?? workout.title} · {workout.durationMinutes} min</p>
              </div>
              {workout.status === "completed" && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-3xs font-black text-emerald-800">✓ Feita</span>}
              {workout.status === "no_show" && <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-3xs font-black text-rose-800">Falta</span>}
              {workout.status === "in_progress" && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-3xs font-black text-amber-800 animate-pulse">Em andamento</span>}
            </div>
            <div className="flex items-center gap-2">
              {/* Play */}
              {workout.status === 'scheduled' && (
                <button type="button" title="Iniciar aula" onClick={() => onStart(workout)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-all">
                  <Play size={15} className="ml-0.5" />
                </button>
              )}
              {workout.status === 'in_progress' && (
                <button type="button" title="Finalizar aula" onClick={() => onComplete(workout)} className="flex h-10 items-center gap-1.5 px-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm animate-pulse text-xs font-bold">
                  <Square size={12} /> Finalizar
                </button>
              )}
              {/* Falta: zero cortado */}
              {(workout.status === 'scheduled' || workout.status === 'in_progress') && (
                <button type="button" title="Marcar falta" onClick={() => onNoShow(workout)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all">
                  <SlashedZero size={16} />
                </button>
              )}
              {/* Desfazer */}
              {(workout.status === 'completed' || workout.status === 'no_show') && (
                <button type="button" title="Desfazer" onClick={() => onUndo(workout)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 text-sm transition-all">↩</button>
              )}
              {/* Excluir */}
              <button type="button" title="Excluir" onClick={() => onDelete(workout)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all">
                <Trash2 size={14} />
              </button>
            </div>
            {workout.trainingId && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setExpandedTrainingId(expandedTrainingId === workout.id ? null : workout.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 mb-2"
                >
                  <Dumbbell size={13} />
                  {expandedTrainingId === workout.id ? "Ocultar treino" : "Ver treino"}
                </button>
                {expandedTrainingId === workout.id && (
                  <ActiveTrainingDetails training={trainings.find(t => t.id === workout.trainingId)} />
                )}
              </div>
            )}
          </article>
        );
      }

      return (
        <button
          key={slot}
          type="button"
          disabled={past}
          onClick={() => !past && onScheduleSlot(day, slot)}
          className={[
            "w-full rounded-2xl border px-4 py-3.5 text-left transition-all group",
            past ? "border-transparent bg-stone-100/50 cursor-not-allowed" : "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md cursor-pointer"
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className={["text-xs font-black", past ? "text-stone-300" : "text-emerald-700"].join(" ")}>{slot}</span>
              <p className={["text-sm mt-0.5 font-semibold", past ? "text-stone-300" : "text-stone-500"].join(" ")}>
                {past ? "Horário passado" : "Horário livre"}
              </p>
            </div>
            {!past && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200 transition-colors">
                <UserPlus size={14} />
              </span>
            )}
          </div>
        </button>
      );
    });
  }

  function renderSideDots(day: Date) {
    const slots = getSlotsForDay(day);
    const dayWorkouts = workouts.filter(w => isSameDay(w.startsAt, day));
    return (
      <div className="flex-1 flex flex-col items-center gap-1.5 py-4">
        {slots.length === 0
          ? <span className="text-3xs text-stone-300 mt-2">—</span>
          : slots.map(slot => {
            const w = workoutAtSlot(dayWorkouts, slot);
            return <div key={slot} className={["w-2 h-2 rounded-full", w ? "bg-stone-500" : "bg-stone-200"].join(" ")} />;
          })
        }
      </div>
    );
  }

  function renderDayHeader(day: Date, isCenter: boolean) {
    const isToday = isSameDay(day.toISOString(), new Date());
    return (
      <div className={["px-3 py-4 text-center", isCenter ? (isToday ? "bg-emerald-600" : "bg-stone-800") : "bg-stone-200"].join(" ")}>
        {isCenter ? (
          <>
            <p className="text-xs font-black uppercase tracking-wider text-white/70 capitalize">
              {new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(day)}
            </p>
            <p className="text-5xl font-black text-white mt-1">{day.getDate()}</p>
            <p className="text-xs text-white/60 capitalize mt-0.5">
              {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(day)}
            </p>
          </>
        ) : (
          <>
            <p className="text-3xs font-black uppercase text-stone-400">
              {new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day).replace('.', '')}
            </p>
            <p className="text-2xl font-black text-stone-400 mt-1">{day.getDate()}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={carouselRef}
      className="mt-6 relative select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: dragOffset !== 0 ? `translateX(${Math.sign(dragOffset) * Math.min(Math.abs(dragOffset) * 0.15, 18)}px)` : undefined,
        transition: dragOffset === 0 ? "transform 0.3s ease" : "none",
      }}
    >
      <div className="flex items-stretch justify-center gap-2 sm:gap-4">
        {/* Dia anterior */}
        <div
          className="flex-[0_0_14%] sm:flex-[0_0_18%] flex flex-col rounded-2xl overflow-hidden border border-stone-100 bg-stone-50 shadow-sm opacity-50 blur-[1.5px] cursor-pointer hover:opacity-60 transition-opacity"
          onClick={() => onNavigate(-1)}
          title="Dia anterior"
        >
          {renderDayHeader(prevDay, false)}
          {renderSideDots(prevDay)}
        </div>

        {/* Dia atual — destaque */}
        <div className="flex-[1_0_60%] sm:flex-[1_0_55%] max-w-[72%] sm:max-w-[60%] flex flex-col rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-2xl z-10" style={{ transform: "translateY(-6px)" }}>
          {renderDayHeader(referenceDate, true)}
          <div className="p-4 space-y-3 pb-6">
            {renderCarouselDaySlots(referenceDate)}
          </div>
        </div>

        {/* Próximo dia */}
        <div
          className="flex-[0_0_14%] sm:flex-[0_0_18%] flex flex-col rounded-2xl overflow-hidden border border-stone-100 bg-stone-50 shadow-sm opacity-50 blur-[1.5px] cursor-pointer hover:opacity-60 transition-opacity"
          onClick={() => onNavigate(1)}
          title="Próximo dia"
        >
          {renderDayHeader(nextDay, false)}
          {renderSideDots(nextDay)}
        </div>
      </div>

      <p className="mt-3 text-center text-3xs text-stone-400 select-none">
        ← Arraste ou clique nos painéis laterais para navegar →
      </p>
    </div>
  );
}

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
