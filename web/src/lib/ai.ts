import type { Exercise } from "../types/domain";

// A chave fornecida pelo usuário para a API da NVIDIA (DeepSeek)
const apiKey = "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";
const baseUrl = import.meta.env.DEV 
  ? "/api/nvidia/v1/chat/completions" 
  : "https://integrate.api.nvidia.com/v1/chat/completions";

export interface WorkoutGenerationParams {
  durationMinutes: string;
  exercisesCount: string;
  focus: string;
  style: string;
}

export async function generateWorkout(params: WorkoutGenerationParams): Promise<Exercise[]> {
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

Para o \`videoUrl\`, gere um link de PESQUISA do YouTube para a execução do exercício (já que você não tem acesso a links diretos reais).
Exemplo: "https://www.youtube.com/results?search_query=Supino+Reto+Execução"

Lembre-se: Retorne SOMENTE o JSON. Certifique-se de que é um array [].
`;

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384,
        stream: false,
        chat_template_kwargs: { thinking: false }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    
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
