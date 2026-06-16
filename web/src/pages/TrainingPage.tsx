import { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSessionStore } from '../store/session';
import { useTrainerStudents, useCollection } from '../lib/hooks';
import { where, orderBy } from 'firebase/firestore';
import type { Training, TrainingLog, Exercise } from '../types/domain';
import { Dumbbell, Plus, Trash2, ChevronDown, ChevronUp, Check, Clock, Archive, X } from 'lucide-react';
import { formatDateTime } from '../features/dashboard/dashboardUtils';

export function TrainingPage() {
  const user = useSessionStore((state) => state.user);
  
  // Hooks
  const { data: dbStudents } = useTrainerStudents(user?.uid);
  const students = (dbStudents ?? []).filter((s) => s.enrollment?.status === "active");

  const { data: trainings } = useCollection<Training>(
    'trainings',
    user ? [where('trainerId', '==', user.uid), orderBy('createdAt', 'desc')] : [],
    [],
    [user?.uid]
  );

  const { data: pendingLogs } = useCollection<TrainingLog>(
    'trainingLogs',
    user ? [where('trainerId', '==', user.uid), where('confirmedByTrainer', '==', false)] : [],
    [],
    [user?.uid]
  );

  // States
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);

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

  const handleSaveTraining = async () => {
    if (!db || !user || !title || exercises.length === 0) return;
    setSaving(true);

    try {
      await addDoc(collection(db, 'trainings'), {
        trainerId: user.uid,
        title,
        description,
        exercises,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setShowForm(false);
      setTitle("");
      setDescription("");
      setExercises([]);
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
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTraining = async (id: string) => {
    if (!db) return;
    if (!window.confirm("Deseja excluir permanentemente este treino?")) return;
    try {
      await deleteDoc(doc(db, 'trainings', id));
    } catch (e) {
      console.error(e);
    }
  };

  const confirmLog = async (log: TrainingLog) => {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'trainingLogs', log.id), {
        confirmedByTrainer: true,
        confirmedAt: new Date().toISOString(),
      });
      batch.update(doc(db, 'enrollments', log.enrollmentId), {
        classesUsed: increment(1),
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("Erro ao confirmar conclusão.");
    }
  };

  const activeTrainings = (trainings ?? []).filter(t => t.status === 'active');
  const logs = pendingLogs ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Acompanhamento de Alunos
          </p>
          <h1 className="text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
            Biblioteca de Treinos
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Cadastre modelos de treinos na sua biblioteca para atribuir aos alunos durante as aulas.
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-4 border-b border-stone-200">
        <button
          type="button"
          className={[
            "px-4 py-2 font-bold transition-all border-b-2",
            activeTab === "active" ? "border-emerald-600 text-emerald-800" : "border-transparent text-stone-500 hover:text-stone-700"
          ].join(" ")}
          onClick={() => setActiveTab("active")}
        >
          Meus Treinos
        </button>
        <button
          type="button"
          className={[
            "px-4 py-2 font-bold transition-all border-b-2",
            activeTab === "pending" ? "border-emerald-600 text-emerald-800" : "border-transparent text-stone-500 hover:text-stone-700"
          ].join(" ")}
          onClick={() => setActiveTab("pending")}
        >
          Pendentes de Confirmação
          {logs.length > 0 && (
            <span className="ml-2 inline-flex h-5 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">
              {logs.length}
            </span>
          )}
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "active" && (
          <div className="space-y-6">
            {!showForm && (
              <button
                type="button"
                className="focus-ring btn btn-primary w-full sm:w-auto"
                onClick={() => setShowForm(true)}
              >
                <Plus size={18} /> Novo Treino
              </button>
            )}

            {showForm && (
              <div className="card p-5 animate-slide-up bg-stone-50 border-emerald-200 border-2">
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-black text-emerald-900">Criar Novo Treino</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600"><X size={20}/></button>
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
                  <h3 className="text-md font-bold text-stone-900 mb-3 flex items-center gap-2"><Dumbbell size={16}/> Exercícios</h3>
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
                </div>
                
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="button" className="btn btn-primary" disabled={saving || !title || exercises.length === 0} onClick={handleSaveTraining}>
                    {saving ? "Salvando..." : "Salvar Treino"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeTrainings.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-stone-500 italic">Nenhum treino ativo no momento.</p>
              ) : (
                activeTrainings.map(training => (
                  <article key={training.id} className="card flex flex-col justify-between p-4">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="badge badge-green">Ativo</span>
                        <div className="flex gap-2">
                          <button type="button" className="text-stone-400 hover:text-amber-600" title="Arquivar" onClick={() => archiveTraining(training.id)}><Archive size={16}/></button>
                          <button type="button" className="text-stone-400 hover:text-rose-600" title="Excluir" onClick={() => deleteTraining(training.id)}><Trash2 size={16}/></button>
                        </div>
                      </div>
                      <h3 className="mt-2 text-lg font-black text-stone-900 line-clamp-1" title={training.title}>{training.title}</h3>
                      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500"><Dumbbell size={12}/> {training.exercises.length} exercícios</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "pending" && (
          <div className="grid gap-4">
            {logs.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-500 italic">Nenhuma confirmação pendente.</p>
            ) : (
              logs.map(log => (
                <article key={log.id} className="card flex flex-col sm:flex-row justify-between gap-4 p-5 border-l-4 border-l-amber-400">
                  <div>
                    <h3 className="text-lg font-black text-stone-900">{log.trainingTitle}</h3>
                    <p className="text-sm font-bold text-stone-700">Aluno: {students.find(s => s.uid === log.studentId)?.displayName || 'Desconhecido'}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                      <Clock size={12}/> Concluído em: {log.completedAt ? formatDateTime(log.completedAt) : 'N/A'}
                    </p>
                    {log.studentNotes && (
                      <div className="mt-2 rounded-lg bg-stone-50 p-2 text-sm italic text-stone-600 border border-stone-200">
                        "{log.studentNotes}"
                      </div>
                    )}
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="focus-ring btn btn-primary whitespace-nowrap bg-amber-600 hover:bg-amber-700 border-amber-600 shadow-[var(--shadow-brand)]"
                      onClick={() => confirmLog(log)}
                    >
                      <Check size={16}/> Confirmar & Debitar Aula
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
