import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { adminAuth, db } from "../lib/firebase.js";
import { requireAuth, requireRole, requireTeam } from "../lib/assertions.js";

const createTeamSchema = z.object({
  teamId: z.string().min(3),
  name: z.string().min(2),
  slug: z.string().min(2),
  isSolo: z.boolean().default(true),
});

export const createTeam = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = createTeamSchema.parse(request.data);
  const teamRef = db.doc(`teams/${data.teamId}`);
  const snapshot = await teamRef.get();

  if (snapshot.exists) {
    throw new HttpsError("already-exists", "Team ja existe.");
  }

  await db.runTransaction(async (transaction) => {
    transaction.set(teamRef, {
      name: data.name,
      slug: data.slug,
      ownerUid: auth.uid,
      isSolo: data.isSolo,
      publicListing: true,
      branding: {
        primaryColor: "#0f766e",
        welcomeMessage: "Bem-vindo ao seu ambiente de treino.",
        bio: "",
      },
      settings: {
        cancelWindowHours: 2,
        reminderHoursBefore: 3,
        reminderAuto: true,
        reminderTemplate: "Ola {{nome}}, sua aula e as {{hora}} - foco: {{grupo}}",
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.doc(`teams/${data.teamId}/members/${auth.uid}`), {
      uid: auth.uid,
      role: "trainer",
      status: "accepted",
      acceptedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      db.doc(`users/${auth.uid}`),
      {
        uid: auth.uid,
        role: "trainer",
        teamId: data.teamId,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await adminAuth.setCustomUserClaims(auth.uid, {
    role: "trainer",
    teamId: data.teamId,
  });

  return { teamId: data.teamId };
});

const approveStudentSchema = z.object({
  teamId: z.string().min(3),
  studentId: z.string().min(3),
  assignedTo: z.string().min(3),
});

export const approveStudent = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = approveStudentSchema.parse(request.data);
  requireRole(auth, "trainer");
  requireTeam(auth, data.teamId);

  const studentRef = db.doc(`teams/${data.teamId}/students/${data.studentId}`);
  const student = await studentRef.get();

  if (!student.exists) {
    throw new HttpsError("not-found", "Aluno nao encontrado.");
  }

  await studentRef.update({
    status: "active",
    assignedTo: data.assignedTo,
    approvedAt: FieldValue.serverTimestamp(),
  });
  await adminAuth.setCustomUserClaims(data.studentId, {
    role: "student",
    teamId: data.teamId,
  });
  await db.doc(`users/${data.studentId}`).set(
    {
      uid: data.studentId,
      role: "student",
      teamId: data.teamId,
    },
    { merge: true },
  );

  return { ok: true };
});
