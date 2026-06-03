import { logger } from "firebase-functions/v2";
export class AsaasGateway {
    apiKey;
    webhookSecret;
    constructor(apiKey, webhookSecret) {
        this.apiKey = apiKey;
        this.webhookSecret = webhookSecret;
    }
    async createSubscription(request) {
        logger.info("Preparing Asaas subscription", {
            externalReference: request.externalReference,
            planName: request.planName,
        });
        // TODO: confirmar na doc oficial do Asaas: payload, campos de recorrencia, tokenizacao e URL de retorno vigentes.
        if (!this.apiKey) {
            throw new Error("ASAAS_API_KEY ausente.");
        }
        return {
            gatewaySubscriptionId: `pending-${request.externalReference}`,
        };
    }
    async parseWebhook(rawBody, headers) {
        const receivedSecret = headers["x-asaas-webhook-token"];
        // TODO: confirmar na doc oficial do Asaas: nome do header/assinatura vigente do webhook.
        if (!this.webhookSecret || receivedSecret !== this.webhookSecret) {
            throw new Error("Webhook Asaas invalido.");
        }
        const body = JSON.parse(rawBody.toString("utf8"));
        const [teamId = "", studentId = ""] = body.payment?.externalReference?.split(":") ?? [];
        return {
            eventType: mapAsaasEvent(body.event),
            teamId,
            studentId,
            gatewaySubscriptionId: body.payment?.subscription ?? "",
            nextDueDate: body.payment?.dueDate,
        };
    }
}
function mapAsaasEvent(event) {
    switch (event) {
        case "PAYMENT_CONFIRMED":
            return "payment_confirmed";
        case "PAYMENT_OVERDUE":
            return "payment_overdue";
        case "PAYMENT_DELETED":
            return "payment_deleted";
        default:
            return "unknown";
    }
}
