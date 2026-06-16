import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Exercise } from "../types/domain";

// A chave será obtida do .env do Vite
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

let genAI: GoogleGenerativeAI | null = null;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

export interface WorkoutGenerationParams {
  durationMinutes: string;
  exercisesCount: string;
  focus: string;
  style: string;
}

export async function generateWorkout(params: WorkoutGenerationParams): Promise<Exercise[]> {
  if (!genAI) {
    throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) não está configurada. Adicione no arquivo .env");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const prompt = `
Você é um Personal Trainer de elite.
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
  "videoUrl": "Link de pesquisa no youtube"
}

Para o \`videoUrl\`, use OBRIGATORIAMENTE o formato de link de pesquisa do YouTube, substituindo os espaços por '+':
Exemplo: Se o exercício for "Supino Reto", o videoUrl deve ser "https://www.youtube.com/results?search_query=Supino+Reto+Execução"

Lembre-se: Retorne SOMENTE o JSON. Certifique-se de que é um array [].
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Limpeza de possíveis tags de markdown caso a IA inclua
    const cleanText = text.replace(/^```json/g, "").replace(/^```/g, "").replace(/```$/g, "").trim();
    
    const exercisesData = JSON.parse(cleanText);
    
    if (!Array.isArray(exercisesData)) {
      throw new Error("Resposta não é um array válido.");
    }

    return exercisesData.map((ex: any, index: number) => ({
      order: index,
      name: ex.name || "Exercício",
      sets: ex.sets || "",
      rest: ex.rest || "",
      notes: ex.notes || "",
      videoUrl: ex.videoUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent((ex.name || '') + ' Execução')}`
    }));
  } catch (error: any) {
    console.error("Erro na geração por IA:", error);
    // Extraindo mensagem detalhada para ajudar no debug
    const errorMsg = error.message || "Erro desconhecido";
    throw new Error(`Erro na IA: ${errorMsg}`);
  }
}
