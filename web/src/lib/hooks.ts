/**
 * Firestore data hooks — return empty data when Firebase is not
 * configured, and stream live updates via onSnapshot otherwise.
 *
 * Each hook returns { data, loading, error }.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "./firebase";
import { useActiveTrainer } from "./activeTrainer";

/** Generic real-time collection hook */
function useCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  fallback: T[] = [],
  deps: unknown[] = [],
): { data: T[]; loading: boolean; error: string | null } {
  const queryClient = useQueryClient();
  const queryKey = ["collection", collectionPath, ...deps];

  useEffect(() => {
    if (!db) return;

    const ref = query(collection(db, collectionPath), ...constraints);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
        queryClient.setQueryData(queryKey, docs);
      },
      (err) => {
        console.error(`[useCollection] ${collectionPath}:`, err);
      },
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, ...deps, queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!db) return fallback;
      const ref = query(collection(db, collectionPath), ...constraints);
      const snapshot = await getDocs(ref);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    },
    staleTime: Infinity, // handled by onSnapshot
  });

  return {
    data: data ?? fallback,
    loading: isLoading && !!db,
    error: error instanceof Error ? error.message : null,
  };
}

/** Generic real-time document hook */
function useDocument<T>(
  collectionPath: string,
  docId: string | null | undefined,
  fallback: T | null = null,
): { data: T | null; loading: boolean; error: string | null } {
  const queryClient = useQueryClient();
  const queryKey = ["document", collectionPath, docId];

  useEffect(() => {
    if (!docId || !db) return;

    const ref = doc(db, collectionPath, docId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const docData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
        queryClient.setQueryData(queryKey, docData);
      },
      (err) => {
        console.error(`[useDocument] ${collectionPath}/${docId}:`, err);
      },
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, docId, queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!db || !docId) return fallback;
      const ref = doc(db, collectionPath, docId);
      const snapshot = await getDoc(ref);
      return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
    },
    enabled: !!docId && !!db,
    staleTime: Infinity, // handled by onSnapshot
  });

  return {
    data: data !== undefined ? data : fallback,
    loading: isLoading && !!docId && !!db,
    error: error instanceof Error ? error.message : null,
  };
}

export { useCollection, useDocument };

// ── Domain-specific hooks ────────────────────────────────

import type {
  Booking,
  ClassProduct,
  ClassPurchase,
  Enrollment,
  PartnerRate,
  Student,
  StudentMeasurement,
  StudentMeasurementSubmission,
  Team,
  TeamMember,
  TrainerChat,
  WorkoutSession,
} from "../types/domain";

/** Team document by teamId */
export function useTeam(teamId: string | null | undefined) {
  return useDocument<Team>("teams", teamId, null);
}

/** Vínculos (treinadores) de um aluno */
export function useStudentEnrollments(studentId: string | null | undefined) {
  return useCollection<Enrollment>(
    "enrollments",
    studentId ? [where("studentId", "==", studentId)] : [],
    [],
    [studentId],
  );
}

/**
 * Garante que sempre haja um treinador ativo selecionado para o aluno:
 * se nenhum estiver ativo (ou o ativo deixou de existir/ficou inativo),
 * seleciona o primeiro vínculo ativo. Use uma vez por sessão do aluno.
 */
