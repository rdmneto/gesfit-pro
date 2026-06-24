import { cardClasses } from "../components/ui/Primitives";
import { cn } from "../lib/utils";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, doc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Users, ArrowRight, CheckCircle2, ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useActiveTrainer } from "../lib/activeTrainer";
import { requestEnrollment } from "../lib/enrollments";
import { CITY_NAMES, DEFAULT_CITY } from "../data/cities";
import { Button } from "../components/ui/Button";
import { Input, Textarea, SelectField } from "../components/ui/FormFields";
import { studentOnboardingSchema, trainerOnboardingSchema, type StudentOnboardingData, type TrainerOnboardingData } from "../lib/schemas";

type Step = "role-select" | "contract" | "details-student" | "details-trainer";

export function OnboardingPage() {
  const user = useSessionStore((state) => state.user);
  const setActiveTrainer = useActiveTrainer((state) => state.setActiveTrainer);
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("role-select");
  const [pendingRole, setPendingRole] = useState<"student" | "trainer" | null>(null);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const studentForm = useForm<StudentOnboardingData>({
    resolver: zodResolver(studentOnboardingSchema),
    defaultValues: {
      cidade: DEFAULT_CITY,
      celular: "",
      birthDate: "",
      alturaCm: undefined,
      pesoKg: undefined,
      objetivos: "",
      doencas: "",
      restricoes: "",
      orientacoes: "",
    },
  });

  const trainerForm = useForm<TrainerOnboardingData>({
    resolver: zodResolver(trainerOnboardingSchema),
    defaultValues: {
      teamName: "",
      teamSlug: "",
      bio: "",
    },
  });

  if (!user) return null;

  function handleRoleSelect(role: "student" | "trainer") {
    setPendingRole(role);
    setContractAccepted(false);
    setStep("contract");
  }

  function handleContractAccept() {
    if (!contractAccepted) return;
    if (pendingRole === "student") setStep("details-student");
    else setStep("details-trainer");
  }

  async function handleOnboardingStudent(data: StudentOnboardingData) {
    if (!db || !user) return;
    setError("");
    setLoading(true);

    try {
      // 0. Se o aluno veio da vitrine de um treinador, resolve o treinador
      //    para criar o vínculo logo após o cadastro.
      const pendingSlug = window.sessionStorage.getItem("gesfit-pending-trainer");
      let trainerId = "";
      let trainerName = "";
      if (pendingSlug) {
        try {
          const snap = await getDocs(
            query(
              collection(db, "teams"),
              where("slug", "==", pendingSlug),
              where("publicListing", "==", true),
              limit(1),
            ),
          );
          if (!snap.empty) {
            trainerId = snap.docs[0].id;
            trainerName = snap.docs[0].data().name || "";
          }
        } catch (resolveErr) {
          console.error("Falha ao resolver treinador da vitrine:", resolveErr);
        }
      }

      const displayName = user.displayName || "Aluno";

      // 1. Criar perfil de usuário geral
      await setDoc(doc(db, "users", user.uid), {
        role: "student",
        teamId: null, // aluno pode ter vários treinadores — vínculos em /enrollments
        email: user.email,
        name: displayName,
        contractAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      // 2. Criar cadastro de aluno (dados pessoais/físicos, globais ao aluno)
      await setDoc(doc(db, "students", user.uid), {
        uid: user.uid,
        displayName,
        status: "pending",
        assignedTo: "", // descontinuado — o vínculo agora vive em /enrollments
        onboarding: {
          birthDate: data.birthDate,
          email: user.email,
          celular: data.celular,
          city: data.cidade,
        },
        physiological: {
          alturaCm: data.alturaCm,
          pesoInicialKg: data.pesoKg,
        },
        medicalData: {
          doencas: data.doencas || "",
          restricoes: data.restricoes || "",
          orientacoes: data.orientacoes || "",
        },
        goal: data.objetivos || "",
        createdAt: new Date().toISOString(),
      });

      // 3. Criar o vínculo (pending) com o treinador escolhido na vitrine
      if (trainerId) {
        try {
          await requestEnrollment(db, {
            studentId: user.uid,
            studentName: displayName,
            trainerId,
            teamName: trainerName,
          });
          setActiveTrainer(trainerId);
        } catch (enrollErr) {
          console.error("Falha ao criar vínculo com o treinador:", enrollErr);
        }
      }

      window.sessionStorage.removeItem("gesfit-pending-trainer");

      // 4. Atualizar store global para destravar dashboard
      useSessionStore.setState({
        claims: {
          role: "student",
          teamId: undefined,
        },
      });

      // Sempre redireciona para vitrine de treinadores após cadastro
      navigate("/treinadores");
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setError((err as { message?: string })?.message || "Erro ao salvar perfil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboardingTrainer(data: TrainerOnboardingData) {
    if (!db || !user) return;
    setError("");
    setLoading(true);

    const slug = data.teamSlug;

    try {
      // 1. Criar perfil de usuário geral
      await setDoc(doc(db, "users", user.uid), {
        role: "trainer",
        teamId: user.uid,
        email: user.email,
        name: user.displayName || "Treinador",
        contractAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      // 2. Criar time / ambiente do treinador
      await setDoc(doc(db, "teams", user.uid), {
        id: user.uid,
        ownerUid: user.uid,
        name: data.teamName,
        slug: slug,
        branding: {
          primaryColor: "#0f766e",
          secondaryColor: "#f59e0b",
          welcomeMessage: "Foco nos resultados e disciplina diária.",
          bio: data.bio || "Personal Trainer dedicado a transformar vidas através do movimento.",
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
    } catch (error: unknown) { const err = error as Error;
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
        {/* STEP 1: Role select */}
        {step === "role-select" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => handleRoleSelect("student")}
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
              onClick={() => handleRoleSelect("trainer")}
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

        {/* STEP 2: Contract */}
        {step === "contract" && (
          <div className={cn(cardClasses, "p-6 animate-slide-up")}>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setStep("role-select")}
                className="rounded-lg p-1.5 hover:bg-stone-100 text-stone-500 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-emerald-700" />
                <h2 className="text-lg font-black text-stone-950">Contrato de Prestação de Serviços</h2>
              </div>
            </div>

            <div
              className="h-72 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm leading-7 text-stone-600"
              tabIndex={0}
              aria-label="Contrato de prestação de serviços — role para ler"
            >
              <h3 className="text-base font-black text-stone-900 mb-3">CONTRATO DE PRESTAÇÃO DE SERVIÇOS E POLÍTICA DE TRATAMENTO DE DADOS</h3>

              <p className="font-semibold text-stone-800">1. DAS PARTES</p>
              <p className="mt-1 mb-3">
                O presente Contrato é celebrado entre a <strong>Gesfit Pro</strong> (doravante denominada "Plataforma") e o usuário que realiza o cadastro (doravante denominado "Usuário").
              </p>

              <p className="font-semibold text-stone-800">2. DO OBJETO</p>
              <p className="mt-1 mb-3">
                A Plataforma disponibiliza ao Usuário acesso a um sistema de gestão de treinos, agendamentos, controle de medidas corporais e comunicação entre alunos e profissionais de educação física. A prestação dos serviços está condicionada à aceitação integral dos termos deste contrato.
              </p>

              <p className="font-semibold text-stone-800">3. DAS OBRIGAÇÕES DO USUÁRIO</p>
              <ul className="mt-1 mb-3 list-disc pl-5 space-y-1">
                <li>Fornecer informações verdadeiras, precisas e atualizadas no momento do cadastro;</li>
                <li>Manter a confidencialidade de suas credenciais de acesso;</li>
                <li>Utilizar a Plataforma exclusivamente para fins lícitos e de acordo com as normas vigentes;</li>
                <li>Não compartilhar, reproduzir ou comercializar conteúdos da Plataforma sem autorização prévia;</li>
                <li>Respeitar os profissionais cadastrados e demais usuários da plataforma.</li>
              </ul>

              <p className="font-semibold text-stone-800">4. DA PROTEÇÃO E TRATAMENTO DE DADOS (LGPD)</p>
              <p className="mt-1 mb-2">
                Em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD), a Plataforma declara:
              </p>
              <ul className="mb-3 list-disc pl-5 space-y-1">
                <li><strong>Dados coletados:</strong> nome completo, e-mail, telefone, data de nascimento, medidas corporais e objetivos de treino;</li>
                <li><strong>Finalidade:</strong> prestação dos serviços contratados, personalização do atendimento e comunicação relacionada à plataforma;</li>
                <li><strong>Base legal:</strong> execução de contrato e legítimo interesse;</li>
                <li><strong>Compartilhamento:</strong> os dados poderão ser compartilhados exclusivamente com o profissional (treinador) vinculado ao Usuário dentro da Plataforma;</li>
                <li><strong>Segurança:</strong> a Plataforma adota medidas técnicas e administrativas para proteger os dados contra acesso não autorizado, perda ou destruição;</li>
                <li><strong>Direitos do titular:</strong> o Usuário poderá, a qualquer tempo, solicitar acesso, correção, portabilidade ou exclusão de seus dados mediante contato com o suporte;</li>
                <li><strong>Retenção:</strong> os dados serão mantidos pelo período necessário à prestação dos serviços ou conforme exigência legal.</li>
              </ul>

              <p className="font-semibold text-stone-800">5. DA RESPONSABILIDADE</p>
              <p className="mt-1 mb-3">
                A Plataforma não se responsabiliza por resultados de treino, prescrições de exercícios ou orientações fornecidas pelos profissionais. O relacionamento entre aluno e treinador é de responsabilidade exclusiva das partes envolvidas. A Plataforma atua como ferramenta de gestão e comunicação.
              </p>

              <p className="font-semibold text-stone-800">6. DAS DISPOSIÇÕES GERAIS</p>
              <p className="mt-1 mb-3">
                Este contrato entra em vigor na data do aceite pelo Usuário e pode ser alterado mediante notificação prévia de 15 (quinze) dias. A continuidade do uso após notificação implica na aceitação das novas condições. Para dirimir eventuais controvérsias, fica eleito o foro da comarca de domicílio do Usuário.
              </p>

              <p className="mt-4 text-xs text-stone-400">Última atualização: Junho de 2025 · Gesfit Pro — Todos os direitos reservados.</p>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-emerald-400 hover:bg-emerald-50/30">
              <input
                type="checkbox"
                id="contract-accept"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 accent-emerald-600 cursor-pointer"
                checked={contractAccepted}
                onChange={(e) => setContractAccepted(e.target.checked)}
              />
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  Li e aceito o Contrato de Prestação de Serviços e a Política de Tratamento de Dados
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Ao marcar esta caixa, confirmo que li o documento acima na íntegra e concordo com todos os seus termos.
                </p>
              </div>
            </label>

            {!contractAccepted && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                <ShieldCheck size={14} className="shrink-0" />
                Role o contrato até o final e marque a caixa acima para continuar.
              </p>
            )}

            <Button
              type="button"
              variant="primary"
              disabled={!contractAccepted}
              className="mt-5 w-full"
              icon={<ArrowRight size={18} />}
              onClick={handleContractAccept}
            >
              Aceito — Continuar cadastro
            </Button>
          </div>
        )}

        {/* STEP 3: Student details */}
        {step === "details-student" && (
          <form onSubmit={studentForm.handleSubmit(handleOnboardingStudent)} className={cn(cardClasses, "p-6 animate-slide-up")}>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setStep("contract")}
                className="rounded-lg p-1.5 hover:bg-stone-100 text-stone-500 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-lg font-black text-stone-950">Dados Físicos (Anamnese)</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Celular / WhatsApp"
                placeholder="+55 85 99999-9999"
                {...studentForm.register("celular")}
                error={studentForm.formState.errors.celular?.message}
                required
              />

              <SelectField
                label="Cidade"
                {...studentForm.register("cidade")}
                error={studentForm.formState.errors.cidade?.message}
                required
              >
                {CITY_NAMES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectField>

              <Input
                label="Data de Nascimento"
                type="date"
                {...studentForm.register("birthDate")}
                error={studentForm.formState.errors.birthDate?.message}
                required
              />

              <Input
                label="Altura (cm)"
                type="number"
                placeholder="175"
                {...studentForm.register("alturaCm")}
                error={studentForm.formState.errors.alturaCm?.message}
                required
              />

              <Input
                label="Peso Atual (kg)"
                type="number"
                step="0.1"
                placeholder="78.5"
                {...studentForm.register("pesoKg")}
                error={studentForm.formState.errors.pesoKg?.message}
                required
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Textarea
                label="Doenças ou Condições pré-existentes"
                placeholder="Ex: Hipertensão, Diabetes, Asma..."
                wrapperClassName="sm:col-span-2"
                {...studentForm.register("doencas")}
                error={studentForm.formState.errors.doencas?.message}
              />

              <Textarea
                label="Restrições de movimento / Lesões"
                placeholder="Ex: Dor no joelho, cirurgia no ombro..."
                wrapperClassName="sm:col-span-2"
                {...studentForm.register("restricoes")}
                error={studentForm.formState.errors.restricoes?.message}
              />

              <Textarea
                label="Orientações/Expectativas para o Treinador"
                placeholder="O que você espera dos treinos e do acompanhamento?"
                wrapperClassName="sm:col-span-2"
                {...studentForm.register("orientacoes")}
                error={studentForm.formState.errors.orientacoes?.message}
              />

              <Input
                label="Meta Principal de Treino"
                placeholder="Ex: Emagrecimento, hipertrofia, saúde postural..."
                wrapperClassName="sm:col-span-2"
                {...studentForm.register("objetivos")}
                error={studentForm.formState.errors.objetivos?.message}
                required
              />
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

        {/* STEP 3: Trainer details */}
        {step === "details-trainer" && (
          <form onSubmit={trainerForm.handleSubmit(handleOnboardingTrainer)} className={cn(cardClasses, "p-6 animate-slide-up")}>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setStep("contract")}
                className="rounded-lg p-1.5 hover:bg-stone-100 text-stone-500 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-lg font-black text-stone-950">Seu Espaço de Trabalho</h2>
            </div>

            <div className="grid gap-4">
              <Input
                label="Nome Comercial / Nome do Time"
                placeholder="Ex: Ana Beatriz Personal, Studio Fit..."
                {...trainerForm.register("teamName")}
                error={trainerForm.formState.errors.teamName?.message}
                required
                onChange={(e) => {
                  trainerForm.setValue("teamName", e.target.value);
                  trainerForm.setValue("teamSlug", e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""));
                }}
              />

              <Input
                label="Link da sua vitrine pública (Slug)"
                placeholder="meu-time"
                {...trainerForm.register("teamSlug")}
                error={trainerForm.formState.errors.teamSlug?.message}
                hint="Os alunos usarão esse link para visualizar seu perfil, planos e horários disponíveis."
                required
                onChange={(e) => trainerForm.setValue("teamSlug", e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
              />

              <Textarea
                label="Bio curta para alunos"
                placeholder="Conte um pouco sobre sua formação, metodologia ou foco de treinos..."
                {...trainerForm.register("bio")}
                error={trainerForm.formState.errors.bio?.message}
              />
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
