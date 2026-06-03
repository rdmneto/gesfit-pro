import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { db } from "../lib/firebase.js";
import { AsaasGateway } from "../integrations/asaasGateway.js";

const asaasApiKey = defineSecret("ASAAS_API_KEY");
const asaasWebhookSecret = defineSecret("ASAAS_WEBHOOK_SECRET");

export const asaasWebhook = onRequest(
  { secrets: [asaasApiKey, asaasWebhookSecret] },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method not allowed");
      return;
    }

    try {
      const gateway = new AsaasGateway(asaasApiKey.value(), asaasWebhookSecret.value());
      const event = await gateway.parseWebhook(
        request.rawBody,
        normalizeHeaders(request.headers),
      );

      if (!event.teamId || !event.studentId || event.eventType === "unknown") {
        logger.warn("Webhook Asaas ignorado", event);
        response.status(202).send("Ignored");
        return;
      }

      const studentRef = db.doc(`teams/${event.teamId}/students/${event.studentId}`);
      const subscriptionRef = db.doc(`teams/${event.teamId}/subscriptions/${event.studentId}`);
      const active = event.eventType === "payment_confirmed";

      await db.runTransaction(async (transaction) => {
        transaction.set(
          subscriptionRef,
          {
            gateway: "asaas",
            gatewaySubscriptionId: event.gatewaySubscriptionId,
            status: active ? "active" : "overdue",
            lastPaymentStatus: event.eventType,
            nextDueDate: event.nextDueDate,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        transaction.update(studentRef, {
          status: active ? "active" : "blocked",
        });
      });

      response.status(200).send("OK");
    } catch (error) {
      logger.error("Falha no webhook Asaas", error);
      response.status(401).send("Invalid webhook");
    }
  },
);

function normalizeHeaders(headers: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}
