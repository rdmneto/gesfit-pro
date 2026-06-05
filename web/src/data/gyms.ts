import type { GymLocation } from "../types/domain";

/**
 * Lista curada de academias e locais de treino — fase inicial em Fortaleza/CE.
 * A estrutura suporta múltiplas cidades (campo `city`); a expansão é só
 * adicionar entradas de outras cidades aqui.
 * Em produção, esta lista pode ser alimentada por uma API de lugares.
 */
export const GYM_CATALOG: GymLocation[] = [
  // ── Opções especiais (valem para qualquer cidade) ─────────────────────────
  {
    id: "home",
    name: "Atendimento em domicílio",
    address: "Na residência do aluno",
    city: "Qualquer",
    type: "home",
  },
  {
    id: "condo",
    name: "Academia do condomínio",
    address: "No condomínio do aluno",
    city: "Qualquer",
    type: "condo",
  },

  // ── Fortaleza · redes e academias ──────────────────────────────────────────
  {
    id: "live-aldeota",
    name: "Live Academia — Aldeota",
    address: "Av. Dom Luís, 500 — Aldeota",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "live-bezerra",
    name: "Live Academia — Bezerra de Menezes",
    address: "Av. Bezerra de Menezes, 1820 — São Gerardo",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "live-washington-soares",
    name: "Live Academia — Washington Soares",
    address: "Av. Washington Soares, 1400 — Edson Queiroz",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "live-parangaba",
    name: "Live Academia — Parangaba",
    address: "Av. José Bastos, 3390 — Parangaba",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "live-messejana",
    name: "Live Academia — Messejana",
    address: "Av. Frei Cirilo, 2900 — Messejana",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "smartfit-domluis",
    name: "Smart Fit — Aldeota (Dom Luís)",
    address: "Av. Dom Luís, 1200 — Aldeota",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "smartfit-centro",
    name: "Smart Fit — Centro",
    address: "R. Floriano Peixoto, 700 — Centro",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "smartfit-northshopping",
    name: "Smart Fit — North Shopping",
    address: "Av. Bezerra de Menezes, 2450 — São Gerardo",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "selfit-funcionarios",
    name: "Selfit — Cidade dos Funcionários",
    address: "Av. Rogaciano Leite, 1400 — Salinas",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "selfit-antonio-sales",
    name: "Selfit — Antônio Sales",
    address: "Av. Antônio Sales, 2200 — Dionísio Torres",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "bodytech-iguatemi",
    name: "Bodytech — Shopping Iguatemi",
    address: "Av. Washington Soares, 85 — Edson Queiroz",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "ironberry-meireles",
    name: "Iron Berry — Meireles",
    address: "R. Tibúrcio Cavalcante, 300 — Meireles",
    city: "Fortaleza",
    type: "gym",
  },
  {
    id: "cia-athletica-coco",
    name: "Cia Athletica — Cocó",
    address: "Av. Eng. Santana Jr., 3000 — Cocó",
    city: "Fortaleza",
    type: "gym",
  },

  // ── Fortaleza · ao ar livre ────────────────────────────────────────────────
  {
    id: "beira-mar",
    name: "Calçadão da Av. Beira Mar",
    address: "Av. Beira Mar — Meireles",
    city: "Fortaleza",
    type: "outdoor",
  },
  {
    id: "praia-do-futuro",
    name: "Praia do Futuro",
    address: "Av. Clóvis Arrais Maia — Praia do Futuro",
    city: "Fortaleza",
    type: "outdoor",
  },
  {
    id: "parque-do-coco",
    name: "Parque do Cocó",
    address: "Av. Eng. Santana Jr. — Cocó",
    city: "Fortaleza",
    type: "outdoor",
  },
  {
    id: "lagoa-maraponga",
    name: "Lagoa da Maraponga",
    address: "Av. Godofredo Maciel — Maraponga",
    city: "Fortaleza",
    type: "outdoor",
  },
];

/** Apenas academias (tipo "gym") */
export const GYM_ONLY = GYM_CATALOG.filter((g) => g.type === "gym");

/** Opções especiais (home, condo, outdoor) */
export const SPECIAL_LOCATIONS = GYM_CATALOG.filter((g) => g.type !== "gym");

/** Locais de uma cidade (inclui as opções "Qualquer", que valem sempre). */
export function gymsByCity(city: string | null | undefined): GymLocation[] {
  if (!city) return GYM_CATALOG;
  return GYM_CATALOG.filter((g) => g.city === city || g.city === "Qualquer");
}

/** Busca rápida por nome ou bairro, opcionalmente dentro de uma cidade. */
export function searchGyms(query: string, city?: string | null): GymLocation[] {
  const base = city ? gymsByCity(city) : GYM_CATALOG;
  const q = query.toLowerCase().trim();
  if (!q) return base;
  return base.filter(
    (g) =>
      g.name.toLowerCase().includes(q) ||
      g.address.toLowerCase().includes(q) ||
      g.city.toLowerCase().includes(q),
  );
}

/** Ícone por tipo de local */
export function gymTypeIcon(type: GymLocation["type"]): string {
  return { gym: "🏋️", home: "🏠", condo: "🏢", outdoor: "🌳" }[type];
}

/** Label legível por tipo */
export function gymTypeLabel(type: GymLocation["type"]): string {
  return { gym: "Academia", home: "Domicílio", condo: "Condomínio", outdoor: "Ao ar livre" }[type];
}
