import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireClientAuth } from "./auth.js";
import {
  getNutriChat,
  setNutriChat,
  getNutriProfile,
  setNutriProfile,
  deleteNutriProfile,
  type ChatMessage,
  type NutriProfile,
} from "../lib/data-store";

const router: IRouter = Router();

// Trava geral: chat e perfil nutricional são dados sensíveis de um cliente
// específico. Antes, qualquer pessoa na internet conseguia ler/apagar o
// perfil e o histórico de qualquer usuário só sabendo o userId.
router.use(requireClientAuth);

function pertenceAoCliente(req: any, userId: string): boolean {
  return req.clientId === userId;
}

const NUTRI_SYSTEM_PROMPT = `Você é o Assistente Alimentar do NUTRI SAÚDE (MIAR), um assistente de apoio para alimentação, nutrição e bem-estar.
Você pode:
- Responder perguntas sobre alimentos e calorias
- Ajudar a comparar alimentos e refeições
- Sugerir refeições e substituições alimentares
- Ajudar a organizar uma rotina ou dieta já prescrita por um profissional
- Ajudar o usuário a entender informações nutricionais
- Apoiar objetivos como emagrecimento, ganho de massa, academia ou alimentação equilibrada

REGRAS ABSOLUTAS (nunca quebre estas regras):
1. Você é uma ferramenta de apoio e NÃO substitui nutricionista, médico, psicólogo ou psiquiatra.
2. NUNCA diagnostique. Não afirme que um alimento "causa" uma doença ou condição — use linguagem de possibilidade.
3. Se o usuário relatar sintomas, condições de saúde ou sinais de sofrimento psicológico/comportamento alimentar preocupante, oriente-o a procurar o profissional adequado, com empatia.
4. Sempre diga a verdade; se não souber algo, diga claramente.
5. Nunca incentive restrição extrema, jejuns perigosos ou práticas de risco.

Responda sempre em português brasileiro, de forma acolhedora, clara e objetiva. Máximo 3 parágrafos, emojis com moderação.`;

interface NutriContextInput {
  goal?: string;
  goalOther?: string;
  healthConditions?: string[];
  healthNotes?: string;
  aboutYou?: string;
  symptoms?: string[];
  triggerFoods?: string[];
  routineNotes?: string;
}

function buildContextBlock(p?: NutriProfile): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.goal) parts.push(`Objetivo: ${p.goal}${p.goal === "Outro" && p.goalOther ? ` (${p.goalOther})` : ""}`);
  if (p.healthConditions?.length) parts.push(`Condições informadas: ${p.healthConditions.join(", ")}`);
  if (p.healthNotes) parts.push(`Orientações/observações de saúde informadas pelo usuário: ${p.healthNotes}`);
  if (p.aboutYou) parts.push(`Sobre o usuário: ${p.aboutYou}`);
  if (p.symptoms?.length) parts.push(`Sintomas percebidos pelo usuário: ${p.symptoms.join(", ")}`);
  if (p.triggerFoods?.length) parts.push(`Alimentos que o usuário percebe como gatilho: ${p.triggerFoods.join(", ")}`);
  if (p.routineNotes) parts.push(`Notas de rotina/bem-estar: ${p.routineNotes}`);
  if (!parts.length) return "";
  return `\n\n[Contexto fornecido voluntariamente pelo usuário — use apenas como apoio, nunca como diagnóstico:\n${parts.join("\n")}]`;
}

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
          temperature: 0.7,
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
      logger.warn({ model, err: (err as Error).message }, "Groq attempt failed (nutri)");
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
            generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
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
      logger.warn({ model, err: (err as Error).message }, "Gemini attempt failed (nutri)");
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
          temperature: 0.7,
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
      logger.warn({ model, err: (err as Error).message }, "Mistral attempt failed (nutri)");
    }
  }
  throw lastError ?? new Error("All Mistral keys/models failed");
}

async function callAI(systemPrompt: string, messages: ChatMessage[]): Promise<{ message: string; provider: string }> {
  const providers = [
    { name: "groq", fn: () => callGroq(systemPrompt, messages) },
    { name: "gemini", fn: () => callGemini(systemPrompt, messages) },
    { name: "mistral", fn: () => callMistral(systemPrompt, messages) },
  ];
  let lastErr: Error | null = null;
  for (const p of providers) {
    try {
      const message = await p.fn();
      return { message, provider: p.name };
    } catch (err) {
      lastErr = err as Error;
      logger.warn({ provider: p.name, err: (err as Error).message }, "Nutri provider failed");
    }
  }
  throw lastErr ?? new Error("All AI providers exhausted");
}

router.get("/nutri/chat/history/:userId", (req, res) => {
  const { userId } = req.params;
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }
  if (!pertenceAoCliente(req, userId)) { res.status(403).json({ error: "Acesso negado" }); return; }
  res.json({ messages: getNutriChat(userId) });
});

router.post("/nutri/chat/user", async (req, res): Promise<void> => {
  const { userId, message } = req.body as { userId: string; message: string };
  if (!userId || !message?.trim()) {
    res.status(400).json({ error: "userId and message are required" });
    return;
  }
  if (!pertenceAoCliente(req, userId)) { res.status(403).json({ error: "Acesso negado" }); return; }

  const history = getNutriChat(userId);
  const updated: ChatMessage[] = [...history, { role: "user", content: message }];
  const profile = getNutriProfile(userId);
  const systemPrompt = NUTRI_SYSTEM_PROMPT + buildContextBlock(profile);

  try {
    const { message: reply, provider } = await callAI(systemPrompt, updated);
    const final: ChatMessage[] = [...updated, { role: "assistant", content: reply }];
    setNutriChat(userId, final.slice(-50));
    logger.info({ userId, provider }, "Nutri chat OK");
    res.json({ message: reply, provider });
  } catch (err) {
    logger.error({ err, userId }, "Nutri chat failed");
    res.status(503).json({
      error: "IA temporariamente indisponível.",
      message: "No momento estou com dificuldades para responder. Tente novamente em instantes. 🥗",
      provider: "fallback",
    });
  }
});

router.delete("/nutri/chat/history/:userId", (req, res) => {
  const { userId } = req.params;
  if (!pertenceAoCliente(req, userId)) { res.status(403).json({ error: "Acesso negado" }); return; }
  setNutriChat(userId, []);
  res.json({ ok: true });
});

router.get("/nutri/profile/:userId", (req, res) => {
  const { userId } = req.params;
  if (!pertenceAoCliente(req, userId)) { res.status(403).json({ error: "Acesso negado" }); return; }
  res.json({ profile: getNutriProfile(userId) ?? null });
});

router.put("/nutri/profile/:userId", (req, res) => {
  const { userId } = req.params;
  if (!pertenceAoCliente(req, userId)) { res.status(403).json({ error: "Acesso negado" }); return; }
  const input = req.body as NutriContextInput & { onboardingSeen?: boolean };
  const profile: NutriProfile = { ...input, updatedAt: new Date().toISOString() };
  setNutriProfile(userId, profile);
  res.json({ ok: true, profile });
});

router.delete("/nutri/profile/:userId", (req, res) => {
  const { userId } = req.params;
  if (!pertenceAoCliente(req, userId)) { res.status(403).json({ error: "Acesso negado" }); return; }
  deleteNutriProfile(userId);
  res.json({ ok: true });
});

export default router;
