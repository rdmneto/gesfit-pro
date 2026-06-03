export class CompositeMessagingProvider {
    async send(message) {
        if (message.channel === "whatsapp") {
            // Fase 1: WhatsApp automatico nao e enviado. O app deve gerar wa.me manual.
            return;
        }
        // TODO: conectar FCM e provedor de e-mail oficial/configurado.
        await Promise.resolve();
    }
}
