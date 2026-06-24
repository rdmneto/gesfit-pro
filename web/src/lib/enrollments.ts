import { doc, getDoc, increment, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import type { EnrollmentStatus } from "../types/domain";
import { queryClient } from "../main";

/** Id determinístico do vínculo aluno↔treinador. */
export function enrollmentId(studentId: string, trainerId: string) {
  return `${studentId}__${trainerId}`;
}

interface RequestEnrollmentInput {
  studentId: string;
  studentName: string;
  trainerId: string;
  teamName?: string;
}

/**
 * Solicita um vínculo com um treinador. Cria como 'pending' (aguardando
 * aprovação). Se já existir e estiver cancelado, reabre como 'pending'.
 * Retorna o id do vínculo.
 */
export async function requestEnrollment(
  db: Firestore,
  { studentId, studentName, trainerId, teamName }: RequestEnrollmentInput,
): Promise<string> {
  const id = enrollmentId(studentId, trainerId);
  const ref = doc(db, "enrollments", id);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    if (existing.data().status === "cancelled") {
      await updateDoc(ref, { status: "pending" });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
    }
    return id;
  }

  await setDoc(ref, {
    id,
    studentId,
    studentName,
    trainerId,
    teamName: teamName ?? "",
    status: "pending",
    classesQuota: 0,
    classesUsed: 0,
    createdAt: new Date().toISOString(),
  });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
  return id;
}

/** Altera o status de um vínculo existente (aluno: pausar/cancelar/retomar). */
export async function setEnrollmentStatus(
  db: Firestore,
  id: string,
  status: EnrollmentStatus,
): Promise<void> {
  await updateDoc(doc(db, "enrollments", id), { status });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
}

/** Treinador aprova um vínculo pendente. */
export async function approveEnrollment(db: Firestore, id: string): Promise<void> {
  await updateDoc(doc(db, "enrollments", id), {
    status: "active",
    approvedAt: new Date().toISOString(),
  });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
}

/** Credita aulas no saldo do vínculo (ex.: ao confirmar um pagamento). */
export async function creditEnrollmentClasses(
  db: Firestore,
  studentId: string,
  trainerId: string,
  count: number,
): Promise<void> {
  await updateDoc(doc(db, "enrollments", enrollmentId(studentId, trainerId)), {
    classesQuota: increment(count),
  });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
}
