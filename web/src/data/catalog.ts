import type { TrainingModality, TrainerAvailabilityDay } from "../types/domain";

/**
 * Catálogos fixos do produto (não são dados de exemplo).
 * Usados em formulários de seleção e como valores padrão.
 */

/** Modalidades de treino oferecidas na plataforma. */
export const trainingModalities: TrainingModality[] = [
  "Musculação",
  "Funcional",
  "Cross Fit",
  "Jiu Jitsu",
  "Muay Thai",
  "Boxe",
  "Pilates",
  "Ioga",
  "HIIT",
];

const WEEKDAYS: TrainerAvailabilityDay["weekday"][] = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

/**
 * Grade horária padrão para um treinador recém-cadastrado.
 * Dias úteis ativos; fins de semana desativados. Serve apenas como
 * ponto de partida editável — não representa nenhum treinador real.
 */
export const DEFAULT_AVAILABILITY: TrainerAvailabilityDay[] = WEEKDAYS.map((weekday) => ({
  weekday,
  active: weekday !== "sabado" && weekday !== "domingo",
  morningStartTime: "06:00",
  morningEndTime: "12:00",
  afternoonStartTime: "14:00",
  afternoonEndTime: "20:00",
  classDurationMinutes: 50,
  travelMinutes: 10,
}));
