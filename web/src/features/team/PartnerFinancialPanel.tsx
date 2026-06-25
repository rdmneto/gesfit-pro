import { cardClasses } from "../../components/ui/Primitives";
import { cn } from "../../lib/utils";
import { useState, useMemo } from "react";
import { doc, setDoc } from "firebase/firestore";
import { CheckCircle2, Copy, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import { db } from "../../lib/firebase";
import { useSessionStore } from "../../store/session";
import {
  useActivePartnerTeams,
  useAssignedSessions,
  usePartnerRates,
  useTeam,
  useTeamMembers,
  useWorkoutSessions,
} from "../../lib/hooks";
import type { PartnerRate, TeamMember, WorkoutSession } from "../../types/domain";
import { queryClient } from "../../main";

function monthRange(offset = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const label = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { start, end, label };
}

function countSessionsInMonth(
  sessions: WorkoutSession[],
  partnerId: string,
  monthStart: string,
  monthEnd: string
) {
  return sessions.filter(
    (s) =>
      s.assignedToId === partnerId &&
      s.status === "completed" &&
      s.startsAt >= monthStart &&
      s.startsAt <= monthEnd
  ).length;
}

function PixButton({ pixKey, amount, label }: { pixKey: string; amount: number; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(pixKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  if (!pixKey) return <span className="text-xs text-stone-400">Chave PIX não cadastrada</span>;
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copiar chave PIX de ${label} — R$ ${amount.toFixed(2).replace(".", ",")}`}
      className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white hover:bg-violet-500 transition-colors"
    >
      {copied ? <><CheckCircle2 size={13} /> Copiado!</> : <><Copy size={13} /> Realizar PIX</>}
    </button>
  );
}

function OwnerPixSection({ ownerUid, ownerName, amount }: { ownerUid: string; ownerName: string; amount: number }) {
  const { data: ownerTeam } = useTeam(ownerUid);
  return <PixButton pixKey={ownerTeam?.pixKey ?? ""} amount={amount} label={ownerName} />;
}

function PartnerPixSection({ partnerId, partnerName, amount }: { partnerId: string; partnerName: string; amount: number }) {
  const { data: partnerTeam } = useTeam(partnerId);
  return <PixButton pixKey={partnerTeam?.pixKey ?? ""} amount={amount} label={partnerName} />;
}

function RateEditor({
  ownerId,
  partner,
  currentRate,
}: {
  ownerId: string;
  partner: TeamMember;
  currentRate: PartnerRate | undefined;
}) {
  const [rate, setRate] = useState(String(currentRate?.ratePerSession ?? ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!db || !rate || isNaN(Number(rate))) return;
    setSaving(true);
    try {
      const rateId = `${ownerId}__${partner.subTrainerId}`;
      await setDoc(doc(db, "partnerRates", rateId), {
        id: rateId,
        ownerId,
        partnerId: partner.subTrainerId,
        partnerName: partner.subTrainerName,
        ratePerSession: Number(rate),
        updatedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">R$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="0,00"
          className="focus-ring h-8 w-28 rounded-lg border border-stone-200 bg-white pl-8 pr-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !rate}
        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        {saved ? <><CheckCircle2 size={13} /> Salvo</> : saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}

export function PartnerFinancialPanel({ trainerId }: { trainerId: string }) {
  const user = useSessionStore((s) => s.user);
  const [monthOffset, setMonthOffset] = useState(0);
  const { start, end, label } = monthRange(monthOffset);

  // Use user.uid directly — trainerId prop may be empty if teamId claim isn't set
  const ownUid = user?.uid ?? null;
  const { data: ownPartners } = useTeamMembers(ownUid);
  const { data: partnerRates } = usePartnerRates(ownUid);
  const { data: ownSessions } = useWorkoutSessions({ trainerId: ownUid ?? trainerId });
  const { data: teamsImIn } = useActivePartnerTeams(user?.uid ?? null);
  const { data: assignedSessions } = useAssignedSessions(user?.uid ?? null);

  const partnerSummary = useMemo(() => {
    // Exclude self-referential docs (corrupted data where trainer appears as own partner)
    return (ownPartners ?? []).filter((p) => p.subTrainerId !== ownUid).map((partner) => {
      const rate = (partnerRates ?? []).find((r) => r.partnerId === partner.subTrainerId);
      const sessionCount = countSessionsInMonth(ownSessions ?? [], partner.subTrainerId, start, end);
      const total = (rate?.ratePerSession ?? 0) * sessionCount;
      return { partner, rate, sessionCount, total };
    });
  }, [ownPartners, partnerRates, ownSessions, start, end]);

  const receivableSummary = useMemo(() => {
    return (teamsImIn ?? []).map((team) => {
      const mySessions = (assignedSessions ?? []).filter(
        (s) =>
          s.trainerId === team.ownerUid &&
          s.status === "completed" &&
          s.startsAt >= start &&
          s.startsAt <= end
      ).length;
      return { team, sessionCount: mySessions };
    });
  }, [teamsImIn, assignedSessions, start, end]);

  const totalToPay = partnerSummary.reduce((acc, s) => acc + s.total, 0);

  const hasAnything = ownPartners.length > 0 || teamsImIn.length > 0;

  return (
    <div className="space-y-6">
      {/* Month picker */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMonthOffset((o) => o - 1)}
          className="focus-ring h-8 w-8 rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 transition-colors flex items-center justify-center font-bold"
        >
          ‹
        </button>
        <span className="text-sm font-bold capitalize text-stone-700 min-w-[150px] text-center">{label}</span>
        <button
          type="button"
          onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
          disabled={monthOffset >= 0}
          className="focus-ring h-8 w-8 rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 transition-colors flex items-center justify-center font-bold"
        >
          ›
        </button>
      </div>

      {!hasAnything && (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 py-16 text-center">
          <Wallet className="mx-auto mb-4 text-stone-300" size={40} />
          <p className="font-semibold text-stone-500">Nenhum treinador parceiro</p>
          <p className="mt-1 text-sm text-stone-400">
            Vincule treinadores na aba "Meu Time" para ativar o módulo financeiro.
          </p>
        </div>
      )}

      {/* A PAGAR — Parceiros do meu time */}
      {ownPartners.length > 0 && (
        <section className={cn(cardClasses, "p-5")}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50">
                <Receipt aria-hidden="true" className="text-rose-700" size={16} />
              </div>
              <h2 className="text-lg font-black text-stone-950">A Pagar — Treinadores Parceiros</h2>
            </div>
            <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-1.5 text-sm font-black text-rose-800">
              Total: R$ {totalToPay.toFixed(2).replace(".", ",")}
            </div>
          </div>

          <div className="space-y-4">
            {partnerSummary.map(({ partner, rate, sessionCount, total }) => (
              <div key={partner.subTrainerId} className="rounded-xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900">{partner.subTrainerName}</p>
                      <p className="text-xs text-stone-500">{partner.subTrainerEmail}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-stone-500">Aulas concluídas</p>
                      <p className="text-lg font-black text-stone-900">{sessionCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-stone-500">Total do mês</p>
                      <p className="text-lg font-black text-emerald-700">
                        R$ {total.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500">Valor por aula:</span>
                    <RateEditor ownerId={trainerId} partner={partner} currentRate={rate} />
                  </div>
                  <PartnerPixSection
                    partnerId={partner.subTrainerId}
                    partnerName={partner.subTrainerName}
                    amount={total}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* A RECEBER — Times em que sou parceiro */}
      {teamsImIn.length > 0 && (
        <section className={cn(cardClasses, "p-5")}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <TrendingUp aria-hidden="true" className="text-emerald-700" size={16} />
            </div>
            <h2 className="text-lg font-black text-stone-950">A Receber — Times em que Participo</h2>
          </div>

          <div className="space-y-4">
            {receivableSummary.map(({ team, sessionCount }) => (
              <PartnerReceivableRow
                key={team.ownerUid}
                team={team}
                sessionCount={sessionCount}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PartnerReceivableRow({
  team,
  sessionCount,
}: {
  team: TeamMember;
  sessionCount: number;
}) {
  const { data: rates } = usePartnerRates(team.ownerUid);
  const user = useSessionStore((s) => s.user);

  const myRate = (rates ?? []).find((r) => r.partnerId === user?.uid);
  const amount = (myRate?.ratePerSession ?? 0) * sessionCount;

  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800">
            <Users size={18} />
          </div>
          <div>
            <p className="font-bold text-stone-900">Time de {team.ownerName}</p>
            <p className="text-xs text-stone-500">
              Valor por aula:{" "}
              {myRate
                ? `R$ ${myRate.ratePerSession.toFixed(2).replace(".", ",")}`
                : "Não definido pelo treinador"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-stone-500">Aulas concluídas</p>
            <p className="text-lg font-black text-stone-900">{sessionCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-500">A receber</p>
            <p className="text-lg font-black text-emerald-700">
              {myRate ? `R$ ${amount.toFixed(2).replace(".", ",")}` : "—"}
            </p>
          </div>
        </div>
      </div>
      {myRate && (
        <div className="mt-3 flex justify-end border-t border-stone-100 pt-3">
          <OwnerPixSection
            ownerUid={team.ownerUid}
            ownerName={team.ownerName || "Treinador"}
            amount={amount}
          />
        </div>
      )}
    </div>
  );
}
