import { Building2, Palette, UserRoundCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { trainingModalities } from "../data/catalog";

export function TrainerSignupPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Treinador / time
          </p>
          <h1 className="mt-3 text-3xl font-black">Cadastrar ambiente</h1>
          <p className="mt-3 leading-7 text-stone-600">
            Este fluxo cria o usuario owner, o Team, o membro trainer aceito e as claims
            `role=trainer` e `teamId`.
          </p>
          <div className="mt-5 space-y-3">
            <Step icon={UserRoundCheck} title="Conta do owner" body="Nome, e-mail, telefone e senha." />
            <Step icon={Building2} title="Dados do time" body="Nome publico, slug, modo solo ou equipe." />
            <Step icon={Palette} title="Branding" body="Cor primaria, bio e mensagem de boas-vindas." />
          </div>
        </div>

        <form className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Novo treinador ou time</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nome do treinador" placeholder="Ana Beatriz" />
            <Field label="E-mail" placeholder="ana@email.com" type="email" />
            <Field label="Telefone" placeholder="+55 85 99999-9999" />
            <Field label="Senha" placeholder="Minimo 8 caracteres" type="password" />
            <Field label="Nome do time" placeholder="Movimento Forte" />
            <Field label="Slug publico" placeholder="movimento-forte" />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Tipo de ambiente</span>
              <select className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3">
                <option>Treinador</option>
                <option>Treinador solo</option>
                <option>Equipe com orientadores</option>
              </select>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-semibold text-stone-700">Modalidades iniciais</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {trainingModalities.map((modality) => (
                  <label
                    key={modality}
                    className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-bold"
                  >
                    <input type="checkbox" />
                    {modality}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Cor primaria" placeholder="#0f766e" type="color" />
            <Field label="Mensagem de boas-vindas" placeholder="Vamos treinar com consistencia." />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Bio publica</span>
              <textarea
                className="focus-ring mt-2 min-h-28 w-full rounded-md border border-stone-300 px-3 py-2"
                placeholder="Conte como funciona o acompanhamento..."
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Criar ambiente
            </button>
            <Link
              to="/login"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-bold text-stone-800 hover:bg-stone-100"
            >
              Ja tenho conta
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof UserRoundCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <Icon aria-hidden="true" className="mt-1 text-emerald-800" size={20} />
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm leading-6 text-stone-600">{body}</p>
      </div>
    </div>
  );
}
