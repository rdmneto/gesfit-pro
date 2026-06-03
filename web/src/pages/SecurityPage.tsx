import { ShieldCheck } from "lucide-react";

const rules = [
  "Toda leitura sob teams/{teamId} valida request.auth.token.teamId.",
  "Student so cria booking para si e somente quando esta active.",
  "Assistant ve apenas alunos e bookings atribuidos a ele.",
  "subscriptions tem allow write: false para clientes.",
  "Cancelamento usa request.time + duration.value(cancelWindowHours, 'h').",
];

export function SecurityPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <ShieldCheck aria-hidden="true" className="text-emerald-800" size={30} />
        <h1 className="mt-4 text-3xl font-black">Regras de seguranca</h1>
        <p className="mt-2 text-stone-600">
          Esta tela resume os contratos implementados na Fase 1 para orientar QA e produto.
        </p>
        <ul className="mt-6 space-y-3">
          {rules.map((rule) => (
            <li key={rule} className="rounded-md bg-stone-100 p-4 text-sm font-medium">
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
