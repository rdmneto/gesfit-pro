import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db, messaging } from "../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

export const onChatMessageCreated = onDocumentCreated("trainerChats/{chatId}/messages/{messageId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  // Assume chat message has: senderId, receiverId, text, senderName
  const receiverId = data.receiverId;
  const senderName = data.senderName || "Nova mensagem";
  const text = data.text || "Você recebeu uma mensagem.";

  if (!receiverId) return;

  try {
    // Get the receiver's user document to find FCM tokens
    const userDoc = await db.doc(`users/${receiverId}`).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const tokens = userData?.fcmTokens as string[] | undefined;

    if (!tokens || tokens.length === 0) return;

    const message = {
      notification: {
        title: `Mensagem de ${senderName}`,
        body: text.length > 50 ? text.substring(0, 47) + "..." : text,
      },
      data: {
        chatId: event.params.chatId,
        click_action: "FLUTTER_NOTIFICATION_CLICK", // Or whatever action your app handles
        url: "/app/chat", // You can capture this in the service worker
      },
      tokens: tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    
    // Cleanup invalid tokens
    const tokensToRemove: string[] = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const errCode = res.error?.code;
        if (
          errCode === "messaging/invalid-registration-token" ||
          errCode === "messaging/registration-token-not-registered"
        ) {
          const t = tokens as string[];
          if (t[idx]) tokensToRemove.push(t[idx]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      await db.doc(`users/${receiverId}`).update({
        fcmTokens: FieldValue.arrayRemove(...tokensToRemove)
      });
    }

  } catch (error) {
    console.error("Error sending push notification for chat:", error);
  }
});
