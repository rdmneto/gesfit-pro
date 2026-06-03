import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireTeam } from "../lib/assertions.js";

const cancelBookingSchema = z.object({
  teamId: z.string().min(3),
  bookingId: z.string().min(3),
});

export const cancelBooking = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = cancelBookingSchema.parse(request.data);
  requireTeam(auth, data.teamId);

  const bookingRef = db.doc(`teams/${data.teamId}/bookings/${data.bookingId}`);
  const teamRef = db.doc(`teams/${data.teamId}`);

  await db.runTransaction(async (transaction) => {
    const [bookingSnap, teamSnap] = await Promise.all([
      transaction.get(bookingRef),
      transaction.get(teamRef),
    ]);

    if (!bookingSnap.exists || !teamSnap.exists) {
      throw new HttpsError("not-found", "Agendamento nao encontrado.");
    }

    const booking = bookingSnap.data();
    if (!booking) {
      throw new HttpsError("not-found", "Agendamento nao encontrado.");
    }
    const settings = teamSnap.data()?.settings as { cancelWindowHours?: number };
    const cancelWindowHours = settings.cancelWindowHours ?? 2;
    const startsAt = booking.startsAt as Timestamp;
    const msUntilStart = startsAt.toMillis() - Date.now();

    if (booking.studentId !== auth.uid && auth.role !== "trainer" && booking.trainerId !== auth.uid) {
      throw new HttpsError("permission-denied", "Sem permissao para cancelar esta aula.");
    }

    if (auth.role === "student" && msUntilStart <= cancelWindowHours * 60 * 60 * 1000) {
      throw new HttpsError("failed-precondition", "Janela de cancelamento encerrada.");
    }

    transaction.update(bookingRef, {
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
