import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Exercise } from "../types/domain";

export interface WorkoutGenerationParams {
  durationMinutes: string;
  exercisesCount: string;
  focus: string;
  style: string;
}

export async function generateWorkout(params: WorkoutGenerationParams): Promise<Exercise[]> {
  if (!functions) throw new Error("Firebase não configurado.");

  const call = httpsCallable<WorkoutGenerationParams, Exercise[]>(functions, "generateWorkoutAI");

  try {
    const result = await call(params);
    return result.data;
  } catch (error: any) {
    console.error("Erro na geração por IA:", error);
    throw new Error(`Erro na IA: ${error?.message ?? "Erro desconhecido"}`);
  }
}
