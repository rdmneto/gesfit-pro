import type { GymLocation } from "../types/domain";

/**
 * Lista curada de academias e locais de treino.
 * Inclui redes nacionais, academias independentes e opções especiais.
 * Em produção, esta lista seria alimentada por uma API de lugares (Google Places / Foursquare).
 */
export const GYM_CATALOG: GymLocation[] = [
  // ── Opções especiais ──────────────────────────────────────────────────────
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
  {
    id: "outdoor",
    name: "Treino ao ar livre (parque / praça)",
    address: "Parque / Praça pública",
    city: "Qualquer",
    type: "outdoor",
  },

  // ── Redes nacionais ───────────────────────────────────────────────────────
  {
    id: "smartfit-paulista",
    name: "Smart Fit — Av. Paulista",
    address: "Av. Paulista, 900 — Bela Vista",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "smartfit-pinheiros",
    name: "Smart Fit — Pinheiros",
    address: "R. dos Pinheiros, 498 — Pinheiros",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "smartfit-moema",
    name: "Smart Fit — Moema",
    address: "Av. Ibirapuera, 3103 — Moema",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "smartfit-tatuape",
    name: "Smart Fit — Tatuapé",
    address: "R. Taquari, 699 — Tatuapé",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "smartfit-santana",
    name: "Smart Fit — Santana",
    address: "Av. Luís Dumont Villares, 520 — Santana",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "bluefit-higienopolis",
    name: "Bluefit — Higienópolis",
    address: "R. Maranhão, 800 — Higienópolis",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "bluefit-vila-mariana",
    name: "Bluefit — Vila Mariana",
    address: "Av. Dom Pedro I, 736 — Vila Mariana",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "bluefit-brooklin",
    name: "Bluefit — Brooklin",
    address: "R. Funchal, 418 — Brooklin",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "bodytech-jardins",
    name: "Bodytech — Jardins",
    address: "Alameda Santos, 1127 — Jardins",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "bodytech-itaim",
    name: "Bodytech — Itaim Bibi",
    address: "R. Dr. Renato Paes de Barros, 618 — Itaim Bibi",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "bodytech-perdizes",
    name: "Bodytech — Perdizes",
    address: "R. Cardoso de Almeida, 1491 — Perdizes",
    city: "São Paulo",
    type: "gym",
  },

  // ── Academias premium / boutique ──────────────────────────────────────────
  {
    id: "bioritmo-paulista",
    name: "Bio Ritmo — Av. Paulista",
    address: "Av. Paulista, 612 — Bela Vista",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "bioritmo-itaim",
    name: "Bio Ritmo — Itaim Bibi",
    address: "R. Jerônimo da Veiga, 384 — Itaim Bibi",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "selfit-moema",
    name: "Selfit — Moema",
    address: "Av. Moaci, 475 — Moema",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "selfit-campo-belo",
    name: "Selfit — Campo Belo",
    address: "R. Tenente Pena, 127 — Campo Belo",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "runner-ibirapuera",
    name: "Runner — Ibirapuera",
    address: "Av. Ibirapuera, 2907 — Moema",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "runner-higienopolis",
    name: "Runner — Higienópolis",
    address: "Av. Higienópolis, 618 — Higienópolis",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "fithub-pinheiros",
    name: "FitHub — Pinheiros",
    address: "R. Teodoro Sampaio, 1100 — Pinheiros",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "fithub-vila-madalena",
    name: "FitHub — Vila Madalena",
    address: "R. Inácio Pereira da Rocha, 400 — Vila Madalena",
    city: "São Paulo",
    type: "gym",
  },

  // ── CrossFit / Funcional ──────────────────────────────────────────────────
  {
    id: "crossfit-paulista",
    name: "CrossFit Paulista",
    address: "Av. Paulista, 2237 — Bela Vista",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "crossfit-pinheiros",
    name: "CrossFit Pinheiros",
    address: "R. dos Pinheiros, 1200 — Pinheiros",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "crossfit-moema",
    name: "CrossFit Moema",
    address: "Av. Rouxinol, 55 — Moema",
    city: "São Paulo",
    type: "gym",
  },
  {
    id: "cf-itaim",
    name: "CrossFit Itaim",
    address: "R. Leopoldo Couto Magalhães Jr., 758 — Itaim",
    city: "São Paulo",
    type: "gym",
  },

  // ── Parques / Outdoor ─────────────────────────────────────────────────────
  {
    id: "parque-ibirapuera",
    name: "Parque Ibirapuera",
    address: "Av. Pedro Álvares Cabral, s/n — Ibirapuera",
    city: "São Paulo",
    type: "outdoor",
  },
  {
    id: "parque-aclimacao",
    name: "Parque da Aclimação",
    address: "R. Muniz de Souza, 1119 — Aclimação",
    city: "São Paulo",
    type: "outdoor",
  },
  {
    id: "parque-trianon",
    name: "Parque Trianon",
    address: "Av. Paulista, 1380 — Cerqueira César",
    city: "São Paulo",
    type: "outdoor",
  },
  {
    id: "parque-estadual",
    name: "Parque Estadual da Cantareira",
    address: "Av. Dra. Aracy Amaral Camargo, s/n — Tremembé",
    city: "São Paulo",
    type: "outdoor",
  },
];

/** Apenas academias (tipo "gym") */
export const GYM_ONLY = GYM_CATALOG.filter((g) => g.type === "gym");

/** Opções especiais (home, condo, outdoor) */
export const SPECIAL_LOCATIONS = GYM_CATALOG.filter((g) => g.type !== "gym");

/** Busca rápida por nome ou bairro */
export function searchGyms(query: string): GymLocation[] {
  const q = query.toLowerCase().trim();
  if (!q) return GYM_CATALOG;
  return GYM_CATALOG.filter(
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
