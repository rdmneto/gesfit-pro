import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const apiKey = "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";
const baseUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

export const generateWorkoutAI = onCall({ cors: true, maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "O usuário deve estar autenticado para usar a IA.");
  }

  const { prompt } = request.data;
  if (!prompt) {
    throw new HttpsError("invalid-argument", "O prompt não foi fornecido.");
  }

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
      const errorData: any = await response.json().catch(() => ({}));
      logger.error("Nvidia API Error:", errorData);
      throw new HttpsError("internal", errorData.message || `Erro HTTP: ${response.status}`);
    }

    const data: any = await response.json();
    return { text: data.choices[0].message.content };
  } catch (error: any) {
    logger.error("Error calling Nvidia API:", error);
    throw new HttpsError("internal", `Erro na IA: ${error.message}`);
  }
});
