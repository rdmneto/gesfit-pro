export type MessageChannel = "push" | "email" | "whatsapp";

export type OutboundMessage = {
  toUid: string;
  teamId: string;
  channel: MessageChannel;
  title: string;
  body: string;
  waMeUrl?: string;
};

export interface MessagingProvider {
  send(message: OutboundMessage): Promise<void>;
}

export class CompositeMessagingProvider implements MessagingProvider {
  async send(message: OutboundMessage): Promise<void> {
    if (message.channel === "whatsapp") {
      // Fase 1: WhatsApp automatico nao e enviado. O app deve gerar wa.me manual.
      return;
    }

    // TODO: conectar FCM e provedor de e-mail oficial/configurado.
    await Promise.resolve();
  }
}
