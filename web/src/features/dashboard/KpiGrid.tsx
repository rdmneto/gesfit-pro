import { cardClasses } from "../../components/ui/Primitives";
import { cn } from "../../lib/utils";
import { DollarSign, TrendingUp, UserPlus2 } from "lucide-react";

interface KpiGridProps {
  studentCount: number;
  estimatedRevenue: number;
  presenceRate: number;
  noShowCount: number;
  remainingCreditsCount: number;
}

export function KpiGrid({
  studentCount,
  estimatedRevenue,
  presenceRate,
  noShowCount,
  remainingCreditsCount,
}: KpiGridProps) {
  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className={cn(cardClasses, "metric-")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
          <DollarSign aria-hidden="true" className="text-emerald-700" size={20} />
        </div>
        <p className="mt-3 text-sm text-stone-500">Receita do mês</p>
        <p className="mt-0.5 text-2xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
          {estimatedRevenue.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
        <p className="mt-1 text-xs font-semibold text-emerald-750">Pagamentos confirmados</p>
      </div>

      <div className={cn(cardClasses, "metric-")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
          <TrendingUp aria-hidden="true" className="text-emerald-700" size={20} />
        </div>
        <p className="mt-3 text-sm text-stone-500">Taxa de presença</p>
        <p className="mt-0.5 text-2xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
          {presenceRate}%
        </p>
        <p className="mt-1 text-xs font-semibold text-stone-400">
          {noShowCount} falta{noShowCount === 1 ? "" : "s"} registrada{noShowCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className={cn(cardClasses, "metric-")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
          <UserPlus2 aria-hidden="true" className="text-indigo-600" size={20} />
        </div>
        <p className="mt-3 text-sm text-stone-500">Créditos de alunos</p>
        <p className="mt-0.5 text-2xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
          {remainingCreditsCount}
        </p>
        <p className="mt-1 text-xs font-semibold text-indigo-700">
          Total de aulas disponíveis
        </p>
      </div>

      <div className={cn(cardClasses, "metric-")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <UserPlus2 aria-hidden="true" className="text-blue-600" size={20} />
        </div>
        <p className="mt-3 text-sm text-stone-500">Alunos ativos</p>
        <p className="mt-0.5 text-2xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
          {studentCount}
        </p>
        <p className="mt-1 text-xs font-semibold text-stone-400">cadastros ativos vinculados</p>
      </div>
    </section>
  );
}
