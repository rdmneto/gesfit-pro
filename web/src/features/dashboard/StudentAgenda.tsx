import { buttonVariants } from "../../components/ui/Button";
import { cardClasses, badgeVariants } from "../../components/ui/Primitives";
import { cn } from "../../lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Flame, List, PlayCircle, Dumbbell, CheckCircle2, ChevronDown, ChevronUp, X, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useDocument } from "../../lib/hooks";
import type { WorkoutSession, Training } from "../../types/domain";
import { isSameDay, monthGridDays, weekDays } from "./dashboardUtils";
import { WorkoutSummaryModal } from "../../components/WorkoutSummaryModal";

type View = "day" | "week" | "month";

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function getInitials(name: string | undefined | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Agenda de treinos do aluno — Lista ou Calendário (dia-carrossel / semana-compacta / mês). */
export function StudentAgenda({ workouts, trainings, trainerName }: { workouts: WorkoutSession[]; trainings?: Training[]; trainerName?: string }) {
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  const [view, setView] = useState<View>("day");
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
    <section className={cn(cardClasses, "p-5")}>
      <div className="flex flex-col justify-between gap-3 border-b border-stone-150 pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-black text-stone-950">Agenda do Aluno</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "calendar" && (
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-1">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={["focus-ring h-8 rounded-md px-3 text-xs font-semibold transition-all", view === v ? "bg-white text-emerald-900 shadow-sm font-black" : "text-stone-500"].join(" ")}
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
                className={["focus-ring inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all", mode === m ? "bg-white text-emerald-900 shadow-sm font-black" : "text-stone-500"].join(" ")}
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
          {sorted.length === 0
            ? <p className="py-8 text-center text-sm italic text-stone-400">Nenhum treino agendado.</p>
            : sorted.map((w) => <WorkoutCard key={w.id} workout={w} trainings={trainings} />)
          }
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

          {view === "day" && <StudentDayCarousel workouts={sorted} reference={ref} onNavigate={shift} trainings={trainings} />}
          {view === "week" && <StudentWeekGrid workouts={sorted} reference={ref} trainerName={trainerName} />}
          {view === "month" && <StudentMonthView workouts={sorted} reference={ref} trainings={trainings} />}
        </>
      )}
    </section>
  );
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (/youtube\.com\/embed\/([\w-]{11})/.test(url)) return url.split("?")[0];
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|watch\?v=|watch\?.+[&?]v=|shorts\/))([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}

function WorkoutCard({ workout, trainings }: { workout: WorkoutSession; trainings?: Training[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedVideoIdx, setExpandedVideoIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const trainingFromParent = workout.trainingId ? trainings?.find((t) => t.id === workout.trainingId) : undefined;
  const { data: trainingFetched } = useDocument<Training>("trainings", !trainingFromParent && workout.trainingId ? workout.trainingId : null);
  const training = trainingFromParent ?? trainingFetched;

  async function handleComplete() {
    if (!db) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), { studentCompletedAt: new Date().toISOString() });
      setExpanded(false);
      setShowSummary(true);
    } catch (error: unknown) { const e = error as Error;
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
          {workout.exercises.map((e) => <span key={e} className={badgeVariants({ variant: "green" })}>{e}</span>)}
        </div>
      )}

      {workout.plannedCalories > 0 && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
          <Flame size={12} /> Meta {workout.plannedCalories} kcal
        </p>
      )}

      {!workout.studentCompletedAt && (
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

      {expanded && (
        <div className="mt-4 animate-slide-up space-y-3">
          {training ? (
            training.exercises.map((ex, idx) => {
              const embedUrl = getEmbedUrl(ex.videoUrl || "");
              const isVideoExpanded = expandedVideoIdx === idx;
              return (
                <div key={idx} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-stone-900 text-sm">{ex.order + 1}. {ex.name}</h4>
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
                  {ex.notes && <p className="mb-2 text-xs italic text-stone-600">"{ex.notes}"</p>}
                  {ex.videoUrl && (
                    <div className="mt-2">
                      <button type="button" className="focus-ring flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700" onClick={() => setExpandedVideoIdx(isVideoExpanded ? null : idx)}>
                        <PlayCircle size={14} /> {isVideoExpanded ? "Ocultar Vídeo" : "Assistir Vídeo"}
                      </button>
                      {isVideoExpanded && (
                        <div className="mt-3">
                          {embedUrl ? (
                            <div className="aspect-video w-full overflow-hidden rounded-lg">
                              <iframe src={embedUrl} title={`Vídeo: ${ex.name}`} className="h-full w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            </div>
                          ) : (
                            <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700">
                              <PlayCircle size={14} /> Abrir vídeo
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
              <p className="text-sm text-stone-600">Este é um treino livre agendado pelo seu treinador.</p>
              {workout.exercises && workout.exercises.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {workout.exercises.map((e) => <span key={e} className={badgeVariants({ variant: "green" })}>{e}</span>)}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-stone-200">
            <button type="button" className={cn(buttonVariants({}), "focus-ring w-full shadow-[var(--shadow-brand)] h-12")} disabled={submitting} onClick={handleComplete}>
              <CheckCircle2 size={20} />
              {submitting ? "Registrando..." : "Concluir Treino"}
            </button>
            <p className="mt-2 text-center text-[10px] text-stone-400">
              Isso registrará que você completou o treino. O crédito da aula só será abatido pelo seu treinador.
            </p>
          </div>
        </div>
      )}

      {showSummary && (
        <WorkoutSummaryModal
          studentFirstName={(workout.studentName || "Aluno").split(" ")[0]}
          focus={workout.proposedWorkout || workout.title || "Treino"}
          durationMinutes={workout.durationMinutes}
          calories={workout.plannedCalories || Math.round(workout.durationMinutes * 6)}
          onClose={() => setShowSummary(false)}
        />
      )}
    </article>
  );
}

// ── VISTA DIA — carrossel 3D (ontem | hoje | amanhã) ──────────────────────────
function StudentDayCarousel({
  workouts, reference, onNavigate, trainings,
}: {
  workouts: WorkoutSession[];
  reference: Date;
  onNavigate: (dir: 1 | -1) => void;
  trainings?: Training[];
}) {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  // "x" e "transition" controlam o sliding do card central
  const [slide, setSlide] = useState({ x: "0px", t: "none" });

  const prevDay = new Date(reference);
  prevDay.setDate(reference.getDate() - 1);
  const nextDay = new Date(reference);
  nextDay.setDate(reference.getDate() + 1);

  function navigateWithAnimation(dir: 1 | -1) {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsDragging(false);
    setDragOffset(0);

    const easing = "cubic-bezier(0.4,0,0.2,1)";
    const exitX  = dir === 1 ? "-110%" : "110%";
    const enterX = dir === 1 ?  "110%" : "-110%";
    const dur = 220;

    // Fase 1 — slide out
    setSlide({ x: exitX, t: `transform ${dur}ms ${easing}` });

    setTimeout(() => {
      // Fase 2 — atualiza conteúdo e posiciona off-screen instantaneamente
      onNavigate(dir);
      setSlide({ x: enterX, t: "none" });

      // Fase 3 — slide in no próximo frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlide({ x: "0px", t: `transform ${dur}ms ${easing}` });
          setTimeout(() => setIsAnimating(false), dur + 20);
        });
      });
    }, dur + 10);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (isAnimating) return;
    setDragStartX(e.touches[0].clientX);
    setIsDragging(true);
    setDragOffset(0);
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartX === null || !isDragging) return;
    setDragOffset(e.touches[0].clientX - dragStartX);
  }
  function handleTouchEnd() {
    setDragStartX(null);
    if (dragOffset < -60) {
      navigateWithAnimation(1);
    } else if (dragOffset > 60) {
      navigateWithAnimation(-1);
    } else {
      // threshold não atingido — snap de volta
      setIsDragging(false);
      setDragOffset(0);
      setSlide({ x: "0px", t: "transform 0.28s cubic-bezier(0.4,0,0.2,1)" });
    }
  }

  // Estilo inline do conteúdo deslizante
  const slideStyle: React.CSSProperties = isDragging
    ? { transform: `translateX(${dragOffset}px)`, transition: "none" }
    : { transform: `translateX(${slide.x})`, transition: slide.t };

  function renderHeader(day: Date, isCenter: boolean) {
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

  function renderSideDots(day: Date) {
    const items = workouts.filter(w => isSameDay(w.startsAt, day));
    return (
      <div className="flex-1 flex flex-col items-center gap-1.5 py-4">
        {items.length === 0
          ? <span className="text-3xs text-stone-300 mt-2">—</span>
          : items.map(w => <div key={w.id} className="w-2 h-2 rounded-full bg-emerald-400" />)
        }
      </div>
    );
  }

  const centerItems = workouts.filter(w => isSameDay(w.startsAt, reference));

  return (
    <div
      className="mt-6 relative select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-stretch justify-center gap-2 sm:gap-4">
        {/* Dia anterior */}
        <div
          className="flex-[0_0_14%] sm:flex-[0_0_18%] flex flex-col rounded-2xl overflow-hidden border border-stone-100 bg-stone-50 shadow-sm opacity-50 blur-[1.5px] cursor-pointer hover:opacity-60 transition-opacity"
          onClick={() => navigateWithAnimation(-1)}
          title="Dia anterior"
        >
          {renderHeader(prevDay, false)}
          {renderSideDots(prevDay)}
        </div>

        {/* Dia atual — container que clippa a animação */}
        <div
          className="flex-[1_0_60%] sm:flex-[1_0_55%] max-w-[72%] sm:max-w-[60%] rounded-2xl overflow-hidden border border-stone-200 shadow-2xl z-10"
          style={{ transform: "translateY(-6px)" }}
        >
          {/* Conteúdo deslizante */}
          <div className="flex flex-col bg-white h-full" style={slideStyle}>
            {renderHeader(reference, true)}
            <div className="p-4 space-y-3 pb-6">
              {centerItems.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-stone-400">Nenhum treino agendado para este dia.</p>
                </div>
              ) : (
                centerItems.map(w => <WorkoutCard key={w.id} workout={w} trainings={trainings} />)
              )}
            </div>
          </div>
        </div>

        {/* Próximo dia */}
        <div
          className="flex-[0_0_14%] sm:flex-[0_0_18%] flex flex-col rounded-2xl overflow-hidden border border-stone-100 bg-stone-50 shadow-sm opacity-50 blur-[1.5px] cursor-pointer hover:opacity-60 transition-opacity"
          onClick={() => navigateWithAnimation(1)}
          title="Próximo dia"
        >
          {renderHeader(nextDay, false)}
          {renderSideDots(nextDay)}
        </div>
      </div>

      <p className="mt-3 text-center text-3xs text-stone-400 select-none">
        ← Arraste ou clique nos painéis laterais para navegar →
      </p>
    </div>
  );
}

// ── VISTA SEMANA — grade compacta, clique para ampliar ────────────────────────
function StudentWeekGrid({
  workouts, reference, trainerName,
}: {
  workouts: WorkoutSession[];
  reference: Date;
  trainerName?: string;
}) {
  const [expandedWorkout, setExpandedWorkout] = useState<WorkoutSession | null>(null);
  const days = weekDays(reference);

  // Coletar horários únicos de sessions da semana para formar as linhas
  const weekWorkouts = useMemo(
    () => workouts.filter(w => days.some(d => isSameDay(w.startsAt, d))),
    [workouts, days]
  );

  // Agrupar horários por dia (coluna) — sem linhas de time-slots fixos
  // Cada dia mostra suas sessions como blocos coloridos

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-xl">
        <div className="min-w-[400px]">
          {/* Cabeçalho dos dias */}
          <div className="grid border-b border-stone-100 pb-2 mb-2" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {days.map(day => {
              const isToday = isSameDay(day.toISOString(), new Date());
              const count = workouts.filter(w => isSameDay(w.startsAt, day)).length;
              return (
                <div key={day.toISOString()} className="text-center py-1.5 px-0.5">
                  <p className={["text-3xs font-black uppercase tracking-wider", isToday ? "text-emerald-700" : "text-stone-400"].join(" ")}>
                    {new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day).replace('.', '').substring(0, 3)}
                  </p>
                  <div className={["mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black", isToday ? "bg-emerald-600 text-white" : "text-stone-800"].join(" ")}>
                    {day.getDate()}
                  </div>
                  {count > 0 && <div className="mx-auto mt-1 h-1 w-1 rounded-full bg-emerald-500" />}
                </div>
              );
            })}
          </div>

          {/* Coluna de sessions por dia */}
          {weekWorkouts.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-stone-400">Nenhum treino agendado para esta semana.</p>
          ) : (
            <div className="grid min-h-[8rem]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {days.map(day => {
                const items = workouts.filter(w => isSameDay(w.startsAt, day));
                return (
                  <div key={day.toISOString()} className="px-0.5 py-1 flex flex-col gap-1">
                    {items.map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setExpandedWorkout(w)}
                        title={w.title}
                        className="w-full rounded-lg py-1.5 px-1 text-center text-2xs font-black transition-all hover:scale-105 hover:shadow-md bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200 cursor-pointer focus-ring"
                      >
                        <span className="block">{fmtTime(w.startsAt)}</span>
                        <span className="block mt-0.5 opacity-70">{getInitials(trainerName)}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal flutuante do treino selecionado */}
      {expandedWorkout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setExpandedWorkout(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b border-stone-100 bg-stone-50 px-6 py-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{expandedWorkout.modality}</p>
                <p className="mt-0.5 text-xl font-black text-stone-900">{expandedWorkout.title}</p>
                <p className="mt-1 text-sm text-stone-500">{fmtDateTime(expandedWorkout.startsAt)}</p>
              </div>
              <button type="button" onClick={() => setExpandedWorkout(null)} className="mt-1 rounded-full p-1.5 hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-600">
                  <Clock size={12} /> {expandedWorkout.durationMinutes} min
                </span>
                {expandedWorkout.studentCompletedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 size={12} /> Concluído
                  </span>
                )}
                {expandedWorkout.plannedCalories > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <Flame size={12} /> {expandedWorkout.plannedCalories} kcal
                  </span>
                )}
              </div>
              {expandedWorkout.exercises?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {expandedWorkout.exercises.map(e => <span key={e} className={badgeVariants({ variant: "green" })}>{e}</span>)}
                </div>
              )}
              <button
                type="button"
                className="w-full focus-ring flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                onClick={() => setExpandedWorkout(null)}
              >
                <Play size={16} /> Ver treino completo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── VISTA MÊS — grade mensal, clique abre modal flutuante do dia ──────────────
function StudentMonthView({
  workouts, reference, trainings,
}: {
  workouts: WorkoutSession[];
  reference: Date;
  trainings?: Training[];
}) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const days = monthGridDays(reference);
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const selectedItems = selectedDay ? workouts.filter(w => isSameDay(w.startsAt, selectedDay)) : [];

  return (
    <>
      <div className="mt-4">
        <div className="grid grid-cols-7 gap-1">
          {labels.map(l => (
            <p key={l} className="py-2 text-center text-3xs font-black uppercase text-stone-450">{l}</p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const count = workouts.filter(w => isSameDay(w.startsAt, day)).length;
            const inMonth = day.getMonth() === reference.getMonth();
            const isSel = selectedDay && isSameDay(day.toISOString(), selectedDay);
            const isToday = isSameDay(day.toISOString(), new Date());

            const radius = 16;
            const circumference = 2 * Math.PI * radius;
            const percentage = Math.min((count / 5) * 100, 100);
            const offset = circumference - (percentage / 100) * circumference;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={[
                  "focus-ring flex min-h-16 flex-col items-center justify-center rounded-xl border p-1 sm:p-2 text-center transition-all shadow-sm relative",
                  inMonth ? "bg-white border-stone-200 hover:scale-105 hover:border-emerald-300 hover:shadow-md z-10" : "bg-stone-50 border-stone-150 opacity-40",
                  isSel ? "ring-2 ring-emerald-500 ring-offset-1 scale-105 z-20 shadow-md" : "",
                ].join(" ")}
              >
                <div className="relative flex items-center justify-center w-10 h-10">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r={radius} className="stroke-stone-100" strokeWidth="3" fill="none" />
                    {count > 0 && <circle cx="20" cy="20" r={radius} className="stroke-emerald-500 transition-all duration-500 ease-out" strokeWidth="3" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />}
                  </svg>
                  <span className={["relative text-sm font-black z-10", isToday ? "text-emerald-700" : "text-stone-900"].join(" ")}>{day.getDate()}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal flutuante do dia selecionado */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white/80 backdrop-blur-md px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-600">Treinos do dia</p>
                <h3 className="mt-1 text-2xl font-black text-stone-900">
                  {selectedDay.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                </h3>
              </div>
              <button type="button" className="focus-ring flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-900 transition-colors" onClick={() => setSelectedDay(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 pt-6 pb-10 flex flex-col gap-4">
              {selectedItems.length === 0 ? (
                <p className="py-8 text-center text-sm italic text-stone-400">Nenhum treino agendado para este dia.</p>
              ) : (
                selectedItems.map(w => <WorkoutCard key={w.id} workout={w} trainings={trainings} />)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
