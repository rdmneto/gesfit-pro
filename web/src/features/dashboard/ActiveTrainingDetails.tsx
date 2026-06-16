import { Dumbbell } from "lucide-react";
import type { Training } from "../../types/domain";

export function ActiveTrainingDetails({ training }: { training?: Training }) {
  if (!training) return <p className="text-sm italic text-stone-500">Treino não encontrado na biblioteca.</p>;

  return (
    <div className="text-sm animate-fade-in mt-4 border-t border-stone-200 pt-4">
      <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-1">
        <Dumbbell size={14} /> Treino em Andamento: {training.title}
      </h4>
      <div className="grid gap-2">
        {training.exercises.map((ex, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-lg p-2 border border-emerald-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-700 min-w-[20px]">{i + 1}.</span>
              <span className="font-bold text-stone-800">{ex.name}</span>
            </div>
            <div className="flex gap-4 text-xs font-semibold text-stone-600 mt-1 sm:mt-0 ml-7 sm:ml-0">
              {ex.sets && <span>{ex.sets}</span>}
              {ex.rest && <span className="text-stone-400">Pausa: {ex.rest}</span>}
              {ex.videoUrl && (
                <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 underline decoration-blue-200">
                  Ver vídeo
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
