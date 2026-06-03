import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../lib/firebase.js";
import { CompositeMessagingProvider } from "../integrations/messagingProvider.js";
const messaging = new CompositeMessagingProvider();
export const sendClassReminders = onSchedule("every 60 minutes", async () => {
    const now = Date.now();
    const start = Timestamp.fromMillis(now + 2.5 * 60 * 60 * 1000);
    const end = Timestamp.fromMillis(now + 3.5 * 60 * 60 * 1000);
    const bookings = await db
        .collectionGroup("bookings")
        .where("status", "==", "scheduled")
        .where("startsAt", ">=", start)
        .where("startsAt", "<=", end)
        .get();
    await Promise.all(bookings.docs.map(async (bookingSnap) => {
        const booking = bookingSnap.data();
        if (booking.reminderSentAt) {
            return;
        }
        const teamRef = bookingSnap.ref.parent.parent;
        if (!teamRef) {
            return;
        }
        const teamSnap = await teamRef.get();
        const settings = teamSnap.data()?.settings;
        if (settings?.reminderAuto === false) {
            return;
        }
        await messaging.send({
            channel: "push",
            teamId: teamRef.id,
            toUid: booking.studentId,
            title: "Lembrete de aula",
            body: (settings?.reminderTemplate ?? "Sua aula esta chegando.")
                .replace("{{nome}}", "")
                .replace("{{hora}}", booking.startsAt.toDate().toLocaleTimeString("pt-BR"))
                .replace("{{grupo}}", booking.focus),
        });
        await bookingSnap.ref.update({ reminderSentAt: FieldValue.serverTimestamp() });
    }));
});
