import type { Exercise } from "../types/domain";

const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY as string ?? "").trim();
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface WorkoutGenerationParams {
  durationMinutes: string;
  exercisesCount: string;
  focus: string;
  style: string;
}

export async function generateWorkout(params: WorkoutGenerationParams): Promise<Exercise[]> {
  const prompt = `Você é um Personal Trainer de elite.
Sua tarefa é gerar uma lista de exercícios para um treino.
Você DEVE retornar APENAS UM ARRAY JSON válido contendo os exercícios e NADA MAIS.
Nenhuma introdução, nenhuma formatação de markdown fora do JSON.

Parâmetros do Treino:
- Tempo de treino: ${params.durationMinutes} minutos
- Quantidade de exercícios: ${params.exercisesCount}
- Foco: ${params.focus}
- Estilo do treino: ${params.style}

O formato de cada objeto no array JSON deve ser exatamente este:
{
  "name": "Nome do Exercício",
  "sets": "Ex: 4x12 ou 3x15",
  "rest": "Ex: 60s ou 90s",
  "notes": "Dica rápida de execução (curta)",
  "videoUrl": "https://www.youtube.com/results?search_query=Nome+Exercicio+Execução"
}

Lembre-se: Retorne SOMENTE o JSON. Certifique-se de que é um array [].`;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    throw new Error(`Erro na IA: ${err.error?.message ?? `HTTP ${response.status}`}`);
  }

  const data = await response.json() as any;
  const raw: string = data.choices[0].message.content;

  const clean = raw
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```$/m, "")
    .trim();

  const exercises = JSON.parse(clean);
  if (!Array.isArray(exercises)) throw new Error("Resposta da IA não é um array válido.");

  return exercises.map((ex: any, index: number) => ({
    order: index,
    name: ex.name || "Exercício",
    sets: ex.sets || "",
    rest: ex.rest || "",
    notes: ex.notes || "",
    videoUrl: ex.videoUrl ||
      `https://www.youtube.com/results?search_query=${encodeURIComponent((ex.name || "") + " Execução")}`,
  }));
}
