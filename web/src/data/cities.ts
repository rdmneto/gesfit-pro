/**
 * Cidades atendidas pela plataforma. Começamos por Fortaleza/CE e a estrutura
 * já permite expandir para outras cidades sem mudar o código — basta adicionar
 * itens aqui e academias com a respectiva cidade em `gyms.ts`.
 */
export interface City {
  id: string;
  name: string;
  state: string; // UF
}

export const CITIES: City[] = [
  { id: "fortaleza-ce", name: "Fortaleza", state: "CE" },
  { id: "caucaia-ce", name: "Caucaia", state: "CE" },
  { id: "maracanau-ce", name: "Maracanaú", state: "CE" },
  { id: "eusebio-ce", name: "Eusébio", state: "CE" },
  { id: "aquiraz-ce", name: "Aquiraz", state: "CE" },
  { id: "juazeiro-do-norte-ce", name: "Juazeiro do Norte", state: "CE" },
  { id: "sobral-ce", name: "Sobral", state: "CE" },
];

/** Cidade padrão enquanto a operação está concentrada em Fortaleza. */
export const DEFAULT_CITY = "Fortaleza";

export const CITY_NAMES: string[] = CITIES.map((c) => c.name);
