import type { Exercise } from "../types/domain";

const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY as string ?? "").trim();
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```$/m, "")
    .trim();
}

async function callGroq(prompt: string, maxTokens = 512, temperature = 0.4): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    throw new Error(`Erro na IA: ${err.error?.message ?? `HTTP ${response.status}`}`);
  }
  const data = await response.json() as any;
  return (data.choices[0].message.content as string).trim();
}

export interface WorkoutGenerationParams {
  durationMinutes: string;
  exercisesCount: string;
  focus: string;
  style: string;
}

export interface WorkoutGenerationResult {
  exercises: Exercise[];
  caloriesPerMinute: number;
}

export async function generateWorkout(params: WorkoutGenerationParams): Promise<WorkoutGenerationResult> {
  const prompt = `Você é um Personal Trainer de elite.
Sua tarefa é gerar um treino completo e estimar o gasto calórico.
Você DEVE retornar APENAS UM OBJETO JSON válido e NADA MAIS.
Nenhuma introdução, nenhuma formatação de markdown fora do JSON.

Parâmetros do Treino:
- Tempo de treino: ${params.durationMinutes} minutos
- Quantidade de exercícios: ${params.exercisesCount}
- Foco: ${params.focus}
- Estilo do treino: ${params.style}

O formato do objeto JSON deve ser exatamente este:
{
  "caloriesPerMinute": <número inteiro estimado de kcal/min para este treino específico>,
  "exercises": [
    {
      "name": "Nome do Exercício",
      "sets": "Ex: 4x12 ou 3x15",
      "rest": "Ex: 60s ou 90s",
      "notes": "Dica rápida de execução (curta)",
      "videoUrl": "https://www.youtube.com/results?search_query=Nome+Exercicio+Execução"
    }
  ]
}

Para estimar caloriesPerMinute, considere a intensidade e estilo do treino:
- Musculação leve/moderada: 5-7 kcal/min
- Musculação intensa/hipertrofia: 7-9 kcal/min
- Funcional/HIIT: 10-14 kcal/min
- Cross Fit intenso: 12-16 kcal/min
- Pilates/Yoga: 3-5 kcal/min
- Artes marciais: 8-12 kcal/min

Lembre-se: Retorne SOMENTE o objeto JSON com os campos "caloriesPerMinute" e "exercises".`;

  const raw = await callGroq(prompt, 4096, 0.7);
  const parsed = JSON.parse(stripMarkdown(raw));

  const exercisesArray: any[] = Array.isArray(parsed) ? parsed : (parsed.exercises ?? []);
  const caloriesPerMinute: number = typeof parsed.caloriesPerMinute === "number"
    ? Math.round(parsed.caloriesPerMinute)
    : 7;

  if (!Array.isArray(exercisesArray) || exercisesArray.length === 0) {
    throw new Error("Resposta da IA não contém exercícios válidos.");
  }

  const exercises = exercisesArray.map((ex: any, index: number) => ({
    order: index,
    name: ex.name || "Exercício",
    sets: ex.sets || "",
    rest: ex.rest || "",
    notes: ex.notes || "",
    videoUrl: ex.videoUrl ||
      `https://www.youtube.com/results?search_query=${encodeURIComponent((ex.name || "") + " Execução")}`,
  }));

  return { exercises, caloriesPerMinute };
}

export async function estimateCaloriesFromExercises(exerciseNames: string[], title: string): Promise<number> {
  const prompt = `Você é um Personal Trainer de elite. Analise os exercícios abaixo e estime o gasto calórico médio em kcal por minuto para uma pessoa adulta de porte médio realizando este treino no ritmo esperado.

Título do treino: ${title || "Treino Personalizado"}
Exercícios: ${exerciseNames.join(", ")}

Referências:
- Musculação leve/moderada: 5-7 kcal/min
- Musculação intensa/hipertrofia: 7-9 kcal/min
- Funcional/HIIT: 10-14 kcal/min
- Cross Fit intenso: 12-16 kcal/min
- Pilates/Yoga: 3-5 kcal/min
- Artes marciais: 8-12 kcal/min

Responda SOMENTE com um número inteiro (kcal/min), sem texto adicional.`;

  const raw = await callGroq(prompt, 16);
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  if (isNaN(n) || n < 1 || n > 30) throw new Error("Estimativa de calorias inválida.");
  return n;
}

export async function findVideosForExercises(exercises: Exercise[]): Promise<Exercise[]> {
  const list = exercises
    .map((e, i) => `${i}. ${e.name}${e.notes ? ` (${e.notes})` : ""}`)
    .join("\n");

  const prompt = `Para cada exercício abaixo, crie uma query de busca otimizada em português para encontrar um vídeo de demonstração de execução no YouTube.

Exercícios:
${list}

Retorne APENAS um JSON array no formato:
[{ "index": 0, "searchQuery": "query em português" }]

Regras:
- Português brasileiro
- Inclua termos como "execução", "como fazer" ou "técnica correta"
- Seja específico (mencione equipamentos se relevante: halteres, barra, máquina, cabo)
- Máximo 6 palavras por query

Retorne SOMENTE o JSON array.`;

  const raw = await callGroq(prompt, 1024);
  const parsed: Array<{ index: number; searchQuery: string }> = JSON.parse(stripMarkdown(raw));

  return exercises.map((ex, i) => {
    const match = parsed.find((p) => p.index === i);
    if (!match?.searchQuery) return ex;
    return {
      ...ex,
      videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(match.searchQuery)}`,
    };
  });
}
