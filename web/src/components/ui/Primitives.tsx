import type { ElementType, ReactNode } from "react";

export type BadgeVariant = "green" | "amber" | "red" | "stone" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ variant = "stone", children, icon, className = "" }: BadgeProps) {
  return (
    <span className={["badge", `badge-${variant}`, className].join(" ")}>
      {icon}
      {children}
    </span>
  );
}

/* ── MetricCard ─────────────────────────────────────────── */
interface MetricCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, label, value, sub, trend, className = "", onClick }: MetricCardProps) {
  const trendColor = trend === "up" ? "text-emerald-700" : trend === "down" ? "text-red-600" : "text-stone-500";

  return (
    <div
      className={["metric-card", onClick ? "cursor-pointer" : "", className].join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
          <Icon aria-hidden="true" className="text-emerald-700" size={20} />
        </div>
        {trend && (
          <span className={["text-xs font-bold", trendColor].join(" ")}>
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "–"}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-stone-500">{label}</p>
      <p className="mt-0.5 text-2xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
      {sub && <p className={["mt-1 text-xs font-semibold", trendColor].join(" ")}>{sub}</p>}
    </div>
  );
}

/* ── SectionHeader ──────────────────────────────────────── */
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl text-stone-950">{title}</h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── CardHeader ─────────────────────────────────────────── */
interface CardHeaderProps {
  icon: ElementType;
  title: string;
  action?: ReactNode;
}

export function CardHeader({ icon: Icon, title, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
          <Icon aria-hidden="true" className="text-emerald-700" size={16} />
        </div>
        <h2 className="text-lg text-stone-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────── */
interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={["flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50 py-12 px-6 text-center", className].join(" ")}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
        <Icon aria-hidden="true" className="text-stone-400" size={24} />
      </div>
      <div>
        <p className="font-bold text-stone-700">{title}</p>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── SkeletonCard ─────────────────────────────────────────── */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="skeleton h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={["skeleton h-3", i === lines - 1 ? "w-2/3" : "w-full"].join(" ")} />
      ))}
    </div>
  );
}

/* ── ProgressBar ─────────────────────────────────────────── */
interface ProgressBarProps {
  value: number;   // 0-100
  label?: string;
  showValue?: boolean;
  variant?: "default" | "warning" | "danger";
}

export function ProgressBar({ value, label, showValue = false, variant = "default" }: ProgressBarProps) {
  const fillClass = variant === "danger"
    ? "progress-bar-fill progress-bar-fill-danger"
    : variant === "warning"
    ? "progress-bar-fill progress-bar-fill-warning"
    : "progress-bar-fill";

  return (
    <div>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && <span className="text-xs font-semibold text-stone-600">{label}</span>}
          {showValue && <span className="text-xs font-bold text-stone-700">{Math.round(value)}%</span>}
        </div>
      )}
      <div className="progress-bar">
        <div className={fillClass} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

/* ── Table helpers ───────────────────────────────────────── */
export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-stone-200 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-stone-500">
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <td className={["border-b border-stone-100 px-3 py-3.5 align-top text-sm", className].join(" ")}>
      {children}
    </td>
  );
}