export function useEnsureActiveTrainer(studentId: string | null | undefined) {
  const { data: enrollments } = useStudentEnrollments(studentId);
  const activeTrainerId = useActiveTrainer((s) => s.activeTrainerId);
  const setActiveTrainer = useActiveTrainer((s) => s.setActiveTrainer);

  useEffect(() => {
    const actives = enrollments.filter((e) => e.status === "active");
    if (actives.length === 0) return;
    const stillValid = activeTrainerId && actives.some((e) => e.trainerId === activeTrainerId);
    if (!stillValid) setActiveTrainer(actives[0].trainerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments.map((e) => `${e.trainerId}:${e.status}`).join(","), activeTrainerId]);
}

/** Vínculos (alunos) de um treinador(es) */
export function useTrainerEnrollments(trainerIds: string | string[] | null | undefined) {
  const ids = Array.isArray(trainerIds) ? trainerIds : trainerIds ? [trainerIds] : [];
  return useCollection<Enrollment>(
    "enrollments",
    ids.length > 0 ? [where("trainerId", "in", ids.slice(0, 10))] : [],
    [],
    [ids.join(",")],
  );
}

/**
 * Alunos de um treinador(es), derivados dos vínculos (enrollments) + o documento
 * completo de cada aluno. Retorna objetos no formato Student com o vínculo
 * anexado. Exclui vínculos cancelados.
 */
export function useTrainerStudents(trainerIds: string | string[] | null | undefined) {
  const { data: enrollments, loading } = useTrainerEnrollments(trainerIds);
  const relevant = enrollments.filter((e) => e.status !== "cancelled");
  const idsKey = relevant
    .map((e) => e.studentId)
    .sort()
    .join(",");

  const [studentDocs, setStudentDocs] = useState<Record<string, Student>>({});

  // Sync state cleanly if idsKey becomes empty.
  const [prevIdsKey, setPrevIdsKey] = useState(idsKey);
  if (idsKey !== prevIdsKey) {
    setPrevIdsKey(idsKey);
    if (!idsKey && Object.keys(studentDocs).length > 0) {
      setStudentDocs({});
    }
  }

  useEffect(() => {
    if (!db || !idsKey) return;
    const ids = idsKey.split(",");
    const unsubs = ids.map((id) =>
      onSnapshot(doc(db!, "students", id), (snap) => {
        setStudentDocs((prev) => ({
          ...prev,
          [id]: snap.exists()
            ? ({ uid: id, ...snap.data() } as Student)
            : ({ uid: id } as Student),
        }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [idsKey]);

  const data: (Student & { enrollment: Enrollment })[] = relevant.map((e) => {
    const base =
      studentDocs[e.studentId] ??
      ({
        uid: e.studentId,
        displayName: e.studentName,
        status: "pending",
        assignedTo: e.trainerId,
        onboarding: {},
        physiological: {},
      } as Student);
    return {
      ...base,
      uid: e.studentId,
      displayName: base.displayName || e.studentName,
      enrollment: e,
    };
  });

  return { data, loading };
}

/** All students assigned to a trainer */
export function useStudents(trainerId: string | null | undefined) {
  return useCollection<Student>(
    "students",
    trainerId ? [where("assignedTo", "==", trainerId)] : [],
    [],
    [trainerId]
  );
}

/** Single student document */
export function useStudent(studentId: string | null | undefined) {
  return useDocument<Student>("students", studentId, null);
}

/** Measurements for a specific student */
export function useMeasurements(studentId: string | null | undefined) {
  return useCollection<StudentMeasurement>(
    `students/${studentId}/measurements`,
    [orderBy("measuredAt", "asc")],
    [],
    [studentId]
  );
}

/** Pending measurements (submissions awaiting approval) for a student */
export function usePendingMeasurements(studentId: string | null | undefined) {
  return useCollection<StudentMeasurementSubmission>(
    `students/${studentId}/measurementSubmissions`,
    [where("status", "==", "pending")],
    [],
    [studentId]
  );
}

/** All measurements submissions for trainer (all students) */
export function useAllPendingMeasurements(teamId: string | null | undefined) {
  return useCollection<StudentMeasurementSubmission>(
    "measurementSubmissions",
    teamId ? [where("teamId", "==", teamId), where("status", "==", "pending")] : [],
    [],
    [teamId]
  );
}

/** Workout sessions (for student or trainer) */
export function useWorkoutSessions(options: {
  studentId?: string;
  trainerId?: string;
}) {
  const constraints: QueryConstraint[] = [];
  if (options.trainerId) constraints.push(where("trainerId", "==", options.trainerId));
  if (options.studentId) constraints.push(where("studentId", "==", options.studentId));
  constraints.push(orderBy("startsAt", "asc"));

  return useCollection<WorkoutSession>("workoutSessions", constraints, [], [options.studentId, options.trainerId]);
}


/** Bookings for a student or trainer */
export function useBookings(options: {
  studentId?: string;
  trainerId?: string;
}) {
  const constraints: QueryConstraint[] = [];
  if (options.trainerId) constraints.push(where("trainerId", "==", options.trainerId));
  if (options.studentId) constraints.push(where("studentId", "==", options.studentId));
  constraints.push(orderBy("startsAt", "asc"));

  return useCollection<Booking>("bookings", constraints, [], [options.studentId, options.trainerId]);
}

/** Class products (packages/singles) for a team */
export function useClassProducts(teamId: string | null | undefined) {
  return useCollection<ClassProduct>(
    "classProducts",
    teamId ? [where("teamId", "==", teamId), where("active", "==", true)] : [],
    [],
    [teamId]
  );
}

/** Purchases for a student */
export function useStudentPurchases(studentId: string | null | undefined) {
  return useCollection<ClassPurchase>(
    "classPurchases",
    studentId ? [where("studentId", "==", studentId), orderBy("submittedAt", "desc")] : [],
    [],
    [studentId]
  );
}

/** Pending purchases for trainer review (team scope) */
export function usePendingPurchases(teamId: string | null | undefined) {
  return useCollection<ClassPurchase>(
    "classPurchases",
    teamId
      ? [where("teamId", "==", teamId), where("status", "in", ["payment_submitted", "awaiting_payment"])]
      : [],
    [],
    [teamId]
  );
}

/** Compras já pagas de um time (para calcular faturamento real). */
export function usePaidPurchases(teamId: string | null | undefined) {
  return useCollection<ClassPurchase>(
    "classPurchases",
    teamId ? [where("teamId", "==", teamId), where("status", "==", "paid")] : [],
    [],
    [teamId]
  );
}

/** Sub-treinadores ativos de um time (pelo UID do dono) */
export function useTeamMembers(ownerUid: string | null | undefined) {
  return useCollection<TeamMember>(
    "teamMembers",
    ownerUid ? [where("ownerUid", "==", ownerUid), where("status", "==", "active")] : [],
    [],
    [ownerUid]
  );
}

/** Taxas por sessão definidas pelo treinador dono para seus parceiros */
export function usePartnerRates(ownerId: string | null | undefined) {
  return useCollection<PartnerRate>(
    "partnerRates",
    ownerId ? [where("ownerId", "==", ownerId)] : [],
    [],
    [ownerId]
  );
}

/** Times em que o usuário é treinador parceiro ativo */
export function useActivePartnerTeams(subTrainerId: string | null | undefined) {
  return useCollection<TeamMember>(
    "teamMembers",
    subTrainerId ? [where("subTrainerId", "==", subTrainerId), where("status", "==", "active")] : [],
    [],
    [subTrainerId]
  );
}

/** Convites de time pendentes recebidos por um sub-treinador */
export function usePendingTeamInvites(subTrainerId: string | null | undefined) {
  return useCollection<TeamMember>(
    "teamMembers",
    subTrainerId ? [where("subTrainerId", "==", subTrainerId), where("status", "==", "pending")] : [],
    [],
    [subTrainerId]
  );
}

/** Aulas delegadas a um sub-treinador (assignedToId) */
export function useAssignedSessions(subTrainerId: string | null | undefined) {
  return useCollection<WorkoutSession>(
    "workoutSessions",
    subTrainerId ? [where("assignedToId", "==", subTrainerId), orderBy("startsAt", "asc")] : [],
    [],
    [subTrainerId]
  );
}

export function useTrainerChats(userId: string | null | undefined, asTargetOnly = false) {
  // If asTargetOnly is true, we only fetch chats where the current user is the target (to show requests)
  // For standard chat list, we need both (where requester = me, or target = me).
  // Because Firestore limits OR queries without composite indexes perfectly matching, 
  // we do two separate useCollections and merge them in the component.
  const { data: requestedChats } = useCollection<TrainerChat>(
    "trainerChats",
    userId && !asTargetOnly ? [where("requesterId", "==", userId)] : [],
    [],
    [userId, asTargetOnly]
  );
  
  const { data: targetChats } = useCollection<TrainerChat>(
    "trainerChats",
    userId ? [where("targetId", "==", userId)] : [],
    [],
    [userId]
  );

  return { requestedChats, targetChats };
}
