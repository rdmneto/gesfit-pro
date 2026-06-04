import { useMemo } from "react";
import { ArrowRight, CalendarDays, Check, LockKeyhole, ShieldCheck, Tag } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { sampleClassProducts, samplePublicSchedule, sampleTeams } from "../data/sample";
import { moneyFromCents } from "../lib/format";
import { useSessionStore } from "../store/session";
import { useCollection, useClassProducts } from "../lib/hooks";
import { where } from "firebase/firestore";
import type { Team } from "../types/domain";

export function TeamLandingPage() {
  const { slug } = useParams();
  const isDemo = useSessionStore((state) => state.isDemo);

  // Busca o time pelo slug no Firestore
  const { data: dbTeams, loading: teamsLoading } = useCollection<Team>(
    "teams",
    slug ? [where("slug", "==", slug), where("publicListing", "==", true)] : [],
    [],
    [slug]
  );

  const team = useMemo(() => {
    const realTeam = dbTeams && dbTeams.length > 0 ? dbTeams[0] : null;
    return realTeam || sampleTeams.find((candidate) => candidate.slug === slug) || null;
  }, [dbTeams, slug]);

  const teamId = team?.id;

  // Busca os planos e pacotes do time
  const { data: dbProducts, loading: productsLoading } = useClassProducts(!isDemo && teamId ? teamId : null);

  const products = useMemo(() => {
    if (isDemo) {
      return sampleClassProducts.filter(
        (product) => product.teamId === teamId && product.active && product.publicVisible
      );
    }
    return (dbProducts || []).filter((p) => p.active && p.publicVisible);
  }, [isDemo, teamId, dbProducts]);

  const publicSlots = useMemo(() => {
    if (isDemo) {
      return samplePublicSchedule.filter(
        (slot) => slot.teamId === teamId && slot.publicVisible
      );
    }
    return [];
  }, [isDemo, teamId]);

  if (teamsLoading || (productsLoading && !isDemo)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando vitrine...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return <Navigate to="/treinadores" replace />;
  }

  return (
    <div>
      <section
        className="relative min-h-[64vh] bg-stone-950 text-white"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(15, 18, 17, 0.88), rgba(15, 18, 17, 0.35)), url(${team.branding?.bannerPhotoURL || team.branding?.heroPhotoURL || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80"})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto flex min-h-[64vh] max-w-6xl flex-col justify-center px-4 py-16">
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
            {team.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-100">
            {team.branding?.welcomeMessage || "Treino sério e acompanhamento personalizado."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: team.branding?.primaryColor || "var(--color-primary)" }}
              to="/cadastro/aluno"
            >
              Cadastrar para contratar
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-stone-950 hover:bg-stone-100 transition-colors"
              to="/login"
            >
              Já sou aluno
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>Perfil do treinador</h2>
            {team.publicProfile?.showPhotos && team.branding?.trainerPhotoURL ? (
              <img
                className="mt-4 h-36 w-36 rounded-lg object-cover"
                src={team.branding.trainerPhotoURL}
                alt={`Foto de ${team.name}`}
              />
            ) : null}
            <p className="mt-2 text-stone-600 leading-relaxed text-sm">{team.branding?.bio || "Sem biografia cadastrada."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(team.trainingModalities || []).map((modality) => (
                <span
                  key={modality}
                  className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700"
                >
                  {modality}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-250 bg-emerald-50/50 p-4 text-emerald-950">
              <ShieldCheck aria-hidden="true" className="text-emerald-700 shrink-0 mt-0.5" size={20} />
              <p className="text-xs leading-5">
                Visitantes podem consultar as informações divulgadas. A contratação fica liberada após
                cadastro, aceite de contrato e consentimento LGPD.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {team.publicProfile?.showPrices && products.length > 0 ? (
              products.map((product) => (
                <article key={product.id} className="rounded-lg border border-stone-200 bg-white p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Tag aria-hidden="true" className="text-emerald-800" size={18} />
                      <h3 className="text-base font-bold text-stone-900">{product.name}</h3>
                    </div>
                    <p className="mt-2 text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>{moneyFromCents(product.priceCents)}</p>
                    <p className="text-xs text-stone-500">
                      {product.type === "single" ? "aula avulsa" : `${product.classesCount} aulas`}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-stone-600">{product.description}</p>
                    <ul className="mt-5 space-y-2.5 text-xs text-stone-600">
                      <li className="flex gap-2">
                        <Check aria-hidden="true" className="text-emerald-700 shrink-0" size={16} />
                        Crédito de {product.classesCount} aula{product.classesCount > 1 ? "s" : ""}
                      </li>
                      <li className="flex gap-2">
                        <LockKeyhole aria-hidden="true" className="text-emerald-750 shrink-0" size={16} />
                        Contratação após cadastro
                      </li>
                    </ul>
                  </div>
                  <Link
                    className="focus-ring mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 text-xs font-bold text-white hover:bg-emerald-700 w-full transition-colors"
                    to="/cadastro/aluno"
                  >
                    Quero contratar
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </article>
              ))
            ) : (
              <article className="rounded-lg border border-stone-200 bg-white p-5 sm:col-span-2">
                <h3 className="text-lg font-bold text-stone-900">Valores sob consulta</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Este treinador optou por não divulgar valores na vitrine pública.
                </p>
              </article>
            )}
          </div>
        </div>
      </section>

      {team.publicProfile?.showAgenda && publicSlots.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="text-emerald-800" size={22} />
              <h2 className="text-xl font-black text-stone-900" style={{ fontFamily: "var(--font-display)" }}>Agenda divulgada</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {publicSlots.map((slot) => (
                <article key={slot.id} className="rounded-md border border-stone-200 p-4">
                  <p className="text-xs font-semibold text-stone-500">{slot.trainerName}</p>
                  <p className="mt-1 text-lg font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
                    {slot.weekday} {slot.time}
                  </p>
                  <p className="mt-2 text-xs text-stone-600">
                    {slot.available}/{slot.capacity} vagas disponíveis
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
