import { useState } from "react";
import { Dumbbell, PlayCircle } from "lucide-react";
import type { Training } from "../../types/domain";

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  // Already an embed URL
  if (/youtube\.com\/embed\/([\w-]{11})/.test(url)) return url.split("?")[0];
  // All other YouTube URL patterns (watch, shorts, youtu.be, mobile)
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|watch\?v=|watch\?.+[&?]v=|shorts\/))([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}

export function ActiveTrainingDetails({ training }: { training?: Training }) {
  const [expandedVideoIdx, setExpandedVideoIdx] = useState<number | null>(null);

  if (!training) return <p className="text-sm italic text-stone-500">Treino não encontrado na biblioteca.</p>;

  return (
    <div className="text-sm animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
          <Dumbbell size={14} /> {training.title}
        </h4>
        <a
          href="/app/treinos"
          className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
        >
          Editar treino
        </a>
      </div>
      <div className="grid gap-2">
        {training.exercises.map((ex, i) => {
          const embedUrl = getEmbedUrl(ex.videoUrl || "");
          const isExpanded = expandedVideoIdx === i;
          return (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex items-start gap-2 justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-stone-800 text-sm">{i + 1}. {ex.name}</p>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-stone-600 mt-1">
                    {ex.sets && <span>{ex.sets}</span>}
                    {ex.rest && <span className="text-stone-400">Pausa: {ex.rest}</span>}
                  </div>
                  {ex.notes && <p className="mt-1 text-xs italic text-stone-500">"{ex.notes}"</p>}
                </div>
                {ex.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setExpandedVideoIdx(isExpanded ? null : i)}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                  >
                    <PlayCircle size={13} />
                    {isExpanded ? "Ocultar" : "Ver vídeo"}
                  </button>
                )}
              </div>
              {isExpanded && ex.videoUrl && (
                <div className="mt-3">
                  {embedUrl ? (
                    <div className="aspect-video w-full overflow-hidden rounded-lg">
                      <iframe
                        src={embedUrl}
                        title={`Vídeo: ${ex.name}`}
                        className="h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={ex.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
                    >
                      <PlayCircle size={14} /> Abrir vídeo
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
