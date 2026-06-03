import { ArrowRight, CalendarDays, Check, LockKeyhole, ShieldCheck, Tag } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { sampleClassProducts, samplePublicSchedule, sampleTeams } from "../data/sample";
import { moneyFromCents } from "../lib/format";

export function TeamLandingPage() {
  const { slug } = useParams();
  const team = sampleTeams.find((candidate) => candidate.slug === slug);

  if (!team) {
    return <Navigate to="/treinadores" replace />;
  }

  const products = sampleClassProducts.filter(
    (product) => product.teamId === team.id && product.active && product.publicVisible,
  );
  const publicSlots = samplePublicSchedule.filter(
    (slot) => slot.teamId === team.id && slot.publicVisible,
  );

  return (
    <div>
      <section
        className="relative min-h-[64vh] bg-stone-950 text-white"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(15, 18, 17, 0.88), rgba(15, 18, 17, 0.35)), url(${team.branding.heroPhotoURL})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto flex min-h-[64vh] max-w-6xl flex-col justify-center px-4 py-16">
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            {team.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-100">
            {team.branding.welcomeMessage}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-bold text-white"
              style={{ backgroundColor: team.branding.primaryColor }}
              to="/cadastro/aluno"
            >
              Cadastrar para contratar
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-stone-950 hover:bg-stone-100"
              to="/login"
            >
              Ja sou aluno
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-black">Perfil do treinador</h2>
            {team.publicProfile.showPhotos && team.branding.trainerPhotoURL ? (
              <img
                className="mt-4 h-36 w-36 rounded-lg object-cover"
                src={team.branding.trainerPhotoURL}
                alt=""
              />
            ) : null}
            <p className="mt-2 text-stone-600">{team.branding.bio}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {team.trainingModalities.map((modality) => (
                <span
                  key={modality}
                  className="rounded-md bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700"
                >
                  {modality}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <ShieldCheck aria-hidden="true" size={22} />
              <p className="text-sm leading-6">
                Visitantes podem consultar as informacoes divulgadas. A contratacao fica liberada apos
                cadastro, aceite de contrato e consentimento LGPD.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {team.publicProfile.showPrices ? (
              products.map((product) => (
                <article key={product.id} className="rounded-lg border border-stone-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <Tag aria-hidden="true" className="text-emerald-800" size={20} />
                    <h3 className="text-lg font-bold">{product.name}</h3>
                  </div>
                  <p className="mt-2 text-3xl font-black">{moneyFromCents(product.priceCents)}</p>
                  <p className="text-sm text-stone-600">
                    {product.type === "single" ? "aula avulsa" : `${product.classesCount} aulas`}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{product.description}</p>
                  <ul className="mt-5 space-y-3 text-sm">
                    <li className="flex gap-2">
                      <Check aria-hidden="true" className="text-emerald-700" size={18} />
                      Credito de {product.classesCount} aula{product.classesCount > 1 ? "s" : ""}
                    </li>
                    <li className="flex gap-2">
                      <LockKeyhole aria-hidden="true" className="text-emerald-700" size={18} />
                      Contratacao apos cadastro
                    </li>
                  </ul>
                  <Link
                    className="focus-ring mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-700"
                    to="/cadastro/aluno"
                  >
                    Quero contratar
                    <ArrowRight aria-hidden="true" size={17} />
                  </Link>
                </article>
              ))
            ) : (
              <article className="rounded-lg border border-stone-200 bg-white p-5 sm:col-span-2">
                <h3 className="text-lg font-bold">Valores sob consulta</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Este treinador optou por nao divulgar valores na landing publica.
                </p>
              </article>
            )}
          </div>
        </div>
      </section>

      {team.publicProfile.showAgenda ? (
        <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="text-emerald-800" size={22} />
            <h2 className="text-xl font-black">Agenda divulgada</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicSlots.map((slot) => (
              <article key={slot.id} className="rounded-md border border-stone-200 p-4">
                <p className="text-sm font-semibold text-stone-600">{slot.trainerName}</p>
                <p className="mt-1 text-xl font-black">
                  {slot.weekday} {slot.time}
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  {slot.available}/{slot.capacity} vagas disponiveis
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}
