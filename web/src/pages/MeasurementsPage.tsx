import {
  Activity,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Ruler,
  Search,
  TrendingDown,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
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
import { bmi, calculateAge } from "../lib/format";
import {
  useMeasurements,
  usePendingMeasurements,
  useStudent,
  useStudents,
} from "../lib/hooks";
import { useSessionStore } from "../store/session";
import type { Student, StudentMeasurement, StudentMeasurementSubmission } from "../types/domain";

export function MeasurementsPage() {
  const role = useSessionStore((state) => state.claims.role);
  const user = useSessionStore((state) => state.user);

  if (role === "trainer") {
    return <TrainerStudentsPage trainerId={user?.uid ?? null} />;
  }

  return <StudentMeasurementsPage studentId={user?.uid ?? null} studentName={user?.displayName ?? "Aluno"} />;
}


function TrainerStudentsPage({ trainerId }: { trainerId: string | null }) {
  const user = useSessionStore((state) => state.user);
  const { data: allStudents, loading: studentsLoading } = useStudents(trainerId);
  const [query, setQuery] = useState("");

  const sortedStudents = useMemo(
    () => [...(allStudents || [])].sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR")),
    [allStudents],
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Auto-select first student when data loads
  const effectiveSelectedId = selectedStudentId ?? sortedStudents[0]?.uid ?? null;

  const filteredStudents = sortedStudents.filter((student) =>
    student.displayName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const selectedStudent = sortedStudents.find((s) => s.uid === effectiveSelectedId) ?? null;

  const { data: selectedMeasurements = [] } = useMeasurements(effectiveSelectedId);
  const { data: selectedPending = [] } = usePendingMeasurements(effectiveSelectedId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent || !db || !user) return;

    const data = new FormData(event.currentTarget);
    try {
      await addDoc(collection(db, `students/${selectedStudent.uid}/measurementSubmissions`), {
        studentId: selectedStudent.uid,
        measuredAt: String(data.get("measuredAt")),
        weightKg: Number(data.get("weightKg")),
        waistCm: Number(data.get("waistCm")),
        hipCm: Number(data.get("hipCm")),
        chestCm: Number(data.get("chestCm")),
        bodyFatPercent: Number(data.get("bodyFatPercent")) || null,
        notes: String(data.get("notes") ?? ""),
        submittedBy: user.uid,
        submittedByName: user.displayName ?? "Treinador",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      event.currentTarget.reset();
    } catch (err) {
      console.error("Erro ao salvar medida:", err);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Alunos e metricas
          </p>
          <h1 className="mt-2 text-3xl font-black">Lista de alunos</h1>
          <p className="mt-2 max-w-3xl leading-7 text-stone-600">
            Busque alunos em ordem alfabetica, selecione um perfil e lance metricas. Elas ficam
            pendentes ate o aluno confirmar no proprio perfil.
          </p>
        </div>
        <label className="relative block lg:w-80">
          <span className="sr-only">Buscar aluno</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
            size={18}
          />
          <input
            className="focus-ring h-11 w-full rounded-md border border-stone-300 bg-white pl-10 pr-3"
            placeholder="Buscar aluno"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {studentsLoading ? (
        <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" /></div>
      ) : sortedStudents.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-200 bg-stone-50 py-16 text-center">
          <Users className="mx-auto mb-4 text-stone-300" size={40} />
          <p className="font-semibold text-stone-500">Nenhum aluno cadastrado ainda</p>
          <p className="mt-1 text-sm text-stone-400">Os alunos que se vincularem a você aparecerão aqui.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Users aria-hidden="true" className="text-emerald-800" size={22} />
              <h2 className="text-xl font-black">Alunos</h2>
            </div>
            <div className="mt-4 space-y-2">
              {filteredStudents.map((student) => (
                <button
                  key={student.uid}
                  type="button"
                  className={[
                    "focus-ring grid w-full gap-2 rounded-md border p-3 text-left sm:grid-cols-[1fr_auto]",
                    effectiveSelectedId === student.uid
                      ? "border-emerald-700 bg-emerald-50"
                      : "border-stone-200 bg-white hover:bg-stone-50",
                  ].join(" ")}
                  onClick={() => setSelectedStudentId(student.uid)}
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
          </section>

          <div className="grid gap-4">
            {selectedStudent ? (
              <>
                <StudentProfileSummary
                  measurements={selectedMeasurements}
                  pendingCount={selectedPending.length}
                  student={selectedStudent}
                />

                <form className="card p-5" onSubmit={handleSubmit}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                      <Plus aria-hidden="true" className="text-emerald-700" size={16} />
                    </div>
                    <h2 className="text-lg font-black text-stone-950">Inserir métricas</h2>
                  </div>

                  <p className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">Dados principais</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Data" name="measuredAt" type="date" required />
                    <Field label="Peso (kg)" name="weightKg" placeholder="68.7" type="number" step="0.1" required />
                    <Field label="Cintura (cm)" name="waistCm" placeholder="80" type="number" step="0.1" required />
                    <Field label="Quadril (cm)" name="hipCm" placeholder="100" type="number" step="0.1" required />
                    <Field label="Tórax (cm)" name="chestCm" placeholder="93" type="number" step="0.1" required />
                    <Field label="Gordura corporal (%)" name="bodyFatPercent" placeholder="27.9" type="number" step="0.1" />
                  </div>

                  <p className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">Circunferências adicionais <span className="normal-case font-normal text-stone-300">(opcional)</span></p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <Field label="Braço dir. (cm)" name="armRightCm" placeholder="31" type="number" step="0.1" />
                    <Field label="Coxa (cm)" name="thighCm" placeholder="55" type="number" step="0.1" />
                    <Field label="Panturrilha (cm)" name="calfCm" placeholder="37" type="number" step="0.1" />
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

                  <label className="mt-4 block">
                    <span className="text-sm font-semibold text-stone-700">Observações</span>
                    <textarea
                      className="focus-ring mt-2 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2"
                      name="notes"
                      placeholder="Observações da avaliação presencial."
                    />
                  </label>

                  <button type="submit" className="focus-ring mt-5 btn btn-primary">
                    <Plus aria-hidden="true" size={18} />
                    Enviar para confirmação do aluno
                  </button>
                </form>

                <TrainerMeasurementsHistory measurements={selectedMeasurements} />

                {selectedPending.length > 0 && (
                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                    <h2 className="text-xl font-black">Aguardando confirmacao</h2>
                    <div className="mt-4 grid gap-3">
                      {selectedPending.map((measurement) => (
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

  const sortedMeasurements = useMemo(
    () => [...allMeasurements].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [allMeasurements],
  );

  const first = sortedMeasurements[0];
  const latest = sortedMeasurements.at(-1);
  const heightCm = dbStudent?.physiological?.alturaCm ?? undefined;
  const currentBmi = bmi(latest?.weightKg, heightCm);
  const weightChange = first && latest ? Number((latest.weightKg - first.weightKg).toFixed(1)) : 0;

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
      // Mark submission as accepted
      await updateDoc(doc(db, `students/${studentId}/measurementSubmissions`, measurement.id), {
        status: "accepted",
      });
    } catch (err) {
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
    } catch (err) {
      console.error("Erro ao recusar medida:", err);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Medidas e evolucao
          </p>
          <h1 className="mt-2 text-3xl font-black">Acompanhamento do aluno</h1>
          <p className="mt-2 max-w-3xl leading-7 text-stone-600">
            Registre suas próprias medidas ou confirme as lançadas pelo seu personal.
            Apenas medidas confirmadas entram no grafico de evolucao.
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-sm text-stone-600">Aluno</p>
          <p className="font-black">{studentName}</p>
        </div>
      </div>

      {pendingMeasurements.length > 0 ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="text-amber-800" size={22} />
            <h2 className="text-xl font-black">Metricas para confirmar</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            Confirme apenas se os dados estiverem corretos. Depois da confirmacao, eles entram no
            seu historico e no grafico.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {pendingMeasurements.map((measurement) => (
              <article key={measurement.id} className="rounded-md border border-amber-200 bg-white p-4">
                <MeasurementReviewCard measurement={measurement} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-700"
                    onClick={() => handleAccept(measurement)}
                  >
                    <CheckCircle2 aria-hidden="true" size={17} />
                    Confirmar metricas
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
      <SelfMeasurementForm studentId={studentId} studentName={studentName} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric icon={Activity} label="Peso atual" value={latest ? `${latest.weightKg} kg` : "-"} />
        <Metric
          icon={TrendingDown}
          label="Variacao desde inicio"
          value={`${weightChange > 0 ? "+" : ""}${weightChange} kg`}
        />
        <Metric icon={Ruler} label="IMC atual" value={currentBmi ? `${currentBmi}` : "-"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <UserRound aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Status das metricas</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md bg-stone-100 p-4">
              <p className="text-sm text-stone-600">Registros confirmados</p>
              <p className="mt-1 text-2xl font-black">{allMeasurements.length}</p>
            </div>
            <div className="rounded-md bg-amber-50 p-4">
              <p className="text-sm text-amber-900">Aguardando confirmacao</p>
              <p className="mt-1 text-2xl font-black text-amber-950">{pendingMeasurements.length}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Activity aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Grafico de evolucao</h2>
          </div>
          <MeasurementChart measurements={sortedMeasurements} />
        </section>
      </div>

      <MeasurementsHistory measurements={sortedMeasurements} title="Historico salvo" />
    </section>
  );
}

// ── Auto-registro pelo aluno ────────────────────────────────────────────────

function SelfMeasurementForm({
  studentId,
  studentName,
}: {
  studentId: string | null;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !studentId) return;
    setSaving(true);
    setSuccess(false);
    const data = new FormData(event.currentTarget);

    try {
      await addDoc(collection(db, `students/${studentId}/measurements`), {
        studentId,
        measuredAt: String(data.get("measuredAt")),
        weightKg: Number(data.get("weightKg")),
        waistCm: Number(data.get("waistCm")),
        hipCm: Number(data.get("hipCm")),
        chestCm: Number(data.get("chestCm")),
        bodyFatPercent: Number(data.get("bodyFatPercent")) || null,
        armRightCm: Number(data.get("armRightCm")) || null,
        thighCm: Number(data.get("thighCm")) || null,
        calfCm: Number(data.get("calfCm")) || null,
        notes: String(data.get("notes") ?? ""),
        source: "self",
        registeredBy: studentName,
        confirmedAt: serverTimestamp(),
      });
      formRef.current?.reset();
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error("Erro ao salvar medida:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      {/* Toggle button */}
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
              Medidas registradas por voc\u00ea s\u00e3o confirmadas automaticamente
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp aria-hidden="true" className="text-emerald-700 shrink-0" size={20} />
        ) : (
          <ChevronDown aria-hidden="true" className="text-emerald-700 shrink-0" size={20} />
        )}
      </button>

      {/* Collapsible form */}
      {open && (
        <form
          ref={formRef}
          className="mt-2 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Dados principais
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Data" name="measuredAt" type="date" required />
            <Field label="Peso (kg)" name="weightKg" placeholder="68.7" type="number" step="0.1" required />
            <Field label="Cintura (cm)" name="waistCm" placeholder="80" type="number" step="0.1" required />
            <Field label="Quadril (cm)" name="hipCm" placeholder="100" type="number" step="0.1" required />
            <Field label="T\u00f3rax (cm)" name="chestCm" placeholder="93" type="number" step="0.1" required />
            <Field label="Gordura corporal (%)" name="bodyFatPercent" placeholder="27.9" type="number" step="0.1" />
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-stone-400">
            Circunfer\u00eancias adicionais{" "}
            <span className="normal-case font-normal text-stone-300">(opcional)</span>
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label="Bra\u00e7o dir. (cm)" name="armRightCm" placeholder="31" type="number" step="0.1" />
            <Field label="Coxa (cm)" name="thighCm" placeholder="55" type="number" step="0.1" />
            <Field label="Panturrilha (cm)" name="calfCm" placeholder="37" type="number" step="0.1" />
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-stone-700">Observa\u00e7\u00f5es</span>
            <textarea
              className="focus-ring mt-2 min-h-20 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              name="notes"
              placeholder="Ex: medida feita em jejum, logo pela manh\u00e3..."
            />
          </label>

          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="text-emerald-700" size={18} />
              <p className="text-sm font-semibold text-emerald-800">
                Medidas salvas com sucesso!
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              className="focus-ring btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Plus aria-hidden="true" size={16} />
              )}
              {saving ? "Salvando\u2026" : "Salvar minhas medidas"}
            </button>
            <button
              type="button"
              className="focus-ring btn btn-outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
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
}: {
  student: Student;
  measurements: StudentMeasurement[];
  pendingCount: number;
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
        </div>
        <span className="h-max rounded-md bg-stone-100 px-3 py-2 text-sm font-bold text-stone-700">
          {student.status}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Peso atual" value={latest ? `${latest.weightKg} kg` : "-"} />
        <MiniMetric label="Altura" value={student.physiological.alturaCm ? `${student.physiological.alturaCm} cm` : "-"} />
        <MiniMetric label="Pendentes" value={`${pendingCount}`} />
      </div>
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
    latest && previous ? Number((latest.weightKg - previous.weightKg).toFixed(1)) : null;
  const waistDelta =
    latest && previous ? Number((latest.waistCm - previous.waistCm).toFixed(1)) : null;
  const bodyFatDelta =
    latest?.bodyFatPercent && previous?.bodyFatPercent
      ? Number((latest.bodyFatPercent - previous.bodyFatPercent).toFixed(1))
      : null;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Historico grafico
          </p>
          <h2 className="mt-1 text-xl font-black">Evolucao do aluno</h2>
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
                  Peso {measurement.weightKg} kg - Cintura {measurement.waistCm} cm
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
          Nenhuma metrica aceita ainda. Assim que o aluno confirmar uma avaliacao, o historico
          grafico aparecera aqui.
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
    delta === null ? "Sem comparativo" : `${delta > 0 ? "+" : ""}${delta} ${unit} desde o ultimo`;
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
              <Th>Observacoes</Th>
            </tr>
          </thead>
          <tbody>
            {sortedMeasurements.map((measurement) => (
              <tr key={measurement.id}>
                <Td>{formatDate(measurement.measuredAt)}</Td>
                <Td>{measurement.weightKg} kg</Td>
                <Td>{measurement.waistCm} cm</Td>
                <Td>{measurement.hipCm} cm</Td>
                <Td>{measurement.chestCm} cm</Td>
                <Td>{measurement.bodyFatPercent ? `${measurement.bodyFatPercent}%` : "-"}</Td>
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
        <MiniMetric label="Peso" value={`${measurement.weightKg} kg`} />
        <MiniMetric label="Cintura" value={`${measurement.waistCm} cm`} />
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

function Field({
  label,
  name,
  placeholder,
  type = "text",
  step,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <Icon aria-hidden="true" className="text-emerald-800" size={22} />
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
