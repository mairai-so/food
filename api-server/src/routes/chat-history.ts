import { Router, type IRouter } from "express";
import { requireOwnerAuth } from "./auth";
import { logger } from "../lib/logger";
import { query as dbQuery, execute as dbExec } from "../lib/db";
import {
  userChats,
  restaurantSharedChat,
  setRestaurantSharedChat,
  type ChatMessage,
} from "../lib/data-store";

const router: IRouter = Router();

// ─── System prompts ───────────────────────────────────────────────────────────

const CLIENT_SYSTEM_PROMPT = `Você é a IA Personal Food da MIAR AI/FOOD, um assistente gastronômico inteligente e amigável.
Você ajuda os clientes a:
- Descobrir restaurantes baseado em preferências, orçamento, número de pessoas e ocasião
- Fazer recomendações personalizadas de pratos
- Entender o sistema de pré-pedido e reserva de mesa
- Tirar dúvidas sobre o funcionamento do aplicativo

REGRAS ABSOLUTAS (nunca quebre estas regras):
1. SEMPRE diga a verdade e responda a pergunta na íntegra — jamais omita informações relevantes
2. Em caso de empate entre restaurantes, apresente AMBAS as opções com clareza e transparência
3. Nunca favoreça um restaurante sobre outro por qualquer motivo que não seja fatos reais
4. Se não souber a resposta, diga claramente que não sabe — nunca invente dados
5. Explique SEMPRE o motivo de cada recomendação (preço, tempo, distância, etc.)

Responda sempre em português brasileiro, de forma calorosa, descontraída e entusiasmada com comida.
Seja específico nas recomendações. Use linguagem amigável e acolhedora.
Quando o usuário quiser buscar restaurantes, sugira que ele clique em "Ver Restaurantes".
Mantenha respostas concisas (máximo 3 parágrafos) e use emojis com moderação.`;

const RESTAURANT_SYSTEM_PROMPT = `Você é o Assistente Operacional MIAR, especializado em gestão de restaurantes.
Você ajuda a equipe do restaurante a:
- Tomar decisões operacionais em tempo real (mesas, pedidos, cozinha, fluxo)
- Sugerir ações para melhorar atendimento e eficiência
- Responder dúvidas sobre o sistema MIAR AI/FOOD
- Analisar situações do salão, estoque e equipe

REGRA ABSOLUTA: SEMPRE DIGA A VERDADE E RESPONDA A PERGUNTA NA ÍNTEGRA.
Se não souber algo, diga claramente. Nunca invente dados ou números.

Responda em português brasileiro, de forma direta e prática.
A equipe está no meio do serviço — seja conciso (máximo 2 parágrafos).
Use linguagem profissional mas acessível. Não use emojis excessivos.`;

// ─── AI helpers (Groq → Gemini → Mistral) ────────────────────────────────────

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
}

const groqKeys = parseKeys(process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY);
const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);
const mistralKeys = parseKeys(process.env.MISTRAL_API_KEYS ?? process.env.MISTRAL_API_KEY);

let groqIdx = 0, geminiIdx = 0, mistralIdx = 0;

async function callGroq(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];
  const attempts = Math.max(groqKeys.length, 1) * models.length;
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    if (!groqKeys.length) throw new Error("No GROQ_API_KEYS configured");
    const key = groqKeys[groqIdx++ % groqKeys.length];
    const model = models[i % models.length];
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          max_tokens: 512,
          temperature: 0.8,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        if ([429, 401].includes(res.status)) throw new Error(`Groq ${res.status}`);
        throw new Error(`Groq error ${res.status}: ${err}`);
      }
      const data = (await res.json()) as any;
      return data.choices[0].message.content as string;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Groq attempt failed");
    }
  }
  throw lastError ?? new Error("All Groq keys/models failed");
}

async function callGemini(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  const attempts = Math.max(geminiKeys.length, 1) * models.length;
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    if (!geminiKeys.length) throw new Error("No GEMINI_API_KEYS configured");
    const key = geminiKeys[geminiIdx++ % geminiKeys.length];
    const model = models[i % models.length];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: 512, temperature: 0.8 },
          }),
        }
      );
      if (!res.ok) {
        if ([429, 401, 403].includes(res.status)) throw new Error(`Gemini ${res.status}`);
        throw new Error(`Gemini error ${res.status}`);
      }
      const data = (await res.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty Gemini response");
      return text;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Gemini attempt failed");
    }
  }
  throw lastError ?? new Error("All Gemini keys/models failed");
}

async function callMistral(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const models = ["mistral-small-latest", "open-mistral-7b"];
  const attempts = Math.max(mistralKeys.length, 1) * models.length;
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    if (!mistralKeys.length) throw new Error("No MISTRAL_API_KEYS configured");
    const key = mistralKeys[mistralIdx++ % mistralKeys.length];
    const model = models[i % models.length];
    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          max_tokens: 512,
          temperature: 0.8,
        }),
      });
      if (!res.ok) {
        if ([429, 401].includes(res.status)) throw new Error(`Mistral ${res.status}`);
        throw new Error(`Mistral error ${res.status}`);
      }
      const data = (await res.json()) as any;
      return data.choices[0].message.content as string;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Mistral attempt failed");
    }
  }
  throw lastError ?? new Error("All Mistral keys/models failed");
}

