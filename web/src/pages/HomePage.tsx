import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Home,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trainingModalities } from "../data/sample";
import { GYM_ONLY } from "../data/gyms";
import { moneyFromCents } from "../lib/format";
import type { TrainingModality, Team } from "../types/domain";
import { useCollection, useClassProducts } from "../lib/hooks";

const FEATURES = [
  {
    icon: Zap,
    title: "Agenda inteligente",
    body: "Visualize horários disponíveis, agende e cancele dentro da janela permitida.",
  },
  {
    icon: TrendingUp,
    title: "Evolução real",
    body: "Acompanhe peso, medidas e percentual de gordura com gráficos detalhados.",
  },
  {
    icon: ShieldCheck,
    title: "Controle de aulas",
    body: "Saldo de créditos, histórico de pacotes e alertas de renovação automáticos.",
  },
  {
    icon: Sparkles,
    title: "Vitrine do treinador",
    body: "Ambiente personalizado com branding, modalidades, preços e agenda pública.",
  },
];

export function HomePage() {
  const { data: dbTeams } = useCollection<Team>("teams");

  // Usa apenas os dados reais do Firestore
  const teams = useMemo(() => dbTeams || [], [dbTeams]);

  const featured = useMemo(() => teams[0] || null, [teams]);

  const [selectedModality, setSelectedModality] = useState<TrainingModality | "Todas">("Todas");
  const [selectedGym, setSelectedGym] = useState<string>("Todos");
  const [filterHome, setFilterHome] = useState(false);
  const [filterCondo, setFilterCondo] = useState(false);

  // Academias presentes nos treinadores cadastrados
  const availableGyms = useMemo(() => {
    const gymIds = new Set(teams.flatMap((t) => (t.worksAt || []).map((g) => g.id)));
    return GYM_ONLY.filter((g) => gymIds.has(g.id));
  }, [teams]);

  const publicTeams = useMemo(() => teams.filter((team) => {
    if (!team.publicListing) return false;
    if (selectedModality !== "Todas" && !team.trainingModalities?.includes(selectedModality)) return false;
    if (selectedGym !== "Todos" && !(team.worksAt || []).some((g) => g.id === selectedGym)) return false;
    if (filterHome && !team.acceptsHomeVisit) return false;
    if (filterCondo && !team.acceptsCondoGym) return false;
    return true;
  }), [teams, selectedModality, selectedGym, filterHome, filterCondo]);

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        className="relative min-h-[70vh] overflow-hidden bg-stone-950 text-white"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(6,40,30,0.95) 0%, rgba(6,40,30,0.6) 60%, rgba(6,40,30,0.3) 100%), url(${featured?.branding?.heroPhotoURL || "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80"})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
        aria-label="Seção principal"
      >
        {/* Decorative gradient overlay bottom */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--color-surface)] to-transparent" />

        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-4 py-20">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-300">
              <span className="status-dot status-dot-active" />
              Plataforma fitness premium
            </span>

            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
              Seu treino.{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
                Seu resultado.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">
              Conecte-se ao seu personal trainer, acompanhe evolução, gerencie aulas
              e saldo — tudo em um só lugar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="focus-ring btn btn-primary btn-lg shadow-[var(--shadow-brand)]"
                to="/login"
                id="hero-cta-login"
              >
                Começar agora
                <ArrowRight aria-hidden="true" size={20} />
              </Link>
              <Link
                className="focus-ring inline-flex h-13 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
                to="/t/movimento-forte"
                id="hero-cta-example"
              >
                Ver exemplo de vitrine
              </Link>
            </div>

            {/* Trust bar */}
            <div className="mt-10 flex flex-wrap items-center gap-5">
              {["Sem taxa de adesão", "Cancele quando quiser", "Suporte incluído"].map((item) => (
                <span key={item} className="flex items-center gap-2 text-sm text-stone-300">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* ── Features ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="features-heading">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Plataforma completa</p>
          <h2 id="features-heading" className="mt-2 text-3xl text-stone-950">Tudo que você precisa para evoluir</h2>
          <p className="mt-3 text-stone-500 max-w-xl mx-auto text-sm leading-7">
            Para alunos que querem resultados e treinadores que querem profissionalizar sua gestão.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="card p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-[var(--shadow-brand)]">
                <Icon aria-hidden="true" className="text-white" size={22} />
              </div>
              <h3 className="mt-4 font-black text-stone-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Trainers listing ──────────────────────────────── */}
      <section className="bg-[var(--color-surface)] pb-16" aria-labelledby="trainers-heading">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col justify-between gap-4 pt-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Vitrine pública</p>
              <h2 id="trainers-heading" className="mt-1 text-3xl text-stone-950">Treinadores em destaque</h2>
            </div>
            <Link
              to="/treinadores"
              className="focus-ring text-sm font-bold text-emerald-700 hover:text-emerald-600 transition-colors"
              id="see-all-trainers"
            >
              Ver todos →
            </Link>
          </div>

          {/* Modality filter */}
          <div
            className="mt-6 flex gap-2 overflow-x-auto pb-2"
            role="tablist"
            aria-label="Filtrar por modalidade"
          >
            {(["Todas", ...trainingModalities] as const).map((modality) => {
              const active = selectedModality === modality;
              return (
                <button
                  key={modality}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  id={`tab-${modality.toLowerCase().replace(/\s+/g, "-")}`}
                  className={[
                    "focus-ring h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all duration-150",
                    active
                      ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                      : "border-[var(--color-border)] bg-white text-stone-600 hover:border-emerald-400 hover:text-emerald-700",
                  ].join(" ")}
                  onClick={() => setSelectedModality(modality)}
                >
                  {modality}
                </button>
              );
            })}
          </div>

          {/* Location filters */}
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtrar por local">
            {/* Academia filter */}
            <button
              type="button"
              id="filter-gym-all"
              className={["focus-ring h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all", selectedGym === "Todos" ? "border-blue-600 bg-blue-600 text-white" : "border-[var(--color-border)] bg-white text-stone-600 hover:border-blue-400"].join(" ")}
              onClick={() => setSelectedGym("Todos")}
            >
              <Building2 className="mr-1.5 inline" size={13} />
              Todas academias
            </button>
            {availableGyms.map((gym) => {
              const active = selectedGym === gym.id;
              return (
                <button
                  key={gym.id}
                  type="button"
                  id={`filter-gym-${gym.id}`}
                  className={["focus-ring h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition-all", active ? "border-blue-600 bg-blue-600 text-white" : "border-[var(--color-border)] bg-white text-stone-600 hover:border-blue-400"].join(" ")}
                  onClick={() => setSelectedGym(active ? "Todos" : gym.id)}
                >
                  {gym.name.replace(" — ", " · ")}
                </button>
              );
            })}

            {/* Special types */}
            <button
              type="button"
              id="filter-home"
              className={["focus-ring h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all", filterHome ? "border-emerald-600 bg-emerald-600 text-white" : "border-[var(--color-border)] bg-white text-stone-600 hover:border-emerald-400"].join(" ")}
              onClick={() => setFilterHome((v) => !v)}
            >
              <Home className="mr-1.5 inline" size={13} />
              Atende em casa
            </button>
            <button
              type="button"
              id="filter-condo"
              className={["focus-ring h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all", filterCondo ? "border-violet-600 bg-violet-600 text-white" : "border-[var(--color-border)] bg-white text-stone-600 hover:border-violet-400"].join(" ")}
              onClick={() => setFilterCondo((v) => !v)}
            >
              <Building2 className="mr-1.5 inline" size={13} />
              Academia do cond.
            </button>
          </div>

          {/* Teams grid */}
          <div className="mt-6 grid gap-5 md:grid-cols-2 stagger">
            {publicTeams.length === 0 ? (
              <p className="col-span-full py-12 text-center text-stone-400">
                Nenhum treinador encontrado para essa modalidade.
              </p>
            ) : (
              publicTeams.map((team) => (
                <TrainerCard key={team.id} team={team} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div
          className="overflow-hidden rounded-2xl text-white"
          style={{
            background: "linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%)",
          }}
        >
          <div className="relative px-8 py-12 sm:px-12 sm:py-14">
            {/* Decorative circle */}
            <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full bg-white/5" />
            <div className="absolute right-12 bottom-0 h-40 w-40 translate-y-1/2 rounded-full bg-white/5" />

            <div className="relative max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">
                Para treinadores
              </p>
              <h2 className="mt-2 text-4xl font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                Profissionalize sua gestão hoje
              </h2>
              <p className="mt-4 text-lg leading-8 text-emerald-100">
                Crie seu ambiente personalizado, divulgue modalidades e valores, gerencie
                alunos e agenda — tudo em minutos.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="focus-ring inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
                  to="/cadastro/treinador"
                  id="cta-trainer-signup"
                >
                  Criar minha vitrine grátis
                  <ArrowRight size={18} />
                </Link>
                <Link
                  className="focus-ring inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 px-6 text-sm font-bold text-white transition hover:bg-white/10"
                  to="/t/movimento-forte"
                  id="cta-see-example"
                >
                  Ver exemplo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoPill({ icon: Icon, text }: { icon: typeof Tag; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-stone-50 px-3 py-2">
      <Icon aria-hidden="true" className="text-emerald-700 shrink-0" size={14} />
      <span className="text-xs font-semibold text-stone-600">{text}</span>
    </div>
  );
}

function TrainerCard({ team }: { team: Team }) {
  const { data: dbProducts } = useClassProducts(team.id);

  const products = useMemo(() => dbProducts || [], [dbProducts]);

  const firstPrice = useMemo(() => {
    return products.length
      ? Math.min(...products.map((p) => p.priceCents))
      : null;
  }, [products]);


  return (
    <article
      className="card overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
    >
      {/* Banner image */}
      <div className="relative h-44 overflow-hidden">
        <img
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          src={team.branding.bannerPhotoURL || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80"}
          alt={`Banner ${team.name}`}
          loading="lazy"
          decoding="async"
        />
        {/* Photo avatar */}
        <img
          className="absolute bottom-0 left-4 translate-y-1/2 h-14 w-14 rounded-full border-4 border-white object-cover shadow-md"
          src={team.branding.trainerPhotoURL || "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80"}
          alt={`Foto ${team.name}`}
          loading="lazy"
        />
        {firstPrice !== null && (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-800 px-3 py-1 text-xs font-black text-white shadow-md">
            a partir de {moneyFromCents(firstPrice)}
          </span>
        )}
      </div>

      <div className="px-5 pb-5 pt-10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-black text-stone-950">{team.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-400">
              <MapPin size={11} />
              {team.isSolo ? "Treinador solo" : "Equipe de treinamento"}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            4.9
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-stone-500 line-clamp-2">
          {team.branding.bio}
        </p>

        {/* Location badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(team.worksAt || []).map((gym) => (
            <span
              key={gym.id}
              className={[
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                gym.type === "outdoor" ? "border-amber-100 bg-amber-50 text-amber-700" : "border-blue-100 bg-blue-50 text-blue-700",
              ].join(" ")}
            >
              {gym.type === "outdoor" ? "🌳" : "🏋️"} {gym.name.split(" — ")[0]}
            </span>
          ))}
          {team.acceptsHomeVisit && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Home size={10} /> Em casa
            </span>
          )}
          {team.acceptsCondoGym && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
              <Building2 size={10} /> Cond.
            </span>
          )}
        </div>

        {/* Info row */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <InfoPill icon={Tag} text={`${products.length} pacote${products.length !== 1 ? "s" : ""} disponível${products.length !== 1 ? "s" : ""}`} />
          <InfoPill icon={CalendarDays} text="Agenda pública ativa" />
        </div>



        <Link
          className="focus-ring btn btn-primary mt-4 w-full"
          to={`/t/${team.slug}`}
          id={`team-cta-${team.slug}`}
          aria-label={`Ver detalhes de ${team.name}`}
        >
          Ver detalhes
          <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </article>
  );
}
