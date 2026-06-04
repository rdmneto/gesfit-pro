/**
 * Firestore data hooks — return empty data when Firebase is not
 * configured, and stream live updates via onSnapshot otherwise.
 *
 * Each hook returns { data, loading, error }.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";

/** Generic real-time collection hook */
function useCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  fallback: T[] = [],
  deps: any[] = [],
): { data: T[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      // No Firebase — use fallback immediately
      setData(fallback);
      setLoading(false);
      return;
    }

    const ref = query(collection(db, collectionPath), ...constraints);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[useCollection] ${collectionPath}:`, err);
        setError(err.message);
        setData(fallback); // graceful fallback
        setLoading(false);
      },
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, ...deps]);

  return { data, loading, error };
}

/** Generic real-time document hook */
function useDocument<T>(
  collectionPath: string,
  docId: string | null | undefined,
  fallback: T | null = null,
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      return;
    }
    if (!db) {
      setData(fallback);
      setLoading(false);
      return;
    }

    const ref = doc(db, collectionPath, docId);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`[useDocument] ${collectionPath}/${docId}:`, err);
        setError(err.message);
        setData(fallback);
        setLoading(false);
      },
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, docId]);

  return { data, loading, error };
}

export { useCollection, useDocument };

// ── Domain-specific hooks ────────────────────────────────

import type {
  Booking,
  ClassProduct,
  ClassPurchase,
  Student,
  StudentMeasurement,
  StudentMeasurementSubmission,
  Team,
  WorkoutSession,
} from "../types/domain";

/** Team document by teamId */
export function useTeam(teamId: string | null | undefined) {
  return useDocument<Team>("teams", teamId, null);
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
