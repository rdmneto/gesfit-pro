import * as React from "react";
import { cn } from "../../lib/utils";

export type BadgeVariant = "green" | "amber" | "red" | "stone" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "stone", children, icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
        {
          "bg-emerald-50 text-emerald-800": variant === "green",
          "bg-amber-50 text-amber-900": variant === "amber",
          "bg-red-50 text-red-700": variant === "red",
          "bg-[#f3f0eb] text-stone-600": variant === "stone",
          "bg-blue-50 text-blue-800": variant === "blue",
        },
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export const cardClasses = "rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md";

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(cardClasses, className)} {...props}>
      {children}
    </div>
  );
}

/* ── MetricCard ─────────────────────────────────────────── */
interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, label, value, sub, trend, className, onClick }: MetricCardProps) {
  const trendColor = trend === "up" ? "text-emerald-700" : trend === "down" ? "text-red-600" : "text-stone-500";

  return (
    <div
      className={cn(
        "rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
          <Icon aria-hidden="true" className="text-emerald-700" size={20} />
        </div>
        {trend && (
          <span className={cn("text-xs font-bold", trendColor)}>
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "–"}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-stone-500">{label}</p>
      <p className="mt-0.5 text-2xl font-black text-stone-950 font-display">{value}</p>
      {sub && <p className={cn("mt-1 text-xs font-semibold", trendColor)}>{sub}</p>}
    </div>
  );
}

/* ── SectionHeader ──────────────────────────────────────── */
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl font-black text-stone-950 font-display">{title}</h1>
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
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
}

export function CardHeader({ icon: Icon, title, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
          <Icon aria-hidden="true" className="text-emerald-700" size={16} />
        </div>
        <h2 className="text-lg font-black text-stone-950 font-display">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────── */
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50 py-12 px-6 text-center", className)}>
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
    <div className={cn(cardClasses, "p-5 space-y-3")}>
      <div className="h-4 w-1/3 rounded-md bg-gradient-to-r from-stone-200 via-stone-100 to-stone-200 bg-[length:400%_100%] animate-[shimmer_1.6s_infinite_linear]" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={cn("h-3 rounded-md bg-gradient-to-r from-stone-200 via-stone-100 to-stone-200 bg-[length:400%_100%] animate-[shimmer_1.6s_infinite_linear]", i === lines - 1 ? "w-2/3" : "w-full")} />
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
  return (
    <div>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && <span className="text-xs font-semibold text-stone-600">{label}</span>}
          {showValue && <span className="text-xs font-bold text-stone-700">{Math.round(value)}%</span>}
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            {
              "bg-gradient-to-r from-emerald-700 to-emerald-500": variant === "default",
              "bg-gradient-to-r from-amber-600 to-amber-500": variant === "warning",
              "bg-gradient-to-r from-red-600 to-red-500": variant === "danger",
            }
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

/* ── Table helpers ───────────────────────────────────────── */
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-stone-200 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-stone-500">
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-stone-100 px-3 py-3.5 align-top text-sm", className)}>
      {children}
    </td>
  );
}
