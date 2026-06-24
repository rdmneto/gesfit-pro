import { useState } from "react";
import {
  DollarSign,
  Clock,
  TrendingDown,
  ArrowUpRight,
  Receipt,
  Package,
  Users,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { cardClasses } from "../../components/ui/Primitives";
import { useFinanceMetrics } from "./useFinanceMetrics";
import { TransactionsList } from "./TransactionsList";
import { PackagesPage } from "../../pages/PackagesPage";
import { PartnerFinancialPanel } from "../team/PartnerFinancialPanel";
import { useTrainerStudents } from "../../lib/hooks";
import { useSessionStore } from "../../store/session";

type FinanceTab = "resumo" | "transacoes" | "pacotes" | "parceiros";

interface FinancialDashboardProps {
  teamId: string;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function FinancialDashboard({ teamId }: FinancialDashboardProps) {
  const user = useSessionStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<FinanceTab>("resumo");
  const {
    monthRevenueBRL,
    pendingTotalBRL,
    pendingCount,
    rejectedCount,
    rejectedTotalBRL,
    allPurchases,
  } = useFinanceMetrics(teamId);

  const { data: dbStudents } = useTrainerStudents(user?.uid);
  const activeStudents = (dbStudents ?? []).filter(
    (s) => s.enrollment?.status === "active"
  );
  const remainingCredits = activeStudents.reduce((sum, s) => {
    const quota = s.enrollment?.classesQuota ?? 0;
    const used = s.enrollment?.classesUsed ?? 0;
    return sum + (quota - used);
  }, 0);

  const tabs: { id: FinanceTab; label: string; icon: typeof DollarSign }[] = [
    { id: "resumo", label: "Resumo", icon: TrendingDown },
    { id: "transacoes", label: "Transações", icon: Receipt },
    { id: "pacotes", label: "Planos e Pacotes", icon: Package },
    { id: "parceiros", label: "Parceiros", icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <DollarSign className="text-emerald-700" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-black text-stone-950 tracking-tight">
            Gestão Financeira
          </h2>
          <p className="text-sm text-stone-500">
            Acompanhe receitas, pagamentos e gerencie seus planos.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className={cn(cardClasses, "relative overflow-hidden")}>
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-emerald-100/50" />
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <DollarSign className="text-emerald-700" size={18} />
            </div>
            <p className="mt-3 text-xs font-bold text-stone-500">Receita do mês</p>
            <p className="mt-0.5 text-2xl font-black text-stone-950">
              {formatBRL(monthRevenueBRL)}
            </p>
            <p className="mt-1 text-2xs font-semibold text-emerald-700">
              Pagamentos confirmados
            </p>
          </div>
        </div>

        <div className={cn(cardClasses, "relative overflow-hidden")}>
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-amber-100/50" />
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <Clock className="text-amber-700" size={18} />
            </div>
            <p className="mt-3 text-xs font-bold text-stone-500">Pendentes</p>
            <p className="mt-0.5 text-2xl font-black text-stone-950">
              {formatBRL(pendingTotalBRL)}
            </p>
            <p className="mt-1 text-2xs font-semibold text-amber-700">
              {pendingCount} pagamento{pendingCount !== 1 ? "s" : ""} aguardando
            </p>
          </div>
        </div>

        <div className={cn(cardClasses, "relative overflow-hidden")}>
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-rose-100/50" />
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50">
              <TrendingDown className="text-rose-700" size={18} />
            </div>
            <p className="mt-3 text-xs font-bold text-stone-500">Recusados</p>
            <p className="mt-0.5 text-2xl font-black text-stone-950">
              {formatBRL(rejectedTotalBRL)}
            </p>
            <p className="mt-1 text-2xs font-semibold text-rose-700">
              {rejectedCount} transaç{rejectedCount !== 1 ? "ões" : "ão"} no mês
            </p>
          </div>
        </div>

        <div className={cn(cardClasses, "relative overflow-hidden")}>
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-indigo-100/50" />
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
              <ArrowUpRight className="text-indigo-700" size={18} />
            </div>
            <p className="mt-3 text-xs font-bold text-stone-500">Créditos ativos</p>
            <p className="mt-0.5 text-2xl font-black text-stone-950">
              {remainingCredits}
            </p>
            <p className="mt-1 text-2xs font-semibold text-indigo-700">
              {activeStudents.length} aluno{activeStudents.length !== 1 ? "s" : ""} ativo{activeStudents.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={cn(
              "focus-ring -mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-all",
              activeTab === id
                ? "border-emerald-700 text-emerald-950 font-black"
                : "border-transparent text-stone-500 hover:text-stone-800"
            )}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "resumo" && (
          <div className="space-y-4">
            {/* Quick summary of recent transactions */}
            <div className={cn(cardClasses, "p-5")}>
              <h3 className="text-base font-black text-stone-950 mb-3">
                Últimas transações
              </h3>
              {allPurchases.length === 0 ? (
                <p className="text-sm text-stone-400 py-8 text-center italic">
                  Nenhuma transação registrada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {allPurchases.slice(0, 5).map((purchase) => {
                    const studentName =
                      dbStudents?.find((s) => s.uid === purchase.studentId)
                        ?.displayName ?? "Aluno";
                    return (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between rounded-lg border border-stone-100 p-3 hover:bg-stone-50/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-stone-800 truncate">
                            {studentName}
                          </p>
                          <p className="text-2xs text-stone-400">
                            {purchase.productName}
                            {purchase.submittedAt && (
                              <> • {new Date(purchase.submittedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-sm font-black text-stone-900">
                            {formatBRL(purchase.amountCents / 100)}
                          </p>
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-1.5 py-0.5 text-3xs font-bold",
                              purchase.status === "paid"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : purchase.status === "rejected"
                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            )}
                          >
                            {purchase.status === "paid"
                              ? "Pago"
                              : purchase.status === "rejected"
                              ? "Recusado"
                              : "Pendente"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {allPurchases.length > 5 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("transacoes")}
                  className="mt-3 text-sm font-bold text-emerald-700 hover:text-emerald-600 transition-colors"
                >
                  Ver todas as transações →
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "transacoes" && (
          <TransactionsList purchases={allPurchases} teamId={teamId} />
        )}

        {activeTab === "pacotes" && (
          <div className="-mx-4">
            <PackagesPage />
          </div>
        )}

        {activeTab === "parceiros" && (
          <PartnerFinancialPanel trainerId={teamId} />
        )}
      </div>
    </div>
  );
}
