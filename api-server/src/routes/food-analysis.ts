import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
}

const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);
let keyIdx = 0;
function nextKey(): string {
  if (!geminiKeys.length) throw new Error("No GEMINI_API_KEYS configured");
  return geminiKeys[keyIdx++ % geminiKeys.length];
}

const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

const FOOD_SYSTEM = `Você é um assistente nutricional do Miar AI/FOOD. O usuário enviou uma foto de uma refeição.
Analise a imagem e forneça:
1. O que aparece na foto (alimentos identificados)
2. Estimativa aproximada de calorias totais
3. Estimativa de proteínas (g), carboidratos (g) e gorduras (g)
4. Uma dica nutricional relevante baseada no que foi identificado

IMPORTANTE: Sempre deixe claro que são estimativas visuais aproximadas, não medições precisas.
Responda em português brasileiro de forma amigável.`;

// POST /food-analysis — public, no auth required
router.post("/food-analysis", async (req, res): Promise<void> => {
  const { imageBase64, mimeType = "image/jpeg" } = req.body as {
    imageBase64: string;
    mimeType?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 é obrigatório" });
    return;
  }

  if (!geminiKeys.length) {
    res.json({
      message: "🌿 Análise estimada: Para análise nutricional por foto, configure a chave GEMINI_API_KEYS. Por enquanto, posso responder perguntas sobre nutrição por texto!",
    });
    return;
  }

  const attempts = Math.max(geminiKeys.length, 1) * MODELS.length;
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    const apiKey = nextKey();
    const model = MODELS[i % MODELS.length];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: FOOD_SYSTEM },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            }],
            generationConfig: { maxOutputTokens: 600, temperature: 0.4 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini ${response.status}: ${err}`);
      }

      const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const message = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!message) throw new Error("Empty response from Gemini");

      logger.info({ model }, "Food analysis OK");
      res.json({ message });
      return;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Food analysis attempt failed");
    }
  }

  res.json({
    message: "⚠️ Não foi possível analisar a foto no momento. Tente novamente ou descreva o que comeu e te ajudo com as informações nutricionais!",
  });
});

export default router;
