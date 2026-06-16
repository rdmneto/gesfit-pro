import { CalendarDays, ChevronLeft, ChevronRight, Clock, Flame, List, Play, Dumbbell, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { WorkoutSession, Training } from "../../types/domain";
import { isSameDay, monthGridDays, weekDays } from "./dashboardUtils";

type View = "day" | "week" | "month";

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Agenda de treinos do aluno — apresentação em Lista ou Calendário (dia/semana/mês). */
export function StudentAgenda({ workouts, trainings }: { workouts: WorkoutSession[], trainings?: Training[] }) {
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const [view, setView] = useState<View>("week");
  const [ref, setRef] = useState(new Date());

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => (a.startsAt || "").localeCompare(b.startsAt || "")),
    [workouts],
  );

  function shift(dir: 1 | -1) {
    setRef((prev) => {
      const d = new Date(prev);
      if (view === "day") d.setDate(d.getDate() + dir);
      else if (view === "week") d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  }

  const periodLabel = (() => {
    if (view === "day") return ref.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    if (view === "week") {
      const ds = weekDays(ref);
      const f = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return `${f(ds[0])} – ${f(ds[6])}`;
    }
    return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  return (
    <section className="card p-5">
      <div className="flex flex-col justify-between gap-3 border-b border-stone-150 pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-stone-950">Agenda de treinos</h2>
          <p className="mt-0.5 text-xs text-stone-500">Seus treinos com o treinador ativo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "calendar" && (
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-1">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={[
                    "focus-ring h-8 rounded-md px-3 text-xs font-semibold transition-all",
                    view === v ? "bg-white text-emerald-900 shadow-sm font-black" : "text-stone-500",
                  ].join(" ")}
                  onClick={() => setView(v)}
                >
                  {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          )}
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-1">
            {(["calendar", "list"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={[
                  "focus-ring inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all",
                  mode === m ? "bg-white text-emerald-900 shadow-sm font-black" : "text-stone-500",
                ].join(" ")}
                onClick={() => setMode(m)}
              >
                {m === "calendar" ? <CalendarDays size={13} /> : <List size={13} />}
                {m === "calendar" ? "Calendário" : "Lista"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === "list" ? (
        <div className="mt-4 grid gap-3">
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-stone-400">Nenhum treino agendado.</p>
          ) : (
            sorted.map((w) => <WorkoutCard key={w.id} workout={w} trainings={trainings} />)
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button type="button" aria-label="Anterior" className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50" onClick={() => shift(-1)}>
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-black capitalize text-stone-800">{periodLabel}</span>
            <button type="button" aria-label="Próximo" className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white hover:bg-stone-50" onClick={() => shift(1)}>
              <ChevronRight size={18} />
            </button>
            <button type="button" className="focus-ring ml-1 h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600 hover:bg-stone-50" onClick={() => setRef(new Date())}>
              Hoje
            </button>
          </div>

          {view === "day" && <DayView workouts={sorted} day={ref} trainings={trainings} />}
          {view === "week" && <WeekView workouts={sorted} reference={ref} />}
          {view === "month" && <MonthView workouts={sorted} reference={ref} trainings={trainings} />}
        </>
      )}
    </section>
  );
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

function WorkoutCard({ workout, trainings }: { workout: WorkoutSession; trainings?: Training[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedVideoIdx, setExpandedVideoIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const training = workout.trainingId ? trainings?.find((t) => t.id === workout.trainingId) : null;

  async function handleComplete() {
    if (!db) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), {
        studentCompletedAt: new Date().toISOString(),
      });
      setExpanded(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao concluir treino.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-xl border border-[var(--color-border)] p-4 transition-all bg-white hover:border-emerald-300">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{workout.modality}</p>
          <h3 className="mt-0.5 font-black text-stone-950">{workout.title}</h3>
          <p className="mt-1 text-sm text-stone-500">{fmtDateTime(workout.startsAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-600">
            <Clock size={12} /> {workout.durationMinutes} min
          </span>
          {workout.studentCompletedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              <CheckCircle2 size={12} /> Feito
            </span>
          )}
        </div>
      </div>
      
      {!expanded && workout.exercises?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {workout.exercises.map((e) => (
            <span key={e} className="badge badge-green">{e}</span>
          ))}
        </div>
      )}
      
      {workout.plannedCalories > 0 && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
          <Flame size={12} /> Meta {workout.plannedCalories} kcal
        </p>
      )}

      {training && !workout.studentCompletedAt && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <button
            type="button"
            className="w-full focus-ring flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
            onClick={() => setExpanded(!expanded)}
          >
            <Dumbbell size={16} />
            {expanded ? "Ocultar Treino" : "Iniciar Treino agora"}
            {expanded ? <ChevronUp size={16} className="ml-auto" /> : <ChevronDown size={16} className="ml-auto" />}
          </button>
        </div>
      )}

      {expanded && training && (
        <div className="mt-4 animate-slide-up space-y-3">
          {training.exercises.map((ex, idx) => {
            const ytId = getYouTubeId(ex.videoUrl || "");
            const isVideoExpanded = expandedVideoIdx === idx;

            return (
              <div key={idx} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-stone-900 text-sm">
                    {ex.order + 1}. {ex.name}
                  </h4>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                  <div className="bg-white px-2 py-1.5 rounded-lg border border-stone-150">
                    <span className="font-bold text-stone-500 block text-[10px] uppercase">Séries</span>
                    <span className="font-medium text-stone-900">{ex.sets || "-"}</span>
                  </div>
                  <div className="bg-white px-2 py-1.5 rounded-lg border border-stone-150">
                    <span className="font-bold text-stone-500 block text-[10px] uppercase">Pausa</span>
                    <span className="font-medium text-stone-900">{ex.rest || "-"}</span>
                  </div>
                </div>

                {ex.notes && (
                  <p className="mb-2 text-xs italic text-stone-600">"{ex.notes}"</p>
                )}

                {ytId && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="focus-ring flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700"
                      onClick={() => setExpandedVideoIdx(isVideoExpanded ? null : idx)}
                    >
                      <Play size={14} /> 
                      {isVideoExpanded ? "Ocultar Vídeo" : "Assistir Vídeo"}
                    </button>
                    
                    {isVideoExpanded && (
                      <div className="mt-2 overflow-hidden rounded-lg aspect-video bg-stone-900 animate-fade-in">
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${ytId}`}
                          title={ex.name}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-4 pt-4 border-t border-stone-200">
            <button
              type="button"
              className="focus-ring btn btn-primary w-full shadow-[var(--shadow-brand)] h-12"
              disabled={submitting}
              onClick={handleComplete}
            >
              <CheckCircle2 size={20} />
              {submitting ? "Registrando..." : "Concluir Treino"}
            </button>
            <p className="mt-2 text-center text-[10px] text-stone-400">
              Isso registrará que você completou o treino. O crédito da aula só será abatido pelo seu treinador.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

function DayView({ workouts, day, trainings }: { workouts: WorkoutSession[]; day: Date; trainings?: Training[] }) {
  const items = workouts.filter((w) => isSameDay(w.startsAt, day));
  return (
    <div className="mt-4 grid gap-3">
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm italic text-stone-400">Nenhum treino neste dia.</p>
      ) : (
        items.map((w) => <WorkoutCard key={w.id} workout={w} trainings={trainings} />)
      )}
    </div>
  );
}

function WeekView({ workouts, reference }: { workouts: WorkoutSession[]; reference: Date }) {
  const days = weekDays(reference);
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-7 gap-2">
        {days.map((day) => {
          const items = workouts.filter((w) => isSameDay(w.startsAt, day));
          const isToday = isSameDay(day.toISOString(), new Date());
          return (
            <section key={day.toISOString()} className="min-h-48 rounded-xl border border-stone-200 bg-stone-50 p-2">
              <div className={["rounded-lg p-2 text-center shadow-2xs", isToday ? "bg-emerald-700 text-white" : "bg-white"].join(" ")}>
                <p className={["text-3xs font-bold uppercase", isToday ? "text-emerald-100" : "text-emerald-800"].join(" ")}>
                  {new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day)}
                </p>
                <p className={["mt-0.5 text-xl font-black", isToday ? "text-white" : "text-stone-900"].join(" ")}>{day.getDate()}</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {items.length === 0 ? (
                  <p className="rounded-lg border border-stone-200 bg-white p-2 text-center text-4xs font-semibold text-stone-300">—</p>
                ) : (
                  items.map((w) => (
                    <article key={w.id} className="overflow-hidden rounded-lg border border-emerald-200 bg-white p-1.5">
                      <strong className="block text-3xs text-emerald-800">{fmtTime(w.startsAt)}</strong>
                      <p className="mt-0.5 break-words text-4xs font-bold leading-tight text-stone-700 line-clamp-2">{w.title}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ workouts, reference, trainings }: { workouts: WorkoutSession[]; reference: Date; trainings?: Training[] }) {
  const [selected, setSelected] = useState<Date | null>(null);
  const days = monthGridDays(reference);
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const selectedItems = selected ? workouts.filter((w) => isSameDay(w.startsAt, selected)) : [];

  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-1">
        {labels.map((l) => (
          <p key={l} className="py-2 text-center text-3xs font-black uppercase text-stone-450">{l}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const count = workouts.filter((w) => isSameDay(w.startsAt, day)).length;
          const inMonth = day.getMonth() === reference.getMonth();
          const isSel = selected && isSameDay(day.toISOString(), selected);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelected(day)}
              className={[
                "focus-ring flex min-h-16 flex-col rounded-xl border p-2 text-left transition-all",
                inMonth ? "border-stone-200 bg-white hover:border-emerald-400" : "border-stone-150 bg-stone-50 opacity-40",
                isSel ? "border-emerald-500 ring-1 ring-emerald-400" : "",
              ].join(" ")}
            >
              <span className="text-xs font-black text-stone-800">{day.getDate()}</span>
              {count > 0 && (
                <span className="mt-auto inline-flex w-max items-center rounded bg-emerald-50 px-1.5 py-0.5 text-3xs font-bold text-emerald-800">
                  {count} treino{count > 1 ? "s" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="mt-4 grid gap-3">
          {selectedItems.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-stone-400">Nenhum treino em {selected.toLocaleDateString("pt-BR")}.</p>
          ) : (
            selectedItems.map((w) => <WorkoutCard key={w.id} workout={w} trainings={trainings} />)
          )}
        </div>
      )}
    </div>
  );
}
