import { useMemo } from "react";
import { usePaidPurchases, usePendingPurchases, useAllPurchases } from "../../lib/hooks";

export function useFinanceMetrics(teamId: string | null | undefined) {
  const { data: paidPurchases } = usePaidPurchases(teamId);
  const { data: pendingPurchases } = usePendingPurchases(teamId);
  const { data: allPurchases } = useAllPurchases(teamId);

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  /** Receita confirmada (pagas) no mês atual */
  const monthRevenue = useMemo(() => {
    return (paidPurchases ?? [])
      .filter((p) => String(p.reviewedAt || p.submittedAt || "").startsWith(ym))
      .reduce((sum, p) => sum + (p.amountCents || 0), 0);
  }, [paidPurchases, ym]);

  /** Total pago no mês - em reais */
  const monthRevenueBRL = monthRevenue / 100;

  /** Pagamentos pendentes (aguardando ou comprovante enviado) */
  const pendingTotal = useMemo(() => {
    return (pendingPurchases ?? []).reduce((sum, p) => sum + (p.amountCents || 0), 0);
  }, [pendingPurchases]);

  const pendingTotalBRL = pendingTotal / 100;
  const pendingCount = pendingPurchases?.length ?? 0;

  /** Compras rejeitadas no mês */
  const rejectedThisMonth = useMemo(() => {
    return (allPurchases ?? []).filter(
      (p) => p.status === "rejected" && String(p.reviewedAt || "").startsWith(ym)
    );
  }, [allPurchases, ym]);

  const rejectedCount = rejectedThisMonth.length;
  const rejectedTotalBRL =
    rejectedThisMonth.reduce((sum, p) => sum + (p.amountCents || 0), 0) / 100;

  /** Total de transações no mês */
  const monthTransactions = useMemo(() => {
    return (allPurchases ?? []).filter(
      (p) => String(p.submittedAt || p.reviewedAt || "").startsWith(ym)
    ).length;
  }, [allPurchases, ym]);

  return {
    monthRevenueBRL,
    pendingTotalBRL,
    pendingCount,
    rejectedCount,
    rejectedTotalBRL,
    monthTransactions,
    allPurchases: allPurchases ?? [],
    pendingPurchases: pendingPurchases ?? [],
  };
}
