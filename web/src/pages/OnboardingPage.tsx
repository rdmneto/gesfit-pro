import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Dumbbell, Users, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { Button } from "../components/ui/Button";

type Step = "role-select" | "details-student" | "details-trainer";

export function OnboardingPage() {
  const user = useSessionStore((state) => state.user);
  const [step, setStep] = useState<Step>("role-select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Student form state
  const [studentPhone, setStudentPhone] = useState("");
  const [studentBirthDate, setStudentBirthDate] = useState("");
  const [studentHeight, setStudentHeight] = useState("");
  const [studentWeight, setStudentWeight] = useState("");
  const [studentGoal, setStudentGoal] = useState("");

  // Trainer form state
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [trainerBio, setTrainerBio] = useState("");

  if (!user) return null;

  async function handleOnboardingStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !user) return;
    setError("");
    setLoading(true);

    try {
      // 1. Criar perfil de usuário geral
      await setDoc(doc(db, "users", user.uid), {
        role: "student",
        teamId: null,
        email: user.email,
        name: user.displayName || "Aluno",
        createdAt: new Date().toISOString(),
      });

      // 2. Criar cadastro de aluno com dados físicos estruturados
      await setDoc(doc(db, "students", user.uid), {
        uid: user.uid,
        displayName: user.displayName || "Aluno",
        status: "pending",
        assignedTo: "", // Inicia sem treinador vinculado
        onboarding: {
          birthDate: studentBirthDate,
          email: user.email,
          celular: studentPhone,
        },
        physiological: {
          alturaCm: Number(studentHeight) || null,
          pesoInicialKg: Number(studentWeight) || null,
        },
        goal: studentGoal || "",
        createdAt: new Date().toISOString(),
      });

      // 3. Atualizar store global para destravar dashboard
      useSessionStore.setState({
        claims: {
          role: "student",
          teamId: undefined,
        },
      });
    } catch (err: unknown) {
      console.error(err);
      setError((err as { message?: string })?.message || "Erro ao salvar perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboardingTrainer(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !user) return;
    setError("");
    setLoading(true);

    const slug = teamSlug.toLowerCase().replace(/[^a-z0-9-_]/g, "");

    try {
      // 1. Criar perfil de usuário geral
      await setDoc(doc(db, "users", user.uid), {
        role: "trainer",
        teamId: user.uid,
        email: user.email,
        name: user.displayName || "Treinador",
        createdAt: new Date().toISOString(),
      });

      // 2. Criar time / ambiente do treinador
      await setDoc(doc(db, "teams", user.uid), {
        id: user.uid,
        ownerUid: user.uid,
        name: teamName,
        slug: slug,
        branding: {
          primaryColor: "#0f766e",
          secondaryColor: "#f59e0b",
          welcomeMessage: "Foco nos resultados e disciplina diária.",
          bio: trainerBio || "Personal Trainer dedicado a transformar vidas através do movimento.",
        },
        settings: {
          cancelWindowHours: 2,
          reminderHoursBefore: 3,
          reminderAuto: true,
          reminderTemplate: "Olá {{nome}}, temos treino agendado às {{hora}}! Não falte.",
        },
        trainingModalities: ["Musculação", "Funcional"],
        publicListing: true,
        publicProfile: {
          showAgenda: true,
          showPrices: true,
          showPhotos: true,
        },
        worksAt: [],
        acceptsHomeVisit: false,
        acceptsCondoGym: false,
        createdAt: new Date().toISOString(),
      });

      // 3. Atualizar store global para destravar dashboard
      useSessionStore.setState({
        claims: {
          role: "trainer",
          teamId: user.uid,
        },
      });
    } catch (err: unknown) {
      console.error(err);
      setError((err as { message?: string })?.message || "Erro ao criar perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-4 py-12 animate-fade-in">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Configuração Inicial</p>
        <h1 className="mt-3 text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
          Bem-vindo ao Gesfit Pro
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Olá, <span className="font-bold text-stone-800">{user.displayName || user.email}</span>. Para começar,
          selecione seu perfil no aplicativo.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-8">
        {step === "role-select" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setStep("details-student")}
              className="focus-ring group flex flex-col items-center rounded-2xl border border-stone-200 bg-white p-6 text-center transition-all hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-50/40"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <Dumbbell size={28} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-stone-900">Sou Aluno</h3>
              <p className="mt-2 text-xs leading-5 text-stone-400">
                Acompanhe seus treinos, registre suas medidas corporais, compre créditos e marque aulas com seu personal.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                Avançar <ArrowRight size={14} />
              </div>
            </button>

            <button
              onClick={() => setStep("details-trainer")}
              className="focus-ring group flex flex-col items-center rounded-2xl border border-stone-200 bg-white p-6 text-center transition-all hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-50/40"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <Users size={28} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-stone-900">Sou Treinador / Equipe</h3>
              <p className="mt-2 text-xs leading-5 text-stone-400">
                Crie seu ambiente digital personalizado, monte sua vitrine, controle pacotes, agende aulas e gerencie a evolução de seus alunos.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                Avançar <ArrowRight size={14} />
              </div>
            </button>
          </div>
        )}

        {step === "details-student" && (
          <form onSubmit={handleOnboardingStudent} className="card p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setStep("role-select")}
                className="rounded-lg p-1.5 hover:bg-stone-100 text-stone-500 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-lg font-black text-stone-950">Dados Físicos (Anamnese)</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Celular / WhatsApp *</span>
                <input
                  required
                  placeholder="+55 85 99999-9999"
                  className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Data de Nascimento *</span>
                <input
                  required
                  type="date"
                  className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3 text-stone-900"
                  value={studentBirthDate}
                  onChange={(e) => setStudentBirthDate(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Altura (cm) *</span>
                <input
                  required
                  type="number"
                  placeholder="175"
                  className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
                  value={studentHeight}
                  onChange={(e) => setStudentHeight(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Peso Atual (kg) *</span>
                <input
                  required
                  type="number"
                  step="0.1"
                  placeholder="78.5"
                  className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
                  value={studentWeight}
                  onChange={(e) => setStudentWeight(e.target.value)}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-stone-700">Meta Principal de Treino</span>
                <input
                  placeholder="Ex: Emagrecimento, hipertrofia, saúde postural..."
                  className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
                  value={studentGoal}
                  onChange={(e) => setStudentGoal(e.target.value)}
                />
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="mt-6 w-full"
              icon={<CheckCircle2 size={18} />}
            >
              Concluir Meu Cadastro
            </Button>
          </form>
        )}

        {step === "details-trainer" && (
          <form onSubmit={handleOnboardingTrainer} className="card p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setStep("role-select")}
                className="rounded-lg p-1.5 hover:bg-stone-100 text-stone-500 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-lg font-black text-stone-950">Seu Espaço de Trabalho</h2>
            </div>

            <div className="grid gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Nome Comercial / Nome do Time *</span>
                <input
                  required
                  placeholder="Ex: Ana Beatriz Personal, Studio Fit..."
                  className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""));
                  }}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Link da sua vitrine pública (Slug) *</span>
                <div className="relative mt-2 flex rounded-md border border-stone-300 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent">
                  <span className="flex select-none items-center pl-3 text-xs text-stone-400 font-semibold bg-stone-50 border-r border-stone-250 pr-2 rounded-l-md">
                    gesfit.rpngestao.com.br/t/
                  </span>
                  <input
                    required
                    placeholder="meu-time"
                    className="h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none rounded-r-md"
                    value={teamSlug}
                    onChange={(e) => setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                  />
                </div>
                <p className="mt-1.5 text-xs text-stone-400">
                  Os alunos usarão esse link para visualizar seu perfil, planos e horários disponíveis.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Bio curta para alunos</span>
                <textarea
                  placeholder="Conte um pouco sobre sua formação, metodologia ou foco de treinos..."
                  className="focus-ring mt-2 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                  value={trainerBio}
                  onChange={(e) => setTrainerBio(e.target.value)}
                />
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="mt-6 w-full"
              icon={<CheckCircle2 size={18} />}
            >
              Criar Meu Espaço
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
