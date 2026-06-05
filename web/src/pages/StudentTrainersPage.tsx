import { CheckCircle2, Clock, MessageCircle, Pause, Play, Plus, Star, UserX, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useActiveTrainer } from "../lib/activeTrainer";
import { useStudentEnrollments, useTeam } from "../lib/hooks";
import { setEnrollmentStatus } from "../lib/enrollments";
import { whatsappLink } from "../lib/format";
import type { Enrollment, EnrollmentStatus } from "../types/domain";

const statusConfig: Record<EnrollmentStatus, { label: string; badge: string }> = {
  pending: { label: "Aguardando aprovação", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  active: { label: "Ativo", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  paused: { label: "Pausado", badge: "bg-stone-100 text-stone-600 border-stone-200" },
  cancelled: { label: "Cancelado", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

export function StudentTrainersPage() {
  const user = useSessionStore((state) => state.user);
  const activeTrainerId = useActiveTrainer((state) => state.activeTrainerId);
  const setActiveTrainer = useActiveTrainer((state) => state.setActiveTrainer);

  const { data: enrollments, loading } = useStudentEnrollments(user?.uid ?? null);

  const visible = enrollments
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => (a.teamName || "").localeCompare(b.teamName || "", "pt-BR"));

  async function changeStatus(enrollment: Enrollment, status: EnrollmentStatus) {
    if (!db) return;
    try {
      await setEnrollmentStatus(db, enrollment.id, status);
      if (status === "cancelled" && activeTrainerId === enrollment.trainerId) {
        setActiveTrainer(null);
      }
    } catch (err) {
      console.error("Erro ao atualizar vínculo:", err);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Meus treinadores</p>
          <h1 className="mt-2 text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
            Treinadores e modalidades
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Você pode treinar com mais de um profissional. Escolha qual treinador fica ativo —
            o painel, as aulas e o saldo passam a ser dele.
          </p>
        </div>
        <Link to="/treinadores" className="focus-ring btn btn-primary h-11 shrink-0">
          <Plus size={16} />
          Encontrar treinador
        </Link>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-200 bg-stone-50 py-16 text-center">
          <UserX className="mx-auto mb-4 text-stone-300" size={40} />
          <p className="font-semibold text-stone-500">Você ainda não tem treinadores</p>
          <p className="mt-1 text-sm text-stone-400">Explore a vitrine e contrate um personal para começar.</p>
          <Link to="/treinadores" className="focus-ring btn btn-primary mt-5">
            Ver treinadores <Plus size={16} />
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {visible.map((enrollment) => (
            <EnrollmentCard
              key={enrollment.id}
              enrollment={enrollment}
              isActive={activeTrainerId === enrollment.trainerId}
              onSetActive={() => setActiveTrainer(enrollment.trainerId)}
              onChangeStatus={(status) => changeStatus(enrollment, status)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EnrollmentCard({
  enrollment,
  isActive,
  onSetActive,
  onChangeStatus,
}: {
  enrollment: Enrollment;
  isActive: boolean;
  onSetActive: () => void;
  onChangeStatus: (status: EnrollmentStatus) => void;
}) {
  // Time é público → o aluno pode ler para obter o contato do treinador.
  const { data: team } = useTeam(enrollment.trainerId);
  const cfg = statusConfig[enrollment.status];
  const remaining = Math.max((enrollment.classesQuota ?? 0) - (enrollment.classesUsed ?? 0), 0);
  const wa = enrollment.status === "active" ? whatsappLink(team?.contactPhone) : null;

  return (
    <article
      className={[
        "rounded-2xl border bg-white p-5 transition-all",
        isActive ? "border-emerald-500 shadow-[var(--shadow-md)]" : "border-stone-200",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-stone-950">{enrollment.teamName || team?.name || "Treinador"}</h2>
            {isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-2xs font-bold text-white">
                <Star size={11} className="fill-white" /> Ativo
              </span>
            )}
          </div>
          <span className={["mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold", cfg.badge].join(" ")}>
            {enrollment.status === "pending" && <Clock size={11} />}
            {enrollment.status === "active" && <CheckCircle2 size={11} />}
            {cfg.label}
          </span>
        </div>
        {enrollment.status === "active" && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-center">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-500">Saldo de aulas</p>
            <p className="text-2xl font-black text-emerald-800">{remaining}</p>
          </div>
        )}
      </div>

      {enrollment.status === "pending" && (
        <p className="mt-3 text-sm text-stone-500">
          Seu pedido foi enviado. Assim que o treinador aprovar, este vínculo fica ativo, você verá o
          contato dele e poderá comprar aulas.
        </p>
      )}

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"
        >
          <MessageCircle size={16} /> Falar no WhatsApp
        </a>
      )}
      {enrollment.status === "active" && !wa && (
        <p className="mt-3 text-xs text-stone-400">O treinador ainda não cadastrou um contato.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {enrollment.status === "active" && !isActive && (
          <button type="button" className="focus-ring btn btn-primary btn-sm" onClick={onSetActive}>
            <Zap size={14} /> Tornar ativo
          </button>
        )}
        {enrollment.status === "active" && (
          <button type="button" className="focus-ring btn btn-secondary btn-sm" onClick={() => onChangeStatus("paused")}>
            <Pause size={14} /> Pausar
          </button>
        )}
        {enrollment.status === "paused" && (
          <button type="button" className="focus-ring btn btn-primary btn-sm" onClick={() => onChangeStatus("active")}>
            <Play size={14} /> Retomar
          </button>
        )}
        {enrollment.status !== "pending" && (
          <button
            type="button"
            className="focus-ring btn btn-outline btn-sm text-rose-600"
            onClick={() => onChangeStatus("cancelled")}
          >
            <UserX size={14} /> Encerrar vínculo
          </button>
        )}
      </div>
    </article>
  );
}
