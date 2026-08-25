import { Router, type IRouter } from "express";
import { marketingCampaigns, createMarketingCampaign, deleteMarketingCampaign } from "../lib/data-store";
import { logger } from "../lib/logger";
import { requireOwnerAuth } from "./auth";

const router: IRouter = Router();

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
}
const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);
let keyIdx = 0;
function nextKey(): string {
  if (!geminiKeys.length) throw new Error("GEMINI_API_KEYS não configurado");
  return geminiKeys[keyIdx++ % geminiKeys.length];
}
const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

// ─── System prompt para geração de campanhas de marketing ────────────────────
function buildMarketingSystem(restaurantName: string, segment: string): string {
  return `Você é o diretor criativo de marketing digital da MIAR, especializado em restaurantes brasileiros.
Analise as imagens do estabelecimento/pratos fornecidas e crie uma campanha de marketing completa.
Restaurante: ${restaurantName}
Segmento: ${segment}

Responda APENAS com JSON válido (sem markdown), no formato:
{
  "title": "Nome da campanha (ex: Promoção Fim de Semana)",
  "headline": "Título principal impactante (máx 10 palavras)",
  "copy": "Texto completo da campanha (2-4 parágrafos, tom autêntico e envolvente)",
  "hashtags": ["#hashtag1", "#hashtag2", ...],
  "callToAction": "Chamada para ação (ex: Peça pelo link na bio!)",
  "imageSuggestion": "Descrição da foto/vídeo ideal para acompanhar (1 frase)",
  "tone": "descontraído|premium|urgente|emocional",
  "targetPlatforms": ["instagram", "whatsapp", "tiktok", "google"],
  "whatsappMessage": "Mensagem curta para disparar no WhatsApp (máx 3 linhas)",
  "instagramCaption": "Legenda completa para Instagram com emojis e hashtags"
}

Use linguagem brasileira, próxima e autêntica. Evite clichês. Seja criativo e específico ao contexto do restaurante.`;
}

// ─── POST /marketing/campaign — analisa fotos e gera campanha de marketing ───
router.post("/marketing/campaign", requireOwnerAuth, async (req, res): Promise<void> => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).owner.companyId;
  const {
    images,           // Array de { base64: string, mimeType: string }
    restaurantName = "Restaurante",
    segment = "restaurante",
    briefing,         // Texto adicional do gestor: promoção, contexto, objetivo
  } = req.body as {
    images: Array<{ base64: string; mimeType?: string }>;
    restaurantName?: string;
    segment?: string;
    briefing?: string;
  };

  if (!images?.length) {
    res.status(400).json({ error: "Envie ao menos uma imagem do estabelecimento ou prato" });
    return;
  }

  if (images.length > 5) {
    res.status(400).json({ error: "Máximo de 5 imagens por campanha" });
    return;
  }

  const userText = briefing?.trim()
    ? `Contexto adicional do gestor: "${briefing}"\n\nCrie a campanha analisando as ${images.length} imagem(ns) fornecidas.`
    : `Analise as ${images.length} imagem(ns) do restaurante/prato e crie a campanha.`;

  const imageParts = images.map((img, idx) => ({
    inline_data: {
      mime_type: img.mimeType ?? "image/jpeg",
      data: img.base64,
    },
  }));

  const attempts = Math.max(geminiKeys.length, 1) * MODELS.length;
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    const apiKey = nextKey();
    const model = MODELS[i % MODELS.length];

    try {
      logger.info({ model, images: images.length }, "Marketing campaign generation attempt");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: buildMarketingSystem(restaurantName, segment) }] },
            contents: [{
              role: "user",
              parts: [...imageParts, { text: userText }],
            }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.75 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        if ([429, 401, 403].includes(response.status)) throw new Error(`${model} ${response.status}`);
        throw new Error(`${model} error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      let text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

      let parsed: any;
      try { parsed = JSON.parse(text); }
      catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("JSON inválido na resposta do Gemini");
        parsed = JSON.parse(match[0]);
      }

      // Salvar campanha (sem armazenar as imagens)
      const campaign = createMarketingCampaign({
        restaurantId,
        title: parsed.title ?? "Campanha gerada por IA",
        targetSegment: (parsed.targetPlatforms ?? ["instagram"]).join(", "),
        headline: parsed.headline ?? "",
        copy: parsed.copy ?? "",
        hashtags: parsed.hashtags ?? [],
        callToAction: parsed.callToAction ?? "",
        imageSuggestion: parsed.imageSuggestion ?? "",
        tone: parsed.tone ?? "descontraído",
        sourceImages: images.length,
      });

      logger.info({ model, campaignId: campaign.id }, "Marketing campaign OK");
      res.json({
        ...parsed,
        campaignId: campaign.id,
        savedAt: campaign.generatedAt,
        model,
      });
      return;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Marketing campaign attempt failed");
    }
  }

  logger.error({ err: lastError }, "All marketing providers failed");
  res.status(503).json({ error: "Geração de campanha indisponível. Tente novamente." });
});

// ─── GET /marketing/campaigns — lista campanhas salvas ───────────────────────
router.get("/marketing/campaigns", requireOwnerAuth, (req, res) => {
  const { restaurantId } = req.query as { restaurantId?: string };
  const list = marketingCampaigns
    .filter(c => restaurantId ? c.restaurantId === restaurantId : true)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  res.json(list);
});

// ─── DELETE /marketing/campaigns/:id — remove campanha ───────────────────────
router.delete("/marketing/campaigns/:id", requireOwnerAuth, (req, res): void => {
  const id = String(req.params.id);
  const deleted = deleteMarketingCampaign(id);
  if (!deleted) {
    res.status(404).json({ error: `Campanha '${id}' não encontrada` });
    return;
  }
  res.json({ success: true, id });
});

export default router;
