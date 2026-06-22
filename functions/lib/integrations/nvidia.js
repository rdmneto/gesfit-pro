import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAuth } from "../lib/assertions.js";
const NVIDIA_API_KEY = "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";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "deepseek-ai/deepseek-r1";
export const generateWorkoutAI = onCall({ timeoutSeconds: 60 }, async (request) => {
    requireAuth(request);
    const { durationMinutes, exercisesCount, focus, style } = request.data;
    const prompt = `Você é um Personal Trainer de elite.
Sua tarefa é gerar uma lista de exercícios para um treino.
Você DEVE retornar APENAS UM ARRAY JSON válido contendo os exercícios e NADA MAIS.
Nenhuma introdução, nenhuma formatação de markdown fora do JSON.

Parâmetros do Treino:
- Tempo de treino: ${durationMinutes} minutos
- Quantidade de exercícios: ${exercisesCount}
- Foco: ${focus}
- Estilo do treino: ${style}

O formato de cada objeto no array JSON deve ser exatamente este:
{
  "name": "Nome do Exercício",
  "sets": "Ex: 4x12 ou 3x15",
  "rest": "Ex: 60s ou 90s",
  "notes": "Dica rápida de execução (curta)",
  "videoUrl": "https://www.youtube.com/results?search_query=Nome+Exercicio+Execução"
}

Lembre-se: Retorne SOMENTE o JSON. Certifique-se de que é um array [].`;
    const response = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 4096,
            stream: false,
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new HttpsError("internal", err.message ?? `NVIDIA HTTP ${response.status}`);
    }
    const data = await response.json();
    const raw = data.choices[0].message.content;
    // Remove thinking blocks (DeepSeek R1) and markdown fences
    const clean = raw
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/^```json\s*/m, "")
        .replace(/^```\s*/m, "")
        .replace(/```$/m, "")
        .trim();
    let exercises;
    try {
        exercises = JSON.parse(clean);
        if (!Array.isArray(exercises))
            throw new Error("not an array");
    }
    catch {
        throw new HttpsError("internal", "Resposta da IA não é um JSON válido.");
    }
    return exercises.map((ex, index) => ({
        order: index,
        name: ex.name || "Exercício",
        sets: ex.sets || "",
        rest: ex.rest || "",
        notes: ex.notes || "",
        videoUrl: ex.videoUrl ||
            `https://www.youtube.com/results?search_query=${encodeURIComponent((ex.name || "") + " Execução")}`,
    }));
});
