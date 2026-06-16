import { CheckCircle2, MapPin, Play, UserRound, FileX } from "lucide-react";
import type { WorkoutSession } from "../../types/domain";
import { formatDateTime } from "./dashboardUtils";

interface TrainerWorkoutCardProps {
  workout: WorkoutSession;
  activeWorkoutId?: string;
  onFinish: () => void;
  onStart: (workout: WorkoutSession) => void;
  compact?: boolean;
}

export function TrainerWorkoutCard({
  workout,
  activeWorkoutId,
  onFinish,
  onStart,
  compact = true,
}: TrainerWorkoutCardProps) {
  const isActive = activeWorkoutId === workout.id;

  return (
    <article
      className={[
        "rounded-xl border p-4 transition-all",
        compact ? "border-[var(--color-border)] bg-white" : "mt-4 border-emerald-200 bg-emerald-50",
        isActive ? "ring-2 ring-emerald-500" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-emerald-700">{formatDateTime(workout.startsAt)}</p>
          <h3 className="mt-1 text-lg font-black text-stone-950">{workout.studentName}</h3>
        </div>
        <span className="badge badge-stone shrink-0">{workout.modality}</span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-stone-600">
        <p className="flex gap-2">
          <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-stone-400" size={15} />
          {workout.address}
        </p>
        <p className="flex gap-2">
          <UserRound aria-hidden="true" className="mt-0.5 shrink-0 text-stone-400" size={15} />
          {workout.proposedWorkout ?? workout.title}
        </p>
      </div>

      {workout.status === "completed" ? (
        <div className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-stone-100 text-sm font-bold text-stone-500">
          <CheckCircle2 aria-hidden="true" size={16} />
          Concluído
        </div>
      ) : workout.status === "no_show" ? (
        <div className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 text-sm font-bold text-rose-500">
          <FileX aria-hidden="true" size={16} />
          Falta
        </div>
      ) : (
        <button
          type="button"
          className={[
            "focus-ring mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold text-white transition-all",
            isActive
              ? "bg-stone-950 hover:bg-stone-800"
              : "bg-emerald-700 hover:bg-emerald-600 shadow-[var(--shadow-brand)]",
          ].join(" ")}
          onClick={() => (isActive ? onFinish() : onStart(workout))}
        >
          {isActive ? (
            <CheckCircle2 aria-hidden="true" size={16} />
          ) : (
            <Play aria-hidden="true" size={16} />
          )}
          {isActive ? "Finalizar treino" : "Iniciar treino"}
        </button>
      )}
    </article>
  );
}
