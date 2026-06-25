import { buttonVariants } from "../components/ui/Button";
import { cardClasses } from "../components/ui/Primitives";
import { cn } from "../lib/utils";
import {
  Activity,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageCircle,
  MessageSquare,
  Pencil,
  Plus,
  Ruler,
  Search,
  TrendingDown,
  UserRound,
  Users,
  XCircle,
  CalendarDays,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { bmi, calculateAge, whatsappLink } from "../lib/format";
import {
  useActivePartnerTeams,
  useMeasurements,
  usePendingMeasurements,
  useStudent,
  useTeam,
  useTrainerStudents,
  usePendingPurchases,
} from "../lib/hooks";
import { useSessionStore } from "../store/session";
import { useActiveTrainer } from "../lib/activeTrainer";
import { approveEnrollment } from "../lib/enrollments";
import { PendingPurchasesList } from "../features/dashboard/PendingPurchasesList";
import type { Enrollment, Student, StudentMeasurement, StudentMeasurementSubmission } from "../types/domain";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Textarea } from "../components/ui/FormFields";
import { measurementSchema, type MeasurementFormData } from "../lib/schemas";
import { queryClient } from "../main";

type StudentWithEnrollment = Student & { enrollment: Enrollment };

export function MeasurementsPage() {
  const role = useSessionStore((state) => state.claims.role);
  const user = useSessionStore((state) => state.user);

  if (role === "trainer") {
    return <TrainerStudentsPage trainerId={user?.uid ?? null} />;
  }

  return <StudentMeasurementsPage studentId={user?.uid ?? null} studentName={user?.displayName ?? "Aluno"} />;
}