async function callAI(systemPrompt: string, messages: ChatMessage[]): Promise<{ message: string; provider: string }> {
  const providers = [
    { name: "groq",    fn: () => callGroq(systemPrompt, messages) },
    { name: "gemini",  fn: () => callGemini(systemPrompt, messages) },
    { name: "mistral", fn: () => callMistral(systemPrompt, messages) },
  ];
  let lastErr: Error | null = null;
  for (const p of providers) {
    try {
      const message = await p.fn();
      return { message, provider: p.name };
    } catch (err) {
      lastErr = err as Error;
      logger.warn({ provider: p.name, err: (err as Error).message }, "Provider failed");
    }
  }
  throw lastErr ?? new Error("All AI providers exhausted");
}

// ─── Client user chat history (persistido no PostgreSQL) ─────────────────────

/** GET /api/chat/history/:userId — retorna histórico do usuário do banco */
router.get("/chat/history/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }

  // Tenta banco primeiro, cai no in-memory se banco não disponível
  try {
    const rows = await dbQuery<{ role: string; content: string }>(
      "SELECT role, content FROM chat_history WHERE user_id = $1 ORDER BY created_at ASC LIMIT 50",
      [userId]
    );
    if (rows.length > 0) {
      // Sincroniza memória com banco
      userChats.set(userId, rows as ChatMessage[]);
      res.json({ messages: rows }); return;
    }
  } catch (e) { logger.warn({ e }, "DB chat history fallback to memory"); }

  res.json({ messages: userChats.get(userId) ?? [] });
});

/** POST /api/chat/user — envia mensagem, obtém resposta da IA, salva histórico no banco */
router.post("/chat/user", async (req, res): Promise<void> => {
  const { userId, message } = req.body as { userId: string; message: string };
  if (!userId || !message?.trim()) {
    res.status(400).json({ error: "userId and message are required" });
    return;
  }

  const history = userChats.get(userId) ?? [];
  const updated: ChatMessage[] = [...history, { role: "user", content: message }];

  try {
    const { message: reply, provider } = await callAI(CLIENT_SYSTEM_PROMPT, updated);
    const final: ChatMessage[] = [...updated, { role: "assistant", content: reply }];
    userChats.set(userId, final.slice(-50));

    // Persiste no banco (não bloqueia a resposta)
    dbExec(
      "INSERT INTO chat_history (user_id, role, content) VALUES ($1, $2, $3)",
      [userId, "user", message]
    ).catch((e) => logger.warn({ e }, "DB insert user msg failed"));
    dbExec(
      "INSERT INTO chat_history (user_id, role, content) VALUES ($1, $2, $3)",
      [userId, "assistant", reply]
    ).catch((e) => logger.warn({ e }, "DB insert assistant msg failed"));

    logger.info({ userId, provider }, "User chat OK");
    res.json({ message: reply, provider });
  } catch (err) {
    logger.error({ err, userId }, "User chat failed");
    res.status(503).json({
      error: "IA temporariamente indisponível.",
      message: "Desculpe, estou com dificuldades agora. Explore os restaurantes disponíveis! 🍽️",
      provider: "fallback",
    });
  }
});

/** DELETE /api/chat/history/:userId — apaga histórico do usuário */
router.delete("/chat/history/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  userChats.delete(userId);
  await dbExec("DELETE FROM chat_history WHERE user_id = $1", [userId]).catch(() => {});
  res.json({ ok: true });
});

// ─── Restaurant shared chat (persistido no PostgreSQL) ────────────────────────

/** GET /api/restaurant-chat — retorna conversa compartilhada */
router.get("/restaurant-chat", requireOwnerAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await dbQuery<{ role: string; content: string }>(
      "SELECT role, content FROM restaurant_chat ORDER BY created_at ASC LIMIT 100"
    );
    if (rows.length > 0) {
      setRestaurantSharedChat(rows as ChatMessage[]);
      res.json({ messages: rows }); return;
    }
  } catch (e) { logger.warn({ e }, "DB restaurant chat fallback to memory"); }
  res.json({ messages: restaurantSharedChat });
});

/** POST /api/restaurant-chat — envia mensagem, obtém resposta da IA */
router.post("/restaurant-chat", requireOwnerAuth, async (req, res): Promise<void> => {
  const { message } = req.body as { message: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const updated: ChatMessage[] = [...restaurantSharedChat, { role: "user", content: message }];

  try {
    const { message: reply, provider } = await callAI(RESTAURANT_SYSTEM_PROMPT, updated);
    const final: ChatMessage[] = [...updated, { role: "assistant", content: reply }];
    setRestaurantSharedChat(final.slice(-100));

    // Persiste no banco
    dbExec("INSERT INTO restaurant_chat (role, content) VALUES ($1, $2)", ["user", message])
      .catch((e) => logger.warn({ e }, "DB insert restaurant user msg failed"));
    dbExec("INSERT INTO restaurant_chat (role, content) VALUES ($1, $2)", ["assistant", reply])
      .catch((e) => logger.warn({ e }, "DB insert restaurant assistant msg failed"));

    logger.info({ provider }, "Restaurant chat OK");
    res.json({ message: reply, provider });
  } catch (err) {
    logger.error({ err }, "Restaurant chat failed");
    res.status(503).json({
      error: "IA temporariamente indisponível. Tente novamente.",
      message: "Estou com dificuldades técnicas. Tente novamente em instantes.",
      provider: "fallback",
    });
  }
});

/** DELETE /api/restaurant-chat — limpa conversa compartilhada */
router.delete("/restaurant-chat", requireOwnerAuth, async (_req, res): Promise<void> => {
  setRestaurantSharedChat([]);
  await dbExec("DELETE FROM restaurant_chat").catch(() => {});
  res.json({ ok: true });
});

export default router;
