import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSessionStore } from "../../store/session";
import { usePendingPurchases, useTrainerStudents } from "../../lib/hooks";
import { creditEnrollmentClasses } from "../../lib/enrollments";
import { moneyFromCents } from "../../lib/format";
import type { ClassPurchase, PurchaseStatus } from "../../types/domain";
import { queryClient } from "../../main";

const statusLabel: Record<PurchaseStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  payment_submitted: "Comprovante enviado",
  paid: "Pagamento confirmado",
  rejected: "Pagamento recusado",
};

export function PendingPurchasesList({ teamId }: { teamId: string | null | undefined }) {
  const user = useSessionStore((state) => state.user);
  const { data: purchases = [], loading } = usePendingPurchases(teamId);
  const { data: dbStudents } = useTrainerStudents(teamId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleReviewPurchase(purchase: ClassPurchase, status: "paid" | "rejected") {
    if (!db) {
      setError("Banco de dados indisponível no momento.");
      return;
    }

    try {
      const ref = doc(db, "classPurchases", purchase.id);
      await updateDoc(ref, {
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || "",
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });

      if (status === "paid") {
        const trainerId = purchase.trainerId || teamId || "";
        if (purchase.studentId && trainerId && purchase.classesCount > 0) {
          try {
            await creditEnrollmentClasses(db, purchase.studentId, trainerId, purchase.classesCount);
          } catch (creditErr) {
            console.error("Falha ao creditar aulas no vínculo:", creditErr);
          }
        }
        if (purchase.productId) {
          try {
            await updateDoc(doc(db, "classProducts", purchase.productId), {
              soldQuantity: increment(1),
            });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
          } catch (stockErr) {
            console.error("Falha ao atualizar estoque da oferta:", stockErr);
          }
        }
      }

      setMessage(
        status === "paid"
          ? `Compra confirmada! ${purchase.classesCount} aula(s) creditada(s).`
          : "Compra recusada.",
      );
      setTimeout(() => setMessage(""), 3000);
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setError("Erro ao revisar compra: " + err.message);
      setTimeout(() => setError(""), 3000);
    }
  }

  if (loading) {
    return <p className="text-sm text-stone-400">Carregando compras...</p>;
  }

  if (purchases.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm font-semibold text-emerald-800 animate-slide-up">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm font-semibold text-rose-800 animate-slide-up">
          {error}
        </div>
      )}

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {purchases.map((purchase) => {
          const studentName = dbStudents?.find((s) => s.uid === purchase.studentId)?.displayName ?? "Aluno";
          return (
            <article
              key={purchase.id}
              className="grid gap-3 rounded-xl border border-amber-200 p-4 sm:grid-cols-[1fr_auto] bg-amber-50 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-bold text-stone-950 truncate">{purchase.productName}</p>
                <p className="mt-0.5 text-xs text-stone-600">
                  <span className="font-bold">{studentName}</span> • {purchase.classesCount} aula{purchase.classesCount > 1 ? "s" : ""} -{" "}
                  <span className="font-bold text-stone-900">{moneyFromCents(purchase.amountCents)}</span>
                </p>
              <p className="mt-1 text-xs text-stone-500 italic truncate">
                {purchase.proofFileName
                  ? `Doc: ${purchase.proofFileName}`
                  : "Sem comprovante anexado"}
              </p>
              <span className="mt-2 inline-flex rounded bg-amber-100 px-2 py-0.5 text-2xs font-bold text-amber-900 border border-amber-300">
                {statusLabel[purchase.status] || purchase.status}
              </span>
            </div>
            <div className="flex flex-row sm:flex-col gap-2 justify-end">
              <button
                type="button"
                className="focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
                onClick={() => handleReviewPurchase(purchase, "paid")}
              >
                <CheckCircle2 aria-hidden="true" size={13} />
                Confirmar
              </button>
              <button
                type="button"
                className="focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-stone-300 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors"
                onClick={() => handleReviewPurchase(purchase, "rejected")}
              >
                <XCircle aria-hidden="true" size={13} />
                Recusar
              </button>
            </div>
          </article>
        )})}
      </div>
    </div>
  );
}
