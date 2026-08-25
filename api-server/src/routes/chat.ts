import { Router, type IRouter } from "express";
import { requireAnyAuth } from "./auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SYSTEM_PROMPT = `Você é a IA Personal Food da MIAR AI/FOOD, um assistente gastronômico inteligente e amigável.
Você ajuda os clientes a:
- Descobrir restaurantes baseado em preferências, orçamento, número de pessoas e ocasião
- Fazer recomendações personalizadas de pratos
- Entender o sistema de pré-pedido e reserva de mesa
- Tirar dúvidas sobre o funcionamento do aplicativo

Responda sempre em português brasileiro, de forma calorosa, descontraída e entusiasmada com comida.
Seja específico nas recomendações. Use linguagem amigável e acolhedora.
Quando o usuário quiser buscar restaurantes, sugira que ele clique em "Ver Restaurantes".
Mantenha respostas concisas (máximo 3 parágrafos) e use emojis com moderação.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─── Key Rotation ─────────────────────────────────────────────────────────────

/** Parse a multi-key env var (comma or newline separated), return non-empty trimmed keys */
function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

const groqKeys = parseKeys(process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY);
const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);

let groqKeyIndex = 0;
let geminiKeyIndex = 0;

function nextGroqKey(): string {
  if (groqKeys.length === 0) throw new Error("No GROQ_API_KEYS configured");
  const key = groqKeys[groqKeyIndex % groqKeys.length];
  groqKeyIndex++;
  return key;
}

function nextGeminiKey(): string {
  if (geminiKeys.length === 0) throw new Error("No GEMINI_API_KEYS configured");
  const key = geminiKeys[geminiKeyIndex % geminiKeys.length];
  geminiKeyIndex++;
  return key;
}

// ─── GROQ ─────────────────────────────────────────────────────────────────────

async function callGroq(messages: Message[]): Promise<string> {
  const models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
  ];

  // Try each available GROQ key, rotating on rate limit / auth errors
  const attempts = Math.max(groqKeys.length, 1) * models.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const apiKey = nextGroqKey();
    const model = models[attempt % models.length];

    try {
      logger.info({ keyPrefix: apiKey.slice(0, 8), model }, "Trying Groq");

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          max_tokens: 512,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        // 429 = rate limit, 401 = bad key — try next
        if (response.status === 429 || response.status === 401) {
          throw new Error(`Groq ${model} ${response.status}: ${err}`);
        }
        throw new Error(`Groq ${model} error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      return data.choices[0].message.content as string;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, attempt, err: (err as Error).message }, "Groq attempt failed, rotating");
    }
  }

  throw lastError ?? new Error("All Groq keys/models failed");
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(messages: Message[]): Promise<string> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMsg = messages[messages.length - 1];

  const attempts = Math.max(geminiKeys.length, 1) * models.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const apiKey = nextGeminiKey();
    const model = models[attempt % models.length];

    try {
      logger.info({ keyPrefix: apiKey.slice(0, 8), model }, "Trying Gemini");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              ...history,
              { role: "user", parts: [{ text: lastMsg.content }] },
            ],
            generationConfig: { maxOutputTokens: 512, temperature: 0.8 },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429 || response.status === 401 || response.status === 403) {
          throw new Error(`Gemini ${model} ${response.status}: ${err}`);
        }
        throw new Error(`Gemini ${model} error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      const candidate = data.candidates?.[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        throw new Error(`Gemini ${model} empty response`);
      }
      return candidate.content.parts[0].text as string;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, attempt, err: (err as Error).message }, "Gemini attempt failed, rotating");
    }
  }

  throw lastError ?? new Error("All Gemini keys/models failed");
}

// ─── Mistral Fallback ─────────────────────────────────────────────────────────

async function callMistral(messages: Message[]): Promise<string> {
  const apiKey = (process.env.MISTRAL_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 512,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Mistral error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  return data.choices[0].message.content as string;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/chat", requireAnyAuth, async (req, res): Promise<void> => {
  const { messages, restaurantContext } = req.body as {
    messages: Message[];
    restaurantContext?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const messagesWithContext: Message[] = restaurantContext
    ? [
        ...messages.slice(0, -1),
        {
          ...messages[messages.length - 1],
          content: `[Contexto: ${restaurantContext}]\n\n${messages[messages.length - 1].content}`,
        },
      ]
    : messages;

  const providers = [
    { name: "groq", fn: () => callGroq(messagesWithContext) },
    { name: "gemini", fn: () => callGemini(messagesWithContext) },
    { name: "mistral", fn: () => callMistral(messagesWithContext) },
  ];

  let lastErr: Error | null = null;

  for (const provider of providers) {
    try {
      const message = await provider.fn();
      logger.info({ provider: provider.name }, "Chat response OK");
      res.json({ message, provider: provider.name });
      return;
    } catch (err) {
      lastErr = err as Error;
      logger.warn({ provider: provider.name, err: (err as Error).message }, "Provider failed");
    }
  }

  logger.error({ err: lastErr }, "All AI providers exhausted");
  res.status(503).json({
    error: "Serviço de IA temporariamente indisponível. Tente novamente.",
    message: "Desculpe, estou com dificuldades técnicas agora. Que tal explorar os restaurantes disponíveis? 🍽️",
    provider: "fallback",
  });
});

export default router;