function TrainerMeasurementForm({
  selectedStudent,
}: {
  selectedStudent: StudentWithEnrollment | null;
}) {
  const user = useSessionStore((state) => state.user);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<MeasurementFormData>({
    resolver: zodResolver(measurementSchema) as any,
    defaultValues: {
      measuredAt: new Date().toISOString().slice(0, 10),
      weightKg: undefined,
      waistCm: undefined,
      hipCm: undefined,
      chestCm: undefined,
      bodyFatPercent: undefined,
      armRightCm: undefined,
      thighCm: undefined,
      calfCm: undefined,
      notes: "",
    },
  });

  async function handleSave(data: MeasurementFormData) {
    if (!selectedStudent || !db || !user) return;
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      await addDoc(collection(db, `students/${selectedStudent.uid}/measurementSubmissions`), {
        studentId: selectedStudent.uid,
        measuredAt: data.measuredAt,
        weightKg: data.weightKg,
        waistCm: data.waistCm,
        hipCm: data.hipCm,
        chestCm: data.chestCm,
        bodyFatPercent: data.bodyFatPercent ?? null,
        notes: data.notes ?? "",
        submittedBy: user.uid,
        submittedByName: user.displayName ?? "Treinador",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      form.reset({
        measuredAt: new Date().toISOString().slice(0, 10),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Erro ao salvar medida:", e);
      setError(e.message ?? "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={cn(cardClasses, "p-5")} onSubmit={form.handleSubmit(handleSave)}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
          <Plus aria-hidden="true" className="text-emerald-700" size={16} />
        </div>
        <h2 className="text-lg font-black text-stone-950">Inserir métricas</h2>
      </div>
      <p className="mt-1 text-xs text-stone-400">Métricas ficam pendentes até o aluno confirmar no próprio perfil.</p>

      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">Dados principais</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Input label="Data" type="date" {...form.register("measuredAt")} error={form.formState.errors.measuredAt?.message} required />
        <Input label="Peso (kg)" type="number" step="0.1" {...form.register("weightKg")} error={form.formState.errors.weightKg?.message} placeholder="68.7" required />
        <Input label="Cintura (cm)" type="number" step="0.1" {...form.register("waistCm")} error={form.formState.errors.waistCm?.message} placeholder="80" required />
        <Input label="Quadril (cm)" type="number" step="0.1" {...form.register("hipCm")} error={form.formState.errors.hipCm?.message} placeholder="100" required />
        <Input label="Tórax (cm)" type="number" step="0.1" {...form.register("chestCm")} error={form.formState.errors.chestCm?.message} placeholder="93" required />
        <Input label="Gordura corporal (%)" type="number" step="0.1" {...form.register("bodyFatPercent")} error={form.formState.errors.bodyFatPercent?.message} placeholder="27.9" />
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">Circunferências adicionais <span className="normal-case font-normal text-stone-300">(opcional)</span></p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Input label="Braço dir. (cm)" type="number" step="0.1" {...form.register("armRightCm")} error={form.formState.errors.armRightCm?.message} placeholder="31" />
        <Input label="Coxa (cm)" type="number" step="0.1" {...form.register("thighCm")} error={form.formState.errors.thighCm?.message} placeholder="55" />
        <Input label="Panturrilha (cm)" type="number" step="0.1" {...form.register("calfCm")} error={form.formState.errors.calfCm?.message} placeholder="37" />
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">Foto de progresso <span className="normal-case font-normal text-stone-300">(opcional)</span></p>
      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-stone-200 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-50">
        <Camera aria-hidden="true" className="text-stone-400" size={20} />
        <div>
          <p className="text-sm font-semibold text-stone-600">Anexar foto de avaliação</p>
          <p className="text-xs text-stone-400">JPG ou PNG, até 5 MB</p>
        </div>
        <input type="file" accept="image/jpeg,image/png" className="sr-only" />
      </label>

      <div className="mt-4">
        <Textarea label="Observações" {...form.register("notes")} error={form.formState.errors.notes?.message} placeholder="Observações da avaliação presencial." />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="text-emerald-700" size={18} />
          <p className="text-sm font-semibold text-emerald-800">Métricas enviadas para confirmação!</p>
        </div>
      )}

      <button type="submit" className={cn(buttonVariants({}), "focus-ring mt-5")} disabled={saving}>
        {saving ? "Enviando..." : <><Plus aria-hidden="true" size={18} /> Enviar para confirmação do aluno</>}
      </button>
    </form>
  );
}

function TrainerStudentsPage({ trainerId }: { trainerId: string | null }) {
  const teamId = useSessionStore((state) => state.claims.teamId);
  const { data: partnerTeams } = useActivePartnerTeams(trainerId);

  // Own students only — partner students are shown separately in PartnerTeamStudentsSection
  const { data: ownStudents, loading: studentsLoading } = useTrainerStudents(teamId ?? null);
  const [query, setQuery] = useState("");

  const studentsList = useMemo<StudentWithEnrollment[]>(() => ownStudents ?? [], [ownStudents]);

  const { data: pendingPurchases } = usePendingPurchases(teamId);
  const pendingPurchasesCount = pendingPurchases?.length ?? 0;

  // Solicitações de vínculo aguardando aprovação do treinador.
  const pendingRequests = useMemo(
    () => studentsList.filter((s) => s.enrollment?.status === "pending"),
    [studentsList],
  );

  const activeStudents = useMemo(
    () => studentsList.filter((s) => s.enrollment?.status !== "pending"),
    [studentsList],
  );

  const sortedStudents = useMemo(
    () => [...activeStudents].sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR")),
    [activeStudents],
  );

  async function handleApprove(enrollmentId: string) {
    if (!db) return;
    try {
      await approveEnrollment(db, enrollmentId);
    } catch (error: unknown) { const err = error as Error;
      console.error("Erro ao aprovar vínculo:", err);
    }
  }

  function openAppChat(enrollmentId: string, studentId: string, studentName: string) {
    window.dispatchEvent(new CustomEvent("openGlobalChat", {
      detail: { chatId: enrollmentId, type: "enrollment", otherUserId: studentId, otherUserName: studentName },
    }));
  }

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  // Holds a partner team's student when selected (not in own sortedStudents)
  const [selectedStudentOverride, setSelectedStudentOverride] = useState<StudentWithEnrollment | null>(null);

  const effectiveSelectedId = selectedStudentOverride?.uid ?? selectedStudentId ?? sortedStudents[0]?.uid ?? null;

  const filteredStudents = sortedStudents.filter((student) =>
    student.displayName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const selectedStudent = sortedStudents.find((s) => s.uid === effectiveSelectedId) ?? null;
  const effectiveStudentForPanel = selectedStudentOverride ?? selectedStudent;

  const { data: selectedMeasurements = [] } = useMeasurements(effectiveSelectedId);
  const { data: selectedPending = [] } = usePendingMeasurements(effectiveSelectedId);

  const measurements = useMemo(
    () => withInitialWeight(selectedMeasurements ?? [], selectedStudent),
    [selectedMeasurements, selectedStudent],
  );

  const pending = useMemo(() => selectedPending ?? [], [selectedPending]);



  return (
    <section className="mx-auto max-w-6xl px-4 pt-4 pb-6">

      {/* Solicitações de vínculo pendentes */}
      {pendingRequests.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-black text-amber-900">
            Solicitações de vínculo ({pendingRequests.length})
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Alunos que pediram para treinar com você. Aprove para liberar a compra de aulas.
          </p>
          <div className="mt-4 grid gap-3">
            {pendingRequests.map((student) => {
              const wa = whatsappLink(student.onboarding?.celular);
              return (
                <article
                  key={student.uid}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-4"
                >
                  <div>
                    <p className="font-black text-stone-950">{student.displayName}</p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {student.onboarding?.email ?? "Sem e-mail"}
                      {student.onboarding?.celular ? ` · ${student.onboarding.celular}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonVariants({variant: "secondary", size: "sm"}), "focus-ring")}
                      >
                        <MessageCircle size={15} /> WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      className={cn(buttonVariants({variant: "secondary", size: "sm"}), "focus-ring")}
                      onClick={() => openAppChat(student.enrollment.id, student.uid, student.displayName)}
                    >
                      <MessageSquare size={15} /> Chat no App
                    </button>
                    <button
                      type="button"
                      className={cn(buttonVariants({size: "sm"}), "focus-ring")}
                      onClick={() => handleApprove(student.enrollment.id)}
                    >
                      <CheckCircle2 size={15} /> Aprovar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Compras pendentes */}
      {pendingPurchasesCount > 0 && (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-emerald-950">
              Pagamentos aguardando confirmação ({pendingPurchasesCount})
            </h2>
          </div>
          <p className="mt-1 text-sm text-emerald-800 mb-4">
            Você tem pagamentos pendentes de conferência. Confirme-os para liberar os créditos.
          </p>
          <PendingPurchasesList teamId={teamId} />
        </section>
      )}

      {studentsLoading ? (
        <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" /></div>
      ) : sortedStudents.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-200 bg-stone-50 py-16 text-center">
          <Users className="mx-auto mb-4 text-stone-300" size={40} />
          <p className="font-semibold text-stone-500">Nenhum aluno ativo ainda</p>
          <p className="mt-1 text-sm text-stone-400">Os alunos que você aprovar aparecerão aqui.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users aria-hidden="true" className="text-emerald-800" size={22} />
                <h2 className="text-xl font-black">Meus Alunos</h2>
              </div>
              <label className="relative block flex-1 min-w-[140px]">
                <span className="sr-only">Buscar aluno</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  size={15}
                />
                <input
                  className="focus-ring h-9 w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-3 text-sm"
                  placeholder="Buscar aluno"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 space-y-2">
              {filteredStudents.map((student) => (
                <button
                  key={student.uid}
                  type="button"
                  className={[
                    "focus-ring grid w-full gap-2 rounded-md border p-3 text-left sm:grid-cols-[1fr_auto]",
                    effectiveSelectedId === student.uid && !selectedStudentOverride
                      ? "border-emerald-700 bg-emerald-50"
                      : "border-stone-200 bg-white hover:bg-stone-50",
                  ].join(" ")}
                  onClick={() => { setSelectedStudentId(student.uid); setSelectedStudentOverride(null); }}
                >
                  <div>
                    <p className="font-black">{student.displayName}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {student.onboarding?.email ?? "Sem e-mail"}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Alunos dos times em que este treinador é parceiro */}
            {(partnerTeams ?? []).map(team => (
              <PartnerTeamStudentsSection
                key={team.ownerUid}
                ownerUid={team.ownerUid}
                ownerName={team.ownerName || "Treinador"}
                selectedStudentId={selectedStudentOverride?.uid ?? null}
                onSelectStudent={(s) => { setSelectedStudentOverride(s); setSelectedStudentId(null); }}
              />
            ))}
          </section>

          <div className="grid gap-4">
            {effectiveStudentForPanel ? (
              <>
                <StudentProfileSummary
                  measurements={measurements}
                  pendingCount={pending.length}
                  student={effectiveStudentForPanel}
                  enrollmentId={(effectiveStudentForPanel as StudentWithEnrollment).enrollment?.id}
                />

                <TrainerMeasurementForm selectedStudent={effectiveStudentForPanel} />

                <TrainerMeasurementsHistory measurements={measurements} />

                {pending.length > 0 && (
                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                    <h2 className="text-xl font-black">Aguardando confirmação</h2>
                    <div className="mt-4 grid gap-3">
                      {pending.map((measurement) => (
                        <MeasurementReviewCard key={measurement.id} measurement={measurement} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function PartnerTeamStudentsSection({
  ownerUid,
  ownerName,
  selectedStudentId,
  onSelectStudent,
}: {
  ownerUid: string;
  ownerName: string;
  selectedStudentId: string | null;
  onSelectStudent: (student: StudentWithEnrollment) => void;
}) {
  const { data: ownerStudents, loading } = useTrainerStudents(ownerUid);
  const activeStudents = useMemo(
    () => (ownerStudents ?? []).filter(s => s.enrollment?.status !== "pending" && s.enrollment?.status !== "cancelled"),
    [ownerStudents]
  );
  const sorted = useMemo(
    () => [...activeStudents].sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR")),
    [activeStudents]
  );

  if (loading || sorted.length === 0) return null;

  return (
    <div className="mt-4 border-t border-stone-100 pt-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Users size={13} className="text-violet-600" />
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
          Alunos do Time {ownerName}
        </p>
      </div>
      <div className="space-y-2">
        {sorted.map(student => (
          <button
            key={student.uid}
            type="button"
            className={[
              "focus-ring grid w-full gap-2 rounded-md border p-3 text-left",
              selectedStudentId === student.uid
                ? "border-violet-600 bg-violet-50"
                : "border-stone-200 bg-white hover:bg-stone-50",
            ].join(" ")}
            onClick={() => onSelectStudent(student)}
          >
            <p className="font-black">{student.displayName}</p>
            <p className="text-sm text-stone-600">{student.onboarding?.email ?? "Sem e-mail"}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StudentMeasurementsPage({
  studentId,
  studentName,
}: {
  studentId: string | null;
  studentName: string;
}) {
  const { data: dbStudent } = useStudent(studentId);
  const { data: allMeasurements = [] } = useMeasurements(studentId);
  const { data: pendingMeasurements = [] } = usePendingMeasurements(studentId);

  // Acentos na cor do treinador ativo.
  const activeTrainerId = useActiveTrainer((s) => s.activeTrainerId);
  const { data: activeTeam } = useTeam(activeTrainerId);
  const primary = activeTeam?.branding?.primaryColor || "#0f766e";

  const effectiveMeasurements = useMemo(
    () => withInitialWeight(allMeasurements ?? [], dbStudent),
    [allMeasurements, dbStudent],
  );

  const effectivePending = useMemo(() => pendingMeasurements ?? [], [pendingMeasurements]);

  const sortedMeasurements = useMemo(
    () => [...effectiveMeasurements].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [effectiveMeasurements],
  );

  const first = sortedMeasurements[0];
  const latest = sortedMeasurements.at(-1);
  const heightCm = dbStudent?.physiological?.alturaCm ?? undefined;
  const currentBmi = bmi(latest?.weightKg, heightCm);
  const weightChange =
    first?.weightKg != null && latest?.weightKg != null
      ? Number((latest.weightKg - first.weightKg).toFixed(1))
      : 0;

  // Accept measurement: save to Firestore measurements subcollection
  async function handleAccept(measurement: StudentMeasurementSubmission) {
    if (!db || !studentId) return;
    try {
      await addDoc(collection(db, `students/${studentId}/measurements`), {
        studentId: measurement.studentId,
        measuredAt: measurement.measuredAt,
        weightKg: measurement.weightKg,
        waistCm: measurement.waistCm,
        hipCm: measurement.hipCm,
        chestCm: measurement.chestCm,
        bodyFatPercent: measurement.bodyFatPercent ?? null,
        notes: measurement.notes ?? "",
        confirmedAt: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      // Mark submission as accepted
      await updateDoc(doc(db, `students/${studentId}/measurementSubmissions`, measurement.id), {
        status: "accepted",
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
    } catch (error: unknown) { const err = error as Error;
      console.error("Erro ao confirmar medida:", err);
    }
  }

  // Reject measurement: mark submission as rejected
  async function handleReject(measurementId: string) {
    if (!db || !studentId) return;
    try {
      await updateDoc(doc(db, `students/${studentId}/measurementSubmissions`, measurementId), {
        status: "rejected",
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
    } catch (error: unknown) { const err = error as Error;
      console.error("Erro ao recusar medida:", err);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide" style={{ color: primary }}>
            Medidas e evolução
          </p>
          <h1 className="mt-2 text-3xl font-black">Acompanhamento do aluno</h1>
          <p className="mt-2 max-w-3xl leading-7 text-stone-600">
            Registre suas próprias medidas ou confirme as lançadas pelo seu personal.
            Apenas medidas confirmadas entram no gráfico de evolução.
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-sm text-stone-600">Aluno</p>
          <p className="font-black">{studentName}</p>
        </div>
      </div>

      {effectivePending.length > 0 ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="text-amber-800" size={22} />
            <h2 className="text-xl font-black">Métricas para confirmar</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            Confirme apenas se os dados estiverem corretos. Depois da confirmação, eles entram no
            seu histórico e no gráfico.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {effectivePending.map((measurement) => (
              <article key={measurement.id} className="rounded-md border border-amber-200 bg-white p-4">
                <MeasurementReviewCard measurement={measurement} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-700"
                    onClick={() => handleAccept(measurement)}
                  >
                    <CheckCircle2 aria-hidden="true" size={17} />
                    Confirmar métricas
                  </button>
                  <button
                    type="button"
                    className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 px-4 text-sm font-bold text-stone-800 hover:bg-stone-100"
                    onClick={() => handleReject(measurement.id)}
                  >
                    <XCircle aria-hidden="true" size={17} />
                    Recusar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Auto-registro do aluno ───────────────────────── */}
      <SelfMeasurementForm studentId={studentId} studentName={studentName} lastMeasurement={sortedMeasurements.at(-1)} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric icon={Activity} color={primary} label="Peso atual" value={unitVal(latest?.weightKg, "kg")} />
        <Metric
          icon={TrendingDown}
          color={primary}
          label="Variação desde início"
          value={`${weightChange > 0 ? "+" : ""}${weightChange} kg`}
        />
        <Metric icon={Ruler} color={primary} label="IMC atual" value={currentBmi ? `${currentBmi}` : "-"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <UserRound aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Status das métricas</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md bg-stone-100 p-4">
              <p className="text-sm text-stone-600">Registros confirmados</p>
              <p className="mt-1 text-2xl font-black">{effectiveMeasurements.length}</p>
            </div>
            <div className="rounded-md bg-amber-50 p-4">
              <p className="text-sm text-amber-900">Aguardando confirmação</p>
              <p className="mt-1 text-2xl font-black text-amber-950">{effectivePending.length}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Activity aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Gráfico de evolução</h2>
          </div>
          <MeasurementChart measurements={sortedMeasurements} />
        </section>
      </div>

      <MeasurementsHistory measurements={sortedMeasurements} title="Histórico salvo" />
    </section>
  );
}

// ── Auto-registro pelo aluno ────────────────────────────────────────────────

function SelfMeasurementForm({
  studentId,
  studentName,
  lastMeasurement,
}: {
  studentId: string | null;
  studentName: string;
  lastMeasurement?: StudentMeasurement;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<MeasurementFormData>({
    resolver: zodResolver(measurementSchema) as any,
    defaultValues: {
      measuredAt: new Date().toISOString().slice(0, 10),
      weightKg: undefined,
      waistCm: undefined,
      hipCm: undefined,
      chestCm: undefined,
      bodyFatPercent: undefined,
      armRightCm: undefined,
      thighCm: undefined,
      calfCm: undefined,
      notes: "",
    },
  });

  function repeatLast() {
    if (!lastMeasurement) return;
    form.reset({
      measuredAt: new Date().toISOString().slice(0, 10),
      weightKg: lastMeasurement.weightKg ?? undefined,
      waistCm: lastMeasurement.waistCm ?? undefined,
      hipCm: lastMeasurement.hipCm ?? undefined,
      chestCm: lastMeasurement.chestCm ?? undefined,
      bodyFatPercent: lastMeasurement.bodyFatPercent ?? undefined,
      armRightCm: lastMeasurement.armRightCm ?? undefined,
      thighCm: lastMeasurement.thighCm ?? undefined,
      calfCm: lastMeasurement.calfCm ?? undefined,
      notes: "",
    });
  }

  async function handleSubmit(data: MeasurementFormData) {
    if (!db || !studentId) return;
    setError("");
    
    // Check if at least one measurement is filled
    const hasAnyMeasurement = 
      data.weightKg || data.waistCm || data.hipCm || data.chestCm || 
      data.bodyFatPercent || data.armRightCm || data.thighCm || data.calfCm;
      
    if (!hasAnyMeasurement) {
      setError("Preencha pelo menos uma medida.");
      return;
    }
    
    setSaving(true);
    setSuccess(false);
    try {
      const payload: Record<string, unknown> = {
        studentId,
        measuredAt: data.measuredAt,
        notes: data.notes ?? "",
        source: "self",
        registeredBy: studentName,
        confirmedAt: serverTimestamp(),
      };
      
      const optionalKeys = ["weightKg", "waistCm", "hipCm", "chestCm", "bodyFatPercent", "armRightCm", "thighCm", "calfCm"] as const;
      optionalKeys.forEach((k) => {
        if (data[k] !== undefined) {
          payload[k] = data[k];
        }
      });
      
      await addDoc(collection(db, `students/${studentId}/measurements`), payload);
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      form.reset({
        measuredAt: data.measuredAt,
      });
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Erro ao salvar medida:", e);
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        id="btn-self-measure"
        className="focus-ring flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-left transition-all hover:bg-emerald-100"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700">
            <Pencil aria-hidden="true" className="text-white" size={16} />
          </div>
          <div>
            <p className="font-black text-emerald-900">Registrar minhas medidas</p>
            <p className="text-sm text-emerald-700">
              Registre só o que quiser — todas as medidas são opcionais.
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp aria-hidden="true" className="text-emerald-700 shrink-0" size={20} />
        ) : (
          <ChevronDown aria-hidden="true" className="text-emerald-700 shrink-0" size={20} />
        )}
      </button>

      {open && (
        <form className="mt-2 rounded-xl border border-stone-200 bg-white p-6 shadow-sm" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Medidas <span className="normal-case font-normal text-stone-300">(preencha o que quiser)</span>
            </p>
            {lastMeasurement && (
              <button
                type="button"
                onClick={repeatLast}
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Copy size={13} /> Repetir últimas medidas
              </button>
            )}
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Input label="Data" type="date" {...form.register("measuredAt")} error={form.formState.errors.measuredAt?.message} required />
            <Input label="Peso (kg)" type="number" step="0.1" {...form.register("weightKg")} error={form.formState.errors.weightKg?.message} placeholder="68.7" />
            <Input label="Cintura (cm)" type="number" step="0.1" {...form.register("waistCm")} error={form.formState.errors.waistCm?.message} placeholder="80" />
            <Input label="Quadril (cm)" type="number" step="0.1" {...form.register("hipCm")} error={form.formState.errors.hipCm?.message} placeholder="100" />
            <Input label="Tórax (cm)" type="number" step="0.1" {...form.register("chestCm")} error={form.formState.errors.chestCm?.message} placeholder="93" />
            <Input label="Gordura corporal (%)" type="number" step="0.1" {...form.register("bodyFatPercent")} error={form.formState.errors.bodyFatPercent?.message} placeholder="27.9" />
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">
            Circunferências adicionais <span className="normal-case font-normal text-stone-300">(opcional)</span>
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Input label="Braço dir. (cm)" type="number" step="0.1" {...form.register("armRightCm")} error={form.formState.errors.armRightCm?.message} placeholder="31" />
            <Input label="Coxa (cm)" type="number" step="0.1" {...form.register("thighCm")} error={form.formState.errors.thighCm?.message} placeholder="55" />
            <Input label="Panturrilha (cm)" type="number" step="0.1" {...form.register("calfCm")} error={form.formState.errors.calfCm?.message} placeholder="37" />
          </div>

          <div className="mt-5">
            <Textarea label="Observações" {...form.register("notes")} error={form.formState.errors.notes?.message} placeholder="Ex: medida feita em jejum, logo pela manhã..." />
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="text-emerald-700" size={18} />
              <p className="text-sm font-semibold text-emerald-800">Medidas salvas com sucesso!</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="submit" className={cn(buttonVariants({}), "focus-ring")} disabled={saving}>
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Plus aria-hidden="true" size={16} />
              )}
              {saving ? "Salvando…" : "Salvar minhas medidas"}
            </button>
            <button type="button" className={cn(buttonVariants({}), "focus-ring")} onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function StudentProfileSummary({
  student,
  measurements,
  pendingCount,
  enrollmentId,
}: {
  student: Student;
  measurements: StudentMeasurement[];
  pendingCount: number;
  enrollmentId?: string;
}) {
  const latest = [...measurements].sort((first, second) =>
    first.measuredAt.localeCompare(second.measuredAt),
  ).at(-1);

  const age = calculateAge(student.onboarding.birthDate, student.onboarding.idade);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Aluno</p>
          <h2 className="mt-1 text-2xl font-black">{student.displayName}</h2>
          <p className="mt-2 text-sm text-stone-600">
            {student.onboarding.email} - {student.onboarding.celular}
            {age !== undefined ? ` · ${age} anos` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {whatsappLink(student.onboarding.celular) && (
              <a
                href={whatsappLink(student.onboarding.celular)!}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <MessageCircle size={14} /> WhatsApp do aluno
              </a>
            )}
            {enrollmentId && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("openGlobalChat", {
                  detail: { chatId: enrollmentId, type: "enrollment", otherUserId: student.uid, otherUserName: student.displayName },
                }))}
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
              >
                <MessageSquare size={14} /> Chat no App
              </button>
            )}
            <a
              href={`/app/agenda?studentId=${student.uid}`}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"
            >
              <CalendarDays size={14} /> Agendar Aula
            </a>
          </div>
        </div>
        <span className="h-max rounded-md bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700">
          {student.status}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Peso atual" value={unitVal(latest?.weightKg, "kg")} />
        <MiniMetric label="Altura" value={student.physiological.alturaCm ? `${student.physiological.alturaCm} cm` : "-"} />
        <MiniMetric label="Pendentes" value={`${pendingCount}`} />
      </div>

      {(student.medicalData?.doencas || student.medicalData?.restricoes || student.medicalData?.orientacoes) && (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50/50 p-4">
          <h3 className="text-sm font-bold text-rose-900 mb-3 flex items-center gap-2">
            <Activity size={16} /> Informações Médicas e Restrições
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {student.medicalData?.doencas && (
              <div>
                <p className="text-xs font-bold text-rose-800 uppercase">Doenças / Condições</p>
                <p className="text-sm text-stone-700 mt-1">{student.medicalData.doencas}</p>
              </div>
            )}
            {student.medicalData?.restricoes && (
              <div>
                <p className="text-xs font-bold text-rose-800 uppercase">Restrições / Lesões</p>
                <p className="text-sm text-stone-700 mt-1">{student.medicalData.restricoes}</p>
              </div>
            )}
            {student.medicalData?.orientacoes && (
              <div>
                <p className="text-xs font-bold text-rose-800 uppercase">Expectativas</p>
                <p className="text-sm text-stone-700 mt-1">{student.medicalData.orientacoes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MeasurementChart({ measurements }: { measurements: StudentMeasurement[] }) {
  return (
    <div className="mt-4 h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={measurements} margin={{ top: 10, right: 40, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" />
          <XAxis
            dataKey="measuredAt"
            tickFormatter={(value) => formatMonth(String(value))}
            stroke="#57534e"
            tick={{ fontSize: 12 }}
          />
          {/* Left Y-axis: kg and cm (similar scale) */}
          <YAxis
            yAxisId="left"
            stroke="#047857"
            tick={{ fontSize: 11 }}
            label={{ value: "kg / cm", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#6b7280" } }}
          />
          {/* Right Y-axis: % (0-100) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#2563eb"
            tick={{ fontSize: 11 }}
            domain={[0, 50]}
            label={{ value: "%", angle: 90, position: "insideRight", offset: -10, style: { fontSize: 10, fill: "#6b7280" } }}
          />
          <Tooltip
            labelFormatter={(value) => formatDate(String(value))}
            formatter={(value, name) => [
              name === "Gordura %" ? `${value}%` : `${value} ${name === "Peso" ? "kg" : "cm"}`,
              name,
            ]}
          />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="weightKg" name="Peso" stroke="#047857" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          <Line yAxisId="left" type="monotone" dataKey="waistCm" name="Cintura" stroke="#be123c" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="bodyFatPercent"
            name="Gordura %"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrainerMeasurementsHistory({ measurements }: { measurements: StudentMeasurement[] }) {
  const sortedMeasurements = [...measurements].sort((first, second) =>
    first.measuredAt.localeCompare(second.measuredAt),
  );
  const latest = sortedMeasurements.at(-1);
  const previous = sortedMeasurements.at(-2);
  const weightDelta =
    latest?.weightKg != null && previous?.weightKg != null
      ? Number((latest.weightKg - previous.weightKg).toFixed(1))
      : null;
  const waistDelta =
    latest?.waistCm != null && previous?.waistCm != null
      ? Number((latest.waistCm - previous.waistCm).toFixed(1))
      : null;
  const bodyFatDelta =
    latest?.bodyFatPercent && previous?.bodyFatPercent
      ? Number((latest.bodyFatPercent - previous.bodyFatPercent).toFixed(1))
      : null;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Histórico gráfico
          </p>
          <h2 className="mt-1 text-xl font-black">Evolução do aluno</h2>
        </div>
        <span className="rounded-md bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700">
          {sortedMeasurements.length} registros aceitos
        </span>
      </div>

      {sortedMeasurements.length ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <TrendMetric
              label="Peso atual"
              value={`${latest?.weightKg ?? "-"} kg`}
              delta={weightDelta}
              unit="kg"
            />
            <TrendMetric
              label="Cintura atual"
              value={`${latest?.waistCm ?? "-"} cm`}
              delta={waistDelta}
              unit="cm"
            />
            <TrendMetric
              label="Gordura atual"
              value={latest?.bodyFatPercent ? `${latest.bodyFatPercent}%` : "-"}
              delta={bodyFatDelta}
              unit="%"
            />
          </div>

          <div className="mt-5 rounded-lg bg-stone-50 p-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sortedMeasurements}
                  margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="weightStroke" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#047857" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                    <linearGradient id="waistStroke" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#be123c" />
                      <stop offset="100%" stopColor="#fb7185" />
                    </linearGradient>
                    <linearGradient id="fatStroke" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e7e2d8" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="measuredAt"
                    stroke="#57534e"
                    tickFormatter={(value) => formatMonth(String(value))}
                    tick={{ fontSize: 11 }}
                  />
                  {/* Left: kg / cm */}
                  <YAxis
                    yAxisId="left"
                    stroke="#047857"
                    tick={{ fontSize: 11 }}
                  />
                  {/* Right: % */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#2563eb"
                    domain={[0, 50]}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value, name) => [
                      String(name).includes("%") ? `${value}%` : `${value} ${String(name).includes("Peso") ? "kg" : "cm"}`,
                      name,
                    ]}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    activeDot={{ r: 7 }}
                    dataKey="weightKg"
                    dot={{ r: 4 }}
                    name="Peso (kg)"
                    stroke="url(#weightStroke)"
                    strokeWidth={4}
                    type="monotone"
                  />
                  <Line
                    yAxisId="left"
                    activeDot={{ r: 7 }}
                    dataKey="waistCm"
                    dot={{ r: 4 }}
                    name="Cintura (cm)"
                    stroke="url(#waistStroke)"
                    strokeWidth={4}
                    type="monotone"
                  />
                  <Line
                    yAxisId="right"
                    activeDot={{ r: 7 }}
                    dataKey="bodyFatPercent"
                    dot={{ r: 4 }}
                    name="Gordura (%)"
                    stroke="url(#fatStroke)"
                    strokeWidth={4}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[...sortedMeasurements].reverse().slice(0, 4).map((measurement) => (
              <article key={measurement.id} className="rounded-md border border-stone-200 p-3">
                <p className="text-sm font-black">{formatDate(measurement.measuredAt)}</p>
                <p className="mt-2 text-xs text-stone-600">
                  Peso {unitVal(measurement.weightKg, "kg")} · Cintura {unitVal(measurement.waistCm, "cm")}
                </p>
                <p className="mt-1 text-xs text-stone-600">
                  Gordura {measurement.bodyFatPercent ? `${measurement.bodyFatPercent}%` : "-"}
                </p>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-stone-600">
          Nenhuma métrica aceita ainda. Assim que o aluno confirmar uma avaliacao, o histórico
          gráfico aparecerá aqui.
        </div>
      )}
    </section>
  );
}

function TrendMetric({
  label,
  value,
  delta,
  unit,
}: {
  label: string;
  value: string;
  delta: number | null;
  unit: string;
}) {
  const deltaText =
    delta === null ? "Sem comparativo" : `${delta > 0 ? "+" : ""}${delta} ${unit} desde o último`;
  const positive = delta !== null && delta <= 0;

  return (
    <div className="rounded-md border border-stone-200 bg-white p-4">
      <p className="text-sm text-stone-600">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className={positive ? "mt-2 text-xs font-bold text-emerald-800" : "mt-2 text-xs font-bold text-stone-500"}>
        {deltaText}
      </p>
    </div>
  );
}

function MeasurementsHistory({
  measurements,
  title,
}: {
  measurements: StudentMeasurement[];
  title: string;
}) {
  const sortedMeasurements = [...measurements].sort((first, second) =>
    second.measuredAt.localeCompare(first.measuredAt),
  );

  return (
    <section className="mt-4 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-stone-600">
              <Th>Data</Th>
              <Th>Peso</Th>
              <Th>Cintura</Th>
              <Th>Quadril</Th>
              <Th>Torax</Th>
              <Th>Gordura</Th>
              <Th>Observações</Th>
            </tr>
          </thead>
          <tbody>
            {sortedMeasurements.map((measurement) => (
              <tr key={measurement.id}>
                <Td>{formatDate(measurement.measuredAt)}</Td>
                <Td>{unitVal(measurement.weightKg, "kg")}</Td>
                <Td>{unitVal(measurement.waistCm, "cm")}</Td>
                <Td>{unitVal(measurement.hipCm, "cm")}</Td>
                <Td>{unitVal(measurement.chestCm, "cm")}</Td>
                <Td>{measurement.bodyFatPercent != null ? `${measurement.bodyFatPercent}%` : "–"}</Td>
                <Td>{measurement.notes || "-"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MeasurementReviewCard({
  measurement,
}: {
  measurement: StudentMeasurementSubmission;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{formatDate(measurement.measuredAt)}</p>
          <p className="mt-1 text-sm text-stone-600">
            Enviado por {measurement.submittedByName}
          </p>
        </div>
        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-950">
          Pendente
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Peso" value={unitVal(measurement.weightKg, "kg")} />
        <MiniMetric label="Cintura" value={unitVal(measurement.waistCm, "cm")} />
        <MiniMetric label="Gordura" value={measurement.bodyFatPercent ? `${measurement.bodyFatPercent}%` : "-"} />
      </div>
      {measurement.notes ? (
        <p className="mt-3 text-sm leading-6 text-stone-600">{measurement.notes}</p>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-100 p-3">
      <p className="text-xs text-stone-600">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

// Exibe um valor com unidade, ou "–" quando a medida não foi registrada.
function unitVal(value: number | undefined | null, unit: string) {
  return value == null ? "–" : `${value} ${unit}`;
}

// Usa o peso inicial do cadastro como primeira medida, datado no dia do
// cadastro. Se já houver uma medida real nessa data, a real prevalece.
function withInitialWeight(
  measurements: StudentMeasurement[],
  student: { uid?: string; physiological?: { pesoInicialKg?: number }; createdAt?: string } | null | undefined,
): StudentMeasurement[] {
  const peso = student?.physiological?.pesoInicialKg;
  const created = student?.createdAt;
  if (!peso || !created) return measurements;
  const date = String(created).slice(0, 10);
  if (measurements.some((m) => m.measuredAt === date)) return measurements;
  const initial: StudentMeasurement = {
    id: "__initial__",
    studentId: student?.uid ?? "",
    measuredAt: date,
    weightKg: peso,
    notes: "Peso inicial (cadastro)",
  };
  return [initial, ...measurements];
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <Icon aria-hidden="true" className="text-emerald-800" style={color ? { color } : undefined} size={22} />
      <p className="mt-3 text-sm text-stone-600">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="border-b border-stone-200 px-3 py-3 font-bold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-stone-100 px-3 py-3 align-top">{children}</td>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}
