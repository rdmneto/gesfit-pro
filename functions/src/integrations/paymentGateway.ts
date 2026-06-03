export type PaymentCustomer = {
  name: string;
  email: string;
  phone?: string;
};

export type SubscriptionRequest = {
  customer: PaymentCustomer;
  planName: string;
  priceCents: number;
  externalReference: string;
};

export type SubscriptionResult = {
  gatewaySubscriptionId: string;
  paymentUrl?: string;
};

export interface PaymentGateway {
  createSubscription(request: SubscriptionRequest): Promise<SubscriptionResult>;
  parseWebhook(rawBody: Buffer, headers: Record<string, string | undefined>): Promise<PaymentWebhookEvent>;
}

export type PaymentWebhookEvent = {
  eventType: "payment_confirmed" | "payment_overdue" | "payment_deleted" | "unknown";
  teamId: string;
  studentId: string;
  gatewaySubscriptionId: string;
  nextDueDate?: string;
};
