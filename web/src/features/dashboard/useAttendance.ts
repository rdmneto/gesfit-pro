import { useState } from "react";
import { doc, updateDoc, writeBatch, increment, deleteDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { WorkoutSession } from "../../types/domain";

export function useAttendance() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Start a session (scheduled → in_progress)
  async function startSession(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), {
        status: "in_progress",
        startedAt: new Date().toISOString(),
      });
      setError("");
      setMessage("Aula iniciada! O cronômetro está rodando.");
      setTimeout(() => setMessage(""), 3000);
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setError("Erro ao iniciar aula: " + err.message);
    }
  }

  // Complete a session (in_progress → completed) and deduct credit
  async function completeSession(workout: WorkoutSession) {
    if (!db) return;
    try {
      const now = new Date();
      const startedAt = workout.startedAt ? new Date(workout.startedAt) : now;
      const actualDurationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));

      const enrollmentId = `${workout.studentId}__${workout.trainerId}`;

      const batch = writeBatch(db);
      batch.update(doc(db, "workoutSessions", workout.id), {
        status: "completed",
        completedAt: now.toISOString(),
        actualDurationMinutes,
      });
      batch.update(doc(db, "enrollments", enrollmentId), {
        classesUsed: increment(1),
      });
      await batch.commit();

      setError("");
      setMessage(`Aula concluída! Duração: ${actualDurationMinutes} min. Crédito debitado.`);
      setTimeout(() => setMessage(""), 4000);
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setError("Erro ao concluir aula: " + err.message);
    }
  }

  // Mark no-show (does NOT deduct credit)
  async function markNoShow(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), {
        status: "no_show",
      });
      setError("");
      setMessage("Falta registrada.");
      setTimeout(() => setMessage(""), 2500);
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setError("Erro ao registrar falta: " + err.message);
    }
  }

  // Undo status back to scheduled
  async function undoAttendance(workout: WorkoutSession) {
    if (!db) return;
    try {
      await updateDoc(doc(db, "workoutSessions", workout.id), {
        status: "scheduled",
        startedAt: null,
        completedAt: null,
        actualDurationMinutes: null,
      });
      setError("");
      setMessage("Marcação desfeita.");
      setTimeout(() => setMessage(""), 2500);
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setError("Erro ao desfazer: " + err.message);
    }
  }

  // Delete session
  async function deleteSession(workout: WorkoutSession) {
    if (!db) return;
    if (!window.confirm(`Excluir a aula de ${workout.studentName}?`)) return;
    try {
      await deleteDoc(doc(db, "workoutSessions", workout.id));
      setError("");
      setMessage("Aula excluída.");
      setTimeout(() => setMessage(""), 3000);
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setError("Erro ao excluir: " + err.message);
    }
  }

  return {
    error,
    message,
    startSession,
    completeSession,
    markNoShow,
    undoAttendance,
    deleteSession
  };
}
