import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, messaging } from "../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
// Roda a cada 15 minutos
export const sendClassReminders = onSchedule("every 15 minutes", async (event) => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    try {
        // Buscar sessoes que começam na proxima 1 hora e ainda não tiveram lembrete enviado
        const sessionsSnapshot = await db
            .collection("workoutSessions")
            .where("startsAt", ">=", now)
            .where("startsAt", "<=", oneHourFromNow)
            .where("reminderSent", "==", false)
            .where("status", "==", "scheduled")
            .get();
        if (sessionsSnapshot.empty) {
            console.log("Nenhuma sessão para enviar lembrete.");
            return;
        }
        console.log(`Encontramos ${sessionsSnapshot.size} sessões para lembrar.`);
        const batch = db.batch();
        for (const doc of sessionsSnapshot.docs) {
            const session = doc.data();
            const studentId = session.studentId;
            const trainerId = session.trainerId;
            const startsAt = session.startsAt.toDate();
            const timeString = startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            // Preparar envio para aluno
            if (studentId) {
                const studentDoc = await db.doc(`users/${studentId}`).get();
                const studentTokens = studentDoc.data()?.fcmTokens;
                if (studentTokens && studentTokens.length > 0) {
                    const message = {
                        notification: {
                            title: "Lembrete de Aula",
                            body: `Sua aula de ${session.category || 'Treino'} começa às ${timeString}!`,
                        },
                        data: { url: "/app/agenda" },
                        tokens: studentTokens,
                    };
                    await messaging.sendEachForMulticast(message);
                }
            }
            // Preparar envio para treinador (opcional, pode ser bom)
            if (trainerId) {
                const trainerDoc = await db.doc(`users/${trainerId}`).get();
                const trainerTokens = trainerDoc.data()?.fcmTokens;
                if (trainerTokens && trainerTokens.length > 0) {
                    const message = {
                        notification: {
                            title: "Lembrete de Aula",
                            body: `Sua aula com o aluno começa às ${timeString}!`,
                        },
                        data: { url: "/app/agenda" },
                        tokens: trainerTokens,
                    };
                    await messaging.sendEachForMulticast(message);
                }
            }
            // Marcar como enviado
            batch.update(doc.ref, { reminderSent: true, updatedAt: FieldValue.serverTimestamp() });
        }
        await batch.commit();
        console.log("Lembretes enviados com sucesso.");
    }
    catch (error) {
        console.error("Erro ao processar lembretes de aula:", error);
    }
});
