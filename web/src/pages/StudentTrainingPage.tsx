import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSessionStore } from '../store/session';
import { useCollection } from '../lib/hooks';
import { useActiveTrainer } from '../lib/activeTrainer';
import { where, orderBy } from 'firebase/firestore';
import type { Training, TrainingLog } from '../types/domain';
import { Dumbbell, ChevronDown, ChevronUp, Play, CheckCircle2, Clock } from 'lucide-react';
import { formatDateTime } from '../features/dashboard/dashboardUtils';

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

export function StudentTrainingPage() {
  const user = useSessionStore((state) => state.user);
  const activeTrainerId = useActiveTrainer((s) => s.activeTrainerId);

  const { data: trainings } = useCollection<Training>(
    'trainings',
    user && activeTrainerId
      ? [where('studentId', '==', user.uid), where('trainerId', '==', activeTrainerId), where('status', '==', 'active')]
      : [],
    [],
    [user?.uid, activeTrainerId]
  );

  const { data: trainingLogs } = useCollection<TrainingLog>(
    'trainingLogs',
    user && activeTrainerId
      ? [where('studentId', '==', user.uid), where('trainerId', '==', activeTrainerId), orderBy('createdAt', 'desc')]
      : [],
    [],
    [user?.uid, activeTrainerId]
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedVideoIdx, setExpandedVideoIdx] = useState<string | null>(null); // format: `${trainingId}-${exerciseIdx}`
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleComplete = async (training: Training) => {
    if (!db || !user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'trainingLogs'), {
        trainingId: training.id,
        studentId: user.uid,
        trainerId: training.trainerId,
        enrollmentId: training.enrollmentId,
        trainingTitle: training.title,
        completedByStudent: true,
        confirmedByTrainer: false,
        completedAt: new Date().toISOString(),
        studentNotes: notes || '',
        createdAt: new Date().toISOString(),
      });
      setNotes("");
      setExpandedId(null);
      alert("Treino marcado como concluído! Aguardando confirmação do treinador.");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar conclusão.");
    } finally {
      setSaving(false);
    }
  };

  const toggleVideo = (trainingId: string, idx: number) => {
    const key = `${trainingId}-${idx}`;
    if (expandedVideoIdx === key) {
      setExpandedVideoIdx(null);
    } else {
      setExpandedVideoIdx(key);
    }
  };

  const logs = trainingLogs ?? [];

  return (
    <section className="mx-auto max-w-lg px-4 py-6 mb-24 animate-fade-in">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Plataforma de Alunos</p>
        <h1 className="mt-1 text-2xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>Meus Treinos</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Visualize seus treinos prescritos e registre as conclusões.
        </p>
      </header>

      {!activeTrainerId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 font-medium">
          Você não tem um treinador ativo selecionado.
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-black text-stone-900 mb-3 flex items-center gap-2">
              <Dumbbell size={20} className="text-emerald-600"/> Treinos Prescritos
            </h2>
            
            <div className="grid gap-3">
              {(trainings ?? []).length === 0 ? (
                <p className="text-sm text-stone-500 italic py-4">Nenhum treino prescrito no momento.</p>
              ) : (
                trainings?.map(training => {
                  const isExpanded = expandedId === training.id;
                  
                  return (
                    <article key={training.id} className="card overflow-hidden transition-all duration-300">
                      <button
                        type="button"
                        className="w-full text-left p-4 flex justify-between items-center bg-white hover:bg-stone-50"
                        onClick={() => setExpandedId(isExpanded ? null : training.id)}
                      >
                        <div>
                          <h3 className="text-lg font-black text-stone-900">{training.title}</h3>
                          <p className="text-sm font-medium text-stone-500">{training.exercises.length} exercícios</p>
                        </div>
                        <div className="text-stone-400">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-stone-100 pt-4 animate-slide-up">
                          {training.description && (
                            <p className="text-sm text-stone-600 mb-4 whitespace-pre-wrap italic">
                              {training.description}
                            </p>
                          )}

                          <div className="space-y-3">
                            {training.exercises.map((ex, idx) => {
                              const ytId = getYouTubeId(ex.videoUrl || '');
                              const videoKey = `${training.id}-${idx}`;
                              const isVideoExpanded = expandedVideoIdx === videoKey;

                              return (
                                <div key={idx} className="bg-stone-50 rounded-xl p-3 border border-stone-200">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-stone-900 text-sm">{ex.order + 1}. {ex.name}</h4>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                                    <div className="bg-white px-2 py-1.5 rounded-lg border border-stone-150">
                                      <span className="font-bold text-stone-500 block text-[10px] uppercase">Séries</span>
                                      <span className="font-medium text-stone-900">{ex.sets || '-'}</span>
                                    </div>
                                    <div className="bg-white px-2 py-1.5 rounded-lg border border-stone-150">
                                      <span className="font-bold text-stone-500 block text-[10px] uppercase">Pausa</span>
                                      <span className="font-medium text-stone-900">{ex.rest || '-'}</span>
                                    </div>
                                  </div>

                                  {ex.notes && (
                                    <p className="text-xs text-stone-600 mb-2 italic">"{ex.notes}"</p>
                                  )}

                                  {ytId && (
                                    <div className="mt-2">
                                      <button
                                        type="button"
                                        className="focus-ring flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700"
                                        onClick={() => toggleVideo(training.id, idx)}
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
                          </div>

                          <div className="mt-6 border-t border-stone-200 pt-4">
                            <label className="block mb-3">
                              <span className="text-xs font-bold text-stone-600">Anotações do Treino (Opcional)</span>
                              <textarea
                                className="mt-1 focus-ring w-full rounded-xl border border-stone-200 p-3 text-sm min-h-[80px]"
                                placeholder="Como foi o treino? Dificuldades? Pesos usados?"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                              />
                            </label>
                            <button
                              type="button"
                              className="focus-ring btn btn-primary w-full shadow-[var(--shadow-brand)] h-12"
                              disabled={saving}
                              onClick={() => handleComplete(training)}
                            >
                              <CheckCircle2 size={20} />
                              {saving ? "Registrando..." : "Concluir Treino"}
                            </button>
                            <p className="text-center text-[10px] text-stone-400 mt-2">
                              O crédito de aula será abatido apenas após a confirmação do treinador.
                            </p>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="pt-6">
            <h2 className="text-lg font-black text-stone-900 mb-3 flex items-center gap-2">
              <Clock size={20} className="text-stone-400"/> Histórico
            </h2>
            <div className="grid gap-3">
              {logs.length === 0 ? (
                <p className="text-sm text-stone-500 italic py-4">Nenhum treino concluído ainda.</p>
              ) : (
                logs.map(log => (
                  <article key={log.id} className="card p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-stone-900 text-sm">{log.trainingTitle}</h4>
                      {log.confirmedByTrainer ? (
                        <span className="badge badge-green text-[10px]">✅ Confirmado</span>
                      ) : (
                        <span className="badge badge-amber text-[10px]">⏳ Aguardando</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 font-medium">
                      Feito em {log.completedAt ? formatDateTime(log.completedAt) : 'N/A'}
                    </p>
                    {log.studentNotes && (
                      <p className="mt-2 text-xs italic text-stone-600 bg-stone-50 p-2 rounded-lg border border-stone-150">
                        "{log.studentNotes}"
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
