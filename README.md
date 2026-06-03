# Gestão Treinador

Web app SaaS multi-tenant para personal trainers, orientadores e alunos. Esta entrega implementa a fundação compilável da Fase 1: frontend React/PWA, Firebase Functions em TypeScript, regras de segurança, índices, testes das regras e documentação de setup.

## Estrutura

- `web/`: React + Vite + TypeScript + Tailwind, mobile-first.
- `functions/`: Cloud Functions Node 20 + TypeScript.
- `firestore.rules`: isolamento por `teamId`, papéis por Custom Claims, cancelamento com janela de 2h no servidor e bloqueio de escrita de assinaturas pelo cliente.
- `storage.rules`: uploads de branding/perfil limitados por tenant, tipo e tamanho.
- `tests/`: testes de regras com o emulador.

## Setup local

1. Instale dependências:
   ```bash
   npm install
   npm install --workspace web
   npm install --workspace functions
   ```

2. Copie `.env.example` para `web/.env.local` e preencha as chaves públicas do Firebase:
   ```bash
   cp .env.example web/.env.local
   ```

3. Rode o frontend:
   ```bash
   npm run dev:web
   ```

4. Rode os emuladores:
   ```bash
   npm run emulators
   ```

## Testes e build

```bash
npm run build
npm run test:rules
```

Os testes de rules cobrem isolamento entre times, aluno tentando ler outro aluno, cancelamento dentro/fora da janela e escrita de pagamento pelo cliente.

## Deploy

O frontend gera build estático em `web/dist`, que pode ser publicado na Hostinger ou no Firebase Hosting.

```bash
npm run build --workspace web
```

Para Firebase Hosting e Functions:

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage,functions
```

Cloud Functions que chamam gateways de pagamento, e-mail, WhatsApp Cloud API ou outros serviços externos exigem Firebase no plano Blaze. Não coloque segredos no frontend; use variáveis de ambiente/Secrets nas Functions.

## Webhooks e integrações

Os adaptadores `PaymentGateway` e `MessagingProvider` já existem em `functions/src/integrations`. A implementação inicial do Asaas está isolada e marcada com `// TODO: confirmar na doc oficial` onde a documentação vigente precisa ser validada antes de ativar produção.

WhatsApp automático não é implementado nesta fase. A Fase 1 deve usar push/e-mail automáticos e links `wa.me` manuais iniciados pelo treinador. Automações reais de WhatsApp devem usar somente a API oficial da Meta.
