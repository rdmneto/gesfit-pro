import type { WorkoutSession } from "../../types/domain";

export type CalendarView = "day" | "week" | "month";
export type CalendarMode = "visual" | "list";

export const trainerDaySlots = ["06:00", "08:00", "10:30", "17:00", "18:30"];

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatFriendlyDateTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const timeStr = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (isToday) {
    return `Hoje, ${timeStr}`;
  }
  const dateStr = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
  return `${dateStr} às ${timeStr}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${value}T12:00:00`));
}

export function isSameDay(value: string, date: Date): boolean {
  const parsed = new Date(value);
  return parsed.getDate() === date.getDate() && parsed.getMonth() === date.getMonth() && parsed.getFullYear() === date.getFullYear();
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

export function monthGridDays(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

export function workoutAtSlot(workouts: WorkoutSession[], slot: string): WorkoutSession | undefined {
  return workouts.find((w) => formatTime(w.startsAt) === slot);
}

export function getTrainerCalendarItems(workouts: WorkoutSession[], view: CalendarView): WorkoutSession[] {
  const today = new Date();
  if (view === "day") return workouts.filter((w) => isSameDay(w.startsAt, today));
  if (view === "week") {
    const start = startOfDay(today);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return workouts.filter((w) => { const d = new Date(w.startsAt); return d >= start && d < end; });
  }
  return workouts.filter((w) => { const d = new Date(w.startsAt); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); });
}

export function addDays(value: string, days: number): string {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function monthItems(workouts: WorkoutSession[]): WorkoutSession[] {
  if (!workouts[0] || !workouts[1]) return workouts;
  return [
    ...workouts,
    { ...workouts[0], id: "workout-month-4", title: "Avaliação de técnica", startsAt: addDays(workouts[0].startsAt, 9), modality: "Funcional" as const, durationMinutes: 40, plannedCalories: 260, exercises: ["Mobilidade", "Agachamento técnico", "Core"] },
    { ...workouts[1], id: "workout-month-5", title: "Resistência e cardio", startsAt: addDays(workouts[1].startsAt, 13), modality: "HIIT" as const, durationMinutes: 45, plannedCalories: 430, exercises: ["Bike", "Circuito", "Alongamento"] },
  ];
}
