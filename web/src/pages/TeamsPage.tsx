import { CalendarDays, Search, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sampleClassProducts, samplePublicSchedule, sampleTeams } from "../data/sample";
import { moneyFromCents } from "../lib/format";

export function TeamsPage() {
  const [query, setQuery] = useState("");
  const teams = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return sampleTeams;
    }

    return sampleTeams.filter((team) => {
      return [team.name, team.branding.bio].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [query]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black">Treinadores e times</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Lista publica para alunos visualizarem agenda, aulas avulsas e pacotes antes do
            cadastro.
          </p>
        </div>
        <label className="relative block sm:w-80">
          <span className="sr-only">Buscar time</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
            size={18}
          />
          <input
            className="focus-ring h-11 w-full rounded-md border border-stone-300 bg-white pl-10 pr-3"
            placeholder="Buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const products = sampleClassProducts.filter(
            (product) => product.teamId === team.id && product.publicVisible,
          );
          const slots = samplePublicSchedule.filter(
            (slot) => slot.teamId === team.id && slot.publicVisible,
          );
          const single = products.find((product) => product.type === "single");
          const packages = products.filter((product) => product.type === "package");

          return (
            <Link
              key={team.id}
              to={`/t/${team.slug}`}
              className="focus-ring overflow-hidden rounded-lg border border-stone-200 bg-white hover:border-emerald-700"
            >
              <img className="h-44 w-full object-cover" src={team.branding.heroPhotoURL} alt="" />
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: team.branding.primaryColor }}
                    />
                    <h2 className="text-xl font-bold">{team.name}</h2>
                  </div>
                  <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">
                    {team.isSolo ? "Treinador solo" : "Equipe"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{team.branding.bio}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Summary
                    icon={Tag}
                    label="Aula avulsa"
                    value={single ? moneyFromCents(single.priceCents) : "Nao divulgado"}
                  />
                  <Summary
                    icon={CalendarDays}
                    label="Horarios visiveis"
                    value={`${slots.filter((slot) => slot.available > 0).length} com vaga`}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {packages.map((product) => (
                    <span
                      key={product.id}
                      className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900"
                    >
                      {product.classesCount} aulas por {moneyFromCents(product.priceCents)}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-stone-100 px-3 py-2">
      <Icon aria-hidden="true" className="text-emerald-800" size={17} />
      <div>
        <p className="text-xs text-stone-600">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}
