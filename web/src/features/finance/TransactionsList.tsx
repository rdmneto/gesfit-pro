import { useState } from "react";
import { CheckCircle2, XCircle, Filter, Plus, Search } from "lucide-react";
import { doc, updateDoc, addDoc, collection, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSessionStore } from "../../store/session";
import { useTrainerStudents } from "../../lib/hooks";
import { creditEnrollmentClasses } from "../../lib/enrollments";
import { moneyFromCents } from "../../lib/format";
import { cn } from "../../lib/utils";
import { cardClasses } from "../../components/ui/Primitives";
import type { ClassPurchase, PurchaseStatus } from "../../types/domain";
import { queryClient } from "../../main";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  awaiting_payment: "Aguardando",
  payment_submitted: "Comprovante enviado",
  paid: "Pago",
  rejected: "Recusado",
};

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  awaiting_payment: "bg-amber-100 text-amber-800 border-amber-200",
  payment_submitted: "bg-blue-100 text-blue-800 border-blue-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

type FilterStatus = "all" | PurchaseStatus;

interface TransactionsListProps {
  purchases: ClassPurchase[];
  teamId: string;
}

export function TransactionsList({ purchases, teamId }: TransactionsListProps) {
  const user = useSessionStore((state) => state.user);
  const { data: dbStudents } = useTrainerStudents(user?.uid);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);

  // Manual payment form state
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualClasses, setManualClasses] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = purchases.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const studentName =
        dbStudents?.find((s) => s.uid === p.studentId)?.displayName ?? "";
      const q = search.toLowerCase();
      if (
        !studentName.toLowerCase().includes(q) &&
        !p.productName.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  async function handleReview(purchase: ClassPurchase, status: "paid" | "rejected") {
    if (!db) return;
    try {
      await updateDoc(doc(db, "classPurchases", purchase.id), {
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || "",
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });

      if (status === "paid") {
        const trainerId = purchase.trainerId || teamId;
        if (purchase.studentId && trainerId && purchase.classesCount > 0) {
          try {
            await creditEnrollmentClasses(db, purchase.studentId, trainerId, purchase.classesCount);
          } catch (e) {
            console.error("Falha ao creditar aulas:", e);
          }
        }
        if (purchase.productId) {
          try {
            await updateDoc(doc(db, "classProducts", purchase.productId), {
              soldQuantity: increment(1),
            });
            queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
          } catch (e) {
            console.error("Falha ao atualizar estoque:", e);
          }
        }
      }

      setMessage(status === "paid" ? `Pagamento confirmado! ${purchase.classesCount} aula(s) creditada(s).` : "Pagamento recusado.");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: unknown) {
      const err = e as Error;
      setError("Erro: " + err.message);
      setTimeout(() => setError(""), 3000);
    }
  }

  async function handleManualPayment() {
    if (!db || !manualStudentId || !manualAmount) return;
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(manualAmount) * 100);
      const classesCount = parseInt(manualClasses) || 0;

      await addDoc(collection(db, "classPurchases"), {
        studentId: manualStudentId,
        trainerId: user?.uid || "",
        teamId,
        productId: "",
        productName: manualNote || "Pagamento manual",
        classesCount,
        amountCents,
        status: "paid" as PurchaseStatus,
        submittedAt: new Date().toISOString(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || "",
      });

      if (classesCount > 0 && user?.uid) {
        await creditEnrollmentClasses(db, manualStudentId, user.uid, classesCount);
      }

      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      setMessage(`Pagamento manual de R$ ${manualAmount} registrado com sucesso!`);
      setShowManualForm(false);
      setManualStudentId("");
      setManualAmount("");
      setManualClasses("");
      setManualNote("");
      setTimeout(() => setMessage(""), 3000);
    } catch (e: unknown) {
      const err = e as Error;
      setError("Erro: " + err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn(cardClasses, "p-5")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-lg font-black text-stone-950">Transações</h2>
        <button
          type="button"
          onClick={() => setShowManualForm(!showManualForm)}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
        >
          <Plus size={14} /> Pagamento manual
        </button>
      </div>

      {/* Manual Payment Form */}
      {showManualForm && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-bold text-stone-800 mb-3">Registrar pagamento manual</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-stone-500 mb-1 block">Aluno</label>
              <select
                value={manualStudentId}
                onChange={(e) => setManualStudentId(e.target.value)}
                className="focus-ring h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
              >
                <option value="">Selecionar aluno...</option>
                {(dbStudents ?? []).map((s) => (
                  <option key={s.uid} value={s.uid}>{s.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-500 mb-1 block">Valor (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="0,00"
                className="focus-ring h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-500 mb-1 block">Aulas a creditar</label>
              <input
                type="number"
                min="0"
                value={manualClasses}
                onChange={(e) => setManualClasses(e.target.value)}
                placeholder="0"
                className="focus-ring h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-500 mb-1 block">Observação</label>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Ex: Pix, Dinheiro..."
                className="focus-ring h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="focus-ring h-9 rounded-lg border border-stone-200 bg-white px-4 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleManualPayment}
              disabled={saving || !manualStudentId || !manualAmount}
              className="focus-ring h-9 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Salvando..." : "Registrar pagamento"}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por aluno ou produto..."
            className="focus-ring h-9 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-stone-400" />
          {(["all", "awaiting_payment", "payment_submitted", "paid", "rejected"] as FilterStatus[]).map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-2xs font-bold border transition-colors",
                  filter === s
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50"
                )}
              >
                {s === "all" ? "Todos" : STATUS_LABELS[s]}
              </button>
            )
          )}
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm font-semibold text-emerald-800 animate-in fade-in">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-semibold text-rose-800 animate-in fade-in">
          {error}
        </div>
      )}

      {/* Transaction List */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-stone-400">Nenhuma transação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filtered.map((purchase) => {
            const studentName =
              dbStudents?.find((s) => s.uid === purchase.studentId)?.displayName ?? "Aluno";
            const isPending =
              purchase.status === "awaiting_payment" || purchase.status === "payment_submitted";

            return (
              <article
                key={purchase.id}
                className="flex flex-col gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-stone-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-stone-900 truncate">{studentName}</p>
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-0.5 text-2xs font-bold",
                        STATUS_COLORS[purchase.status]
                      )}
                    >
                      {STATUS_LABELS[purchase.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {purchase.productName} • {purchase.classesCount} aula{purchase.classesCount > 1 ? "s" : ""} •{" "}
                    <span className="font-bold text-stone-700">{moneyFromCents(purchase.amountCents)}</span>
                  </p>
                  {purchase.submittedAt && (
                    <p className="mt-0.5 text-2xs text-stone-400">
                      {new Date(purchase.submittedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>

                {isPending && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReview(purchase, "paid")}
                      className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
                    >
                      <CheckCircle2 size={13} /> Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(purchase, "rejected")}
                      className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      <XCircle size={13} /> Recusar
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
