import { CheckCircle2, HeartPulse, Ruler, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { where } from "firebase/firestore";
import { useCollection } from "../lib/hooks";
import type { Team } from "../types/domain";

export function StudentSignupPage() {
  const { data: teams } = useCollection<Team>(
    "teams",
    [where("publicListing", "==", true)],
    [],
    [],
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
            Aluno / paciente
          </p>
          <h1 className="mt-3 text-3xl font-black">Cadastro e anamnese inicial</h1>
          <p className="mt-3 leading-7 text-stone-600">
            O aluno escolhe o time, aceita contrato/LGPD e entra como `pending` ate aprovacao do
            treinador.
          </p>
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Peso, medidas e foto sao dados pessoais. O consentimento LGPD fica registrado no
            documento do aluno.
          </div>
        </div>

        <form className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Novo aluno</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Tipo de conta</span>
              <select className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3">
                <option>Aluno</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Treinador ou equipe</span>
              <select className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3">
                <option>Escolher depois</option>
                {teams.map((team) => (
                  <option key={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
            <Field label="Nome completo" placeholder="Seu nome completo" />
            <Field label="E-mail" placeholder="seu@email.com" type="email" />
            <Field label="Celular" placeholder="+55 00 00000-0000" />
            <Field label="Senha" placeholder="Minimo 8 caracteres" type="password" />
            <Field label="Data de nascimento" placeholder="" type="date" />
            <Field label="Genero" placeholder="Selecione" />
            <Field label="Altura (cm)" placeholder="Ex: 170" type="number" />
            <Field label="Peso inicial (kg)" placeholder="Ex: 70" type="number" />
            <Field label="Meta principal" placeholder="Ex: Ganho de massa" />
            <Field label="Prazo da meta" placeholder="" type="date" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Info icon={Users} text="Status inicial pending" />
            <Info icon={Ruler} text="IMC calculado" />
            <Info icon={HeartPulse} text="Medidas protegidas" />
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-md bg-stone-100 p-4 text-sm leading-6">
            <input className="mt-1" type="checkbox" />
            <span>Aceito o contrato de prestacao de servicos e autorizo o tratamento dos dados.</span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 aria-hidden="true" size={18} />
              Solicitar cadastro
            </button>
            <Link
              to="/treinadores"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-bold text-stone-800 hover:bg-stone-100"
            >
              Ver times
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

function Info({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="flex min-h-20 items-center gap-2 rounded-md bg-stone-100 p-3 text-sm font-semibold">
      <Icon aria-hidden="true" className="text-emerald-800" size={18} />
      {text}
    </div>
  );
}
