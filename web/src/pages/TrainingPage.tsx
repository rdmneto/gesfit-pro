import { buttonVariants } from "../components/ui/Button";
import { cardClasses, badgeVariants } from "../components/ui/Primitives";
import { cn } from "../lib/utils";
import { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSessionStore } from '../store/session';
import { useLiveCollection } from '../lib/hooks';
import { where, orderBy } from 'firebase/firestore';
import type { Training, Exercise } from '../types/domain';
import { Dumbbell, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Archive, X, Sparkles, Loader2, Eye, EyeOff, Play } from 'lucide-react';
import { generateWorkout, estimateCaloriesFromExercises, findVideosForExercises } from '../lib/ai';

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (/youtube\.com\/embed\/([\w-]{11})/.test(url)) return url.split("?")[0];
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|watch\?v=|watch\?.+[&?]v=|shorts\/))([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}

export function TrainingPage() {
  const user = useSessionStore((state) => state.user);
  
  // Hooks
  const { data: trainings } = useLiveCollection<Training>(
    'trainings',
    user ? [where('trainerId', '==', user.uid), orderBy('createdAt', 'desc')] : [],
    [],
    [user?.uid]
  );

  // States
  const [showForm, setShowForm] = useState(false);
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null);
  const [expandedTrainingId, setExpandedTrainingId] = useState<string | null>(null);
  const [expandedVideoKey, setExpandedVideoKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // AI states
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDuration, setAiDuration] = useState("60");
  const [aiCount, setAiCount] = useState("6");
  const [aiFocus, setAiFocus] = useState("Hipertrofia");
  const [aiStyle, setAiStyle] = useState("Musculação");
  const [aiError, setAiError] = useState("");
  const [aiCaloriesPerMinute, setAiCaloriesPerMinute] = useState<number | undefined>(undefined);
  const [estimatingCalories, setEstimatingCalories] = useState(false);
  const [findingVideos, setFindingVideos] = useState(false);
  const [aiActionError, setAiActionError] = useState("");

  const handleGenerateAI = async () => {
    setAiGenerating(true);
    setAiError("");
    try {
      const result = await generateWorkout({
        durationMinutes: aiDuration,
        exercisesCount: aiCount,
        focus: aiFocus,
        style: aiStyle
      });
      setExercises(result.exercises);
      setAiCaloriesPerMinute(result.caloriesPerMinute);
      setShowAIModal(false);
    } catch (error: unknown) { const err = error as Error;
      setAiError(err.message || "Erro desconhecido ao gerar treino.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleEstimateCalories = async () => {
    if (exercises.length === 0) return;
    setEstimatingCalories(true);
    setAiActionError("");
    try {
      const names = exercises.map((e) => e.name).filter(Boolean);
      const kcal = await estimateCaloriesFromExercises(names, title);
      setAiCaloriesPerMinute(kcal);
    } catch (error: unknown) { const err = error as Error;
      setAiActionError(err.message || "Erro ao estimar calorias.");
    } finally {
      setEstimatingCalories(false);
    }
  };

  const handleFindVideos = async () => {
    if (exercises.length === 0) return;
    setFindingVideos(true);
    setAiActionError("");
    try {
      const updated = await findVideosForExercises(exercises);
      setExercises(updated);
    } catch (error: unknown) { const err = error as Error;
      setAiActionError(err.message || "Erro ao buscar vídeos.");
    } finally {
      setFindingVideos(false);
    }
  };

  // Helpers
  const addExercise = () => {
    setExercises([...exercises, { order: exercises.length, name: '', sets: '', rest: '', notes: '', videoUrl: '' }]);
  };

  const updateExercise = (index: number, field: keyof Exercise, value: string) => {
    const newEx = [...exercises];
    newEx[index] = { ...newEx[index], [field]: value };
    setExercises(newEx);
  };

  const removeExercise = (index: number) => {
    const newEx = exercises.filter((_, i) => i !== index);
    newEx.forEach((ex, i) => ex.order = i);
    setExercises(newEx);
  };

  const moveExercise = (index: number, direction: 1 | -1) => {
    if (index + direction < 0 || index + direction >= exercises.length) return;
    const newEx = [...exercises];
    const temp = newEx[index];
    newEx[index] = newEx[index + direction];
    newEx[index + direction] = temp;
    newEx.forEach((ex, i) => ex.order = i);
    setExercises(newEx);
  };

  function closeForm() {
    setShowForm(false);
    setEditingTrainingId(null);
    setTitle("");
    setDescription("");
    setExercises([]);
    setAiCaloriesPerMinute(undefined);
    setAiActionError("");
  }

  function startEditing(training: Training) {
    setEditingTrainingId(training.id);
    setTitle(training.title);
    setDescription(training.description ?? "");
    setExercises(training.exercises.map((e, i) => ({ ...e, order: i })));
    setAiCaloriesPerMinute(training.caloriesPerMinute);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const handleSaveTraining = async () => {
    if (!db || !user || !title || exercises.length === 0) return;
    setSaving(true);
    try {
      if (editingTrainingId) {
        await updateDoc(doc(db, 'trainings', editingTrainingId), {
          title,
          description,
          exercises,
          ...(aiCaloriesPerMinute !== undefined ? { caloriesPerMinute: aiCaloriesPerMinute } : {}),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'trainings'), {
          trainerId: user.uid,
          title,
          description,
          exercises,
          ...(aiCaloriesPerMinute !== undefined ? { caloriesPerMinute: aiCaloriesPerMinute } : {}),
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      closeForm();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar o treino.");
    } finally {
      setSaving(false);
    }
  };

  const archiveTraining = async (id: string) => {
    if (!db) return;
    if (!window.confirm("Deseja arquivar este treino?")) return;
    try {
      await updateDoc(doc(db, 'trainings', id), { status: 'archived', updatedAt: new Date().toISOString() });
    } catch (error: unknown) { const e = error as Error;
      console.error(e);
    }
  };

  const deleteTraining = async (id: string) => {
    if (!db) return;
    if (!window.confirm("Deseja excluir permanentemente este treino?")) return;
    try {
      await deleteDoc(doc(db, 'trainings', id));
    } catch (error: unknown) { const e = error as Error;
      console.error(e);
    }
  };

  const activeTrainings = (trainings ?? []).filter(t => t.status === 'active');

  return (
    <section className="mx-auto max-w-6xl px-4 pt-4 pb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
          Biblioteca de Treinos
        </h1>
        {!showForm && (
          <button
            type="button"
            className={cn(buttonVariants({}), "focus-ring")}
            onClick={() => setShowForm(true)}
          >
            <Plus size={18} /> Novo Treino
          </button>
        )}
      </div>

      <div className="space-y-6">
            {/* spacer — keeps the form aligned with the list below */}

            {showForm && (
              <div className={cn(cardClasses, "p-5 animate-slide-up bg-stone-50 border-emerald-200 border-2")}>
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-black text-emerald-900">
                    {editingTrainingId ? "Editar Treino" : "Criar Novo Treino"}
                  </h2>
                  <button type="button" onClick={closeForm} className="text-stone-400 hover:text-stone-600"><X size={20}/></button>
                </div>
                
                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Título do Treino</span>
                    <input
                      className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
                      placeholder="ex: Treino A - Peito e Tríceps"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                </div>
                
                <label className="block mt-4">
                  <span className="text-2xs font-bold uppercase tracking-wider text-stone-500">Descrição / Orientação Geral</span>
                  <textarea
                    className="focus-ring mt-1.5 min-h-[80px] w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                    placeholder="Instruções gerais para este treino..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                <div className="mt-6 border-t border-stone-200 pt-4">
                  <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                    <h3 className="text-md font-bold text-stone-900 flex items-center gap-2"><Dumbbell size={16}/> Exercícios</h3>
                    <button
                      type="button"
                      className="focus-ring flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                      onClick={() => {
                        if (title) setAiFocus(title);
                        if (description) setAiStyle(description);
                        setShowAIModal(true);
                      }}
                    >
                      <Sparkles size={14} />
                      Gerar com IA
                    </button>
                  </div>
                  <div className="space-y-3">
                    {exercises.map((ex, idx) => (
                      <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-xl border border-stone-200 shadow-sm">
                        <div className="flex flex-col gap-1 pt-2 cursor-pointer text-stone-300">
                          <button type="button" onClick={() => moveExercise(idx, -1)} className="hover:text-emerald-600"><ChevronUp size={16}/></button>
                          <button type="button" onClick={() => moveExercise(idx, 1)} className="hover:text-emerald-600"><ChevronDown size={16}/></button>
                        </div>
                        <div className="flex-1 grid gap-3 sm:grid-cols-12">
                          <div className="sm:col-span-12 md:col-span-4 lg:col-span-5">
                            <input
                              className="focus-ring h-10 w-full rounded-lg border border-stone-200 px-3 text-sm font-semibold"
                              placeholder="Nome do exercício"
                              value={ex.name}
                              onChange={(e) => updateExercise(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div className="sm:col-span-6 md:col-span-2 lg:col-span-2">
                            <input
                              className="focus-ring h-10 w-full rounded-lg border border-stone-200 px-3 text-sm"
                              placeholder="Séries (ex: 4x12)"
                              value={ex.sets}
                              onChange={(e) => updateExercise(idx, 'sets', e.target.value)}
                            />
                          </div>
                          <div className="sm:col-span-6 md:col-span-2 lg:col-span-2">
                            <input
                              className="focus-ring h-10 w-full rounded-lg border border-stone-200 px-3 text-sm"
                              placeholder="Pausa (ex: 60s)"
                              value={ex.rest}
                              onChange={(e) => updateExercise(idx, 'rest', e.target.value)}
                            />
                          </div>
                          <div className="sm:col-span-12 md:col-span-4 lg:col-span-3">
                            <input
                              className="focus-ring h-10 w-full rounded-lg border border-stone-200 px-3 text-sm"
                              placeholder="Link do YouTube"
                              value={ex.videoUrl}
                              onChange={(e) => updateExercise(idx, 'videoUrl', e.target.value)}
                            />
                          </div>
                          <div className="sm:col-span-12">
                            <input
                              className="focus-ring h-8 w-full rounded-lg border-transparent bg-stone-50 px-3 text-xs italic text-stone-600"
                              placeholder="Observações (opcional)"
                              value={ex.notes}
                              onChange={(e) => updateExercise(idx, 'notes', e.target.value)}
                            />
                          </div>
                        </div>
                        <button type="button" className="text-rose-400 hover:text-rose-600 pt-2" onClick={() => removeExercise(idx)}>
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                      onClick={addExercise}
                    >
                      <Plus size={16} /> Adicionar Exercício
                    </button>
                  </div>

                  {exercises.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={estimatingCalories}
                        onClick={handleEstimateCalories}
                        className="focus-ring flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                      >
                        {estimatingCalories
                          ? <><Loader2 size={13} className="animate-spin" /> Estimando...</>
                          : <><Sparkles size={13} /> Estimar calorias</>}
                      </button>
                      <button
                        type="button"
                        disabled={findingVideos}
                        onClick={handleFindVideos}
                        className="focus-ring flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                      >
                        {findingVideos
                          ? <><Loader2 size={13} className="animate-spin" /> Buscando vídeos...</>
                          : <><Play size={13} /> Encontrar vídeos</>}
                      </button>
                      {aiCaloriesPerMinute !== undefined && (
                        <span className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
                          🔥 ~{aiCaloriesPerMinute} kcal/min estimado pela IA
                        </span>
                      )}
                      {aiActionError && (
                        <p className="w-full text-xs text-rose-600 font-medium">{aiActionError}</p>
                      )}
                    </div>
                  )}
                </div>

                {showAIModal && (
                  <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-600" />
                        Assistente de Treino IA
                      </h4>
                      <button type="button" onClick={() => setShowAIModal(false)} className="text-indigo-400 hover:text-indigo-600"><X size={16}/></button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold text-indigo-800">Tempo (min)</span>
                        <input
                          className="mt-1 h-9 w-full rounded-lg border border-indigo-200 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                          value={aiDuration}
                          onChange={e => setAiDuration(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-indigo-800">Qtd. Exercícios</span>
                        <input
                          className="mt-1 h-9 w-full rounded-lg border border-indigo-200 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                          value={aiCount}
                          onChange={e => setAiCount(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-indigo-800">Foco</span>
                        <input
                          className="mt-1 h-9 w-full rounded-lg border border-indigo-200 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="Ex: Emagrecimento, Hipertrofia..."
                          value={aiFocus}
                          onChange={e => setAiFocus(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-indigo-800">Estilo</span>
                        <input
                          className="mt-1 h-9 w-full rounded-lg border border-indigo-200 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="Ex: Musculação, Funcional..."
                          value={aiStyle}
                          onChange={e => setAiStyle(e.target.value)}
                        />
                      </label>
                    </div>

                    {aiError && (
                      <p className="mt-3 text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded border border-rose-200">
                        {aiError}
                      </p>
                    )}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleGenerateAI}
                        disabled={aiGenerating}
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {aiGenerating ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Gerando...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} /> Gerar Exercícios
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" className={buttonVariants({variant: "secondary"})} onClick={closeForm}>Cancelar</button>
                  <button type="button" className={buttonVariants({})} disabled={saving || !title || exercises.length === 0} onClick={handleSaveTraining}>
                    {saving ? "Salvando..." : "Salvar Treino"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeTrainings.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-stone-500 italic">Nenhum treino ativo no momento.</p>
              ) : (
                activeTrainings.map(training => {
                  const isExpanded = expandedTrainingId === training.id;
                  return (
                    <article key={training.id} className={cn(cardClasses, "overflow-hidden")}>
                      <div className="flex flex-col justify-between p-4">
                        <div>
                          <div className="flex justify-between items-start">
                            <span className={badgeVariants({ variant: "green" })}>Ativo</span>
                            <div className="flex gap-2">
                              <button type="button" className="text-stone-400 hover:text-emerald-600" title="Editar" onClick={() => startEditing(training)}><Pencil size={16}/></button>
                              <button type="button" className="text-stone-400 hover:text-amber-600" title="Arquivar" onClick={() => archiveTraining(training.id)}><Archive size={16}/></button>
                              <button type="button" className="text-stone-400 hover:text-rose-600" title="Excluir" onClick={() => deleteTraining(training.id)}><Trash2 size={16}/></button>
                            </div>
                          </div>
                          <h3 className="mt-2 text-lg font-black text-stone-900 line-clamp-1" title={training.title}>{training.title}</h3>
                          <p className="mt-1 flex items-center gap-1 text-xs text-stone-500"><Dumbbell size={12}/> {training.exercises.length} exercícios</p>
                        </div>
                        <button
                          type="button"
                          className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                          onClick={() => {
                            setExpandedTrainingId(isExpanded ? null : training.id);
                            setExpandedVideoKey(null);
                          }}
                        >
                          {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                          {isExpanded ? "Ocultar exercícios" : "Ver exercícios"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-stone-100 bg-stone-50 px-4 pb-4 pt-3 animate-slide-up">
                          {training.description && (
                            <p className="mb-3 text-xs italic text-stone-500 leading-relaxed">{training.description}</p>
                          )}
                          <div className="space-y-2">
                            {training.exercises.map((ex, idx) => {
                              const embedUrl = getEmbedUrl(ex.videoUrl || '');
                              const isSearchUrl = (ex.videoUrl || '').includes('youtube.com/results');
                              const videoKey = `${training.id}-${idx}`;
                              const isVideoOpen = expandedVideoKey === videoKey;
                              return (
                                <div key={idx} className="rounded-lg bg-white border border-stone-200 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-bold text-stone-900">{idx + 1}. {ex.name}</p>
                                      <p className="text-xs text-stone-500 mt-0.5">{ex.sets}{ex.rest ? ` · Pausa: ${ex.rest}` : ''}</p>
                                      {ex.notes && <p className="text-xs italic text-stone-400 mt-0.5">"{ex.notes}"</p>}
                                    </div>
                                    {embedUrl && (
                                      <button
                                        type="button"
                                        className="shrink-0 flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-700"
                                        onClick={() => setExpandedVideoKey(isVideoOpen ? null : videoKey)}
                                      >
                                        <Play size={13} />
                                        {isVideoOpen ? "Fechar" : "Vídeo"}
                                      </button>
                                    )}
                                    {!embedUrl && isSearchUrl && (
                                      <a
                                        href={ex.videoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="shrink-0 flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-rose-500"
                                      >
                                        <Play size={13} /> YouTube
                                      </a>
                                    )}
                                  </div>
                                  {embedUrl && isVideoOpen && (
                                    <div className="mt-2 overflow-hidden rounded-lg aspect-video bg-stone-900 animate-fade-in">
                                      <iframe
                                        className="w-full h-full"
                                        src={embedUrl}
                                        title={ex.name}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
      </div>
    </section>
  );
}
