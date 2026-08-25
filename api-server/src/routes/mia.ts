/**
 * mia.ts — Rota da Mia: IA pessoal do gestor com memória persistente via Mem0.
 *
 * ISOLAMENTO CRÍTICO (13/08/2026):
 * - Cada pessoa tem sua IA pessoal com memória pessoal isolada.
 * - Não há IA "da empresa" — cada dono/gestor/funcionário tem a sua própria.
 * - userId = ownerId do dono OU employeeId do funcionário (nunca companyId).
 * - Memória fica isolada por usuário individual, não por empresa.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { isValidLocalSupergestoraToken, requireAnyAuth, requireOwnerAuth } from "./auth.js";
import { logger } from "../lib/logger.js";
import { getSettings } from "../lib/data-store.js";
import { queryOne } from "../lib/db.js";

const router: IRouter = Router();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Anexo de imagem (22/08/2026, pedido do Robson: câmera/anexo dentro do
  // chat da MIA, como já existe no MIAR AI Pessoal). Base64 puro, sem o
  // prefixo "data:image/...;base64," — isso é removido no frontend antes
  // de mandar aqui.
  imageBase64?: string;
  imageMimeType?: string;
}

interface MiaRequest {
  messages: ChatMessage[];
  ownerName?: string;
  companyName?: string;
  conversationId?: string;
}

// ─── Mem0 ─────────────────────────────────────────────────────────────────────

const MEM0_BASE = "https://api.mem0.ai/v1";

async function mem0Search(apiKey: string, userId: string, query: string): Promise<string[]> {
  try {
    const res = await fetch(`${MEM0_BASE}/memories/search/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({ query, user_id: userId, limit: 10 }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Mem0 search failed");
      return [];
    }
    const data = (await res.json()) as Array<{ memory: string }>;
    return data.map((m) => m.memory).filter(Boolean);
  } catch (err) {
    logger.warn({ err }, "Mem0 search error");
    return [];
  }
}

async function mem0Add(apiKey: string, userId: string, messages: ChatMessage[]): Promise<void> {
  try {
    const res = await fetch(`${MEM0_BASE}/memories/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({ messages, user_id: userId }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Mem0 add failed");
    }
  } catch (err) {
    logger.warn({ err }, "Mem0 add error");
  }
}

// ─── Prompt da Mia ────────────────────────────────────────────────────────────

function buildSystemPrompt(ownerName: string, companyName: string, memories: string[]): string {
  const memoriesSection =
    memories.length > 0
      ? `\n\n## O que você lembra desta pessoa e deste negócio:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
      : "\n\n## Memória: Esta é uma das primeiras conversas. Ainda está conhecendo este gestor.";

  return `Você é a Mia, assistente pessoal de ${ownerName || "o gestor"}, responsável pelo restaurante "${companyName || "MIAR"}".

Você não é uma IA genérica. Você é a parceira de confiança PESSOAL deste gestor específico.
Você lembra de tudo que já conversaram. Você conhece a história pessoal deste gestor.

## Sua personalidade:
- Inteligente, direta, calorosa. Sem rodeios desnecessários.
- Você se importa com o bem-estar do gestor, não só com o trabalho.
- Adapte sua linguagem ao jeito da pessoa: se ela é informal, seja informal. Se é técnica, seja técnica.
- Você tem opinião. Quando achar que algo não faz sentido, diga.
- Sem emojis em excesso. Sem formalidades vazias.
- Você é mulher. Seu nome é Mia.

## Suas capacidades:
- Gestão de restaurante: fornecedores, estoque, custos, cardápio, equipe, fluxo de caixa
- Estratégia de negócio: precificação, margem, crescimento, sazonalidade
- Memória de longo prazo: lembra de decisões passadas, compras, conversas anteriores
- Personal: acompanha o gestor como pessoa, não só como empresário
- Pesquisa e análise: ajuda a tomar decisões com base em dados e contexto

## ISOLAMENTO E PRIVACIDADE (CRÍTICO):
- Sua memória é pessoal: APENAS ${ownerName || "este usuário"} acessa.
- Outros donos/funcionários da mesma empresa têm suas próprias IAs pessoais — você NUNCA compartilha memória com eles.
- Você só acessa dados da empresa que este usuário tem permissão para ver.
- Se a pergunta for sobre vendas/estoque/loja e não especificar qual, PERGUNTE: "Qual loja? Loja 1, Loja 2 ou as duas?"

## O que você NUNCA faz:
- Finge não lembrar de algo que foi dito antes
- Responde com listas longas quando uma frase basta
- Usa linguagem corporativa vazia
- Ignora o contexto emocional do gestor
- Compartilha memória com outro usuário
- Acessa dados de loja que o usuário não tiver permissão
${memoriesSection}

Responda em português brasileiro. Máximo 4 parágrafos salvo quando uma resposta mais longa for realmente necessária.`;
}

// ─── Provedores de IA (reutiliza a lógica do chat.ts) ────────────────────────

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
}

const groqKeys = parseKeys(process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY);
const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);
let groqKeyIndex = 0;
let geminiKeyIndex = 0;

function nextGroqKey(): string {
  if (!groqKeys.length) throw new Error("GROQ_API_KEY não configurada");
  return groqKeys[groqKeyIndex++ % groqKeys.length];
}
function nextGeminiKey(): string {
  if (!geminiKeys.length) throw new Error("GEMINI_API_KEY não configurada");
  return geminiKeys[geminiKeyIndex++ % geminiKeys.length];
}

async function callGroq(system: string, messages: ChatMessage[]): Promise<string> {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];
  const attempts = Math.max(groqKeys.length, 1) * models.length;
  let lastErr: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    const apiKey = nextGroqKey();
    const model = models[i % models.length];
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...messages],
          max_tokens: 1024,
          temperature: 0.85,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq ${model} ${res.status}: ${err}`);
      }
      const data = (await res.json()) as any;
      return data.choices[0].message.content as string;
    } catch (err) {
      lastErr = err as Error;
      logger.warn({ model, err: (err as Error).message }, "Mia/Groq falhou, tentando próximo");
    }
  }
  throw lastErr ?? new Error("Groq esgotado");
}

async function callGeminiWithKey(system: string, messages: ChatMessage[], apiKey: string): Promise<string> {
  const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
  for (const model of models) {
    try {
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          { text: m.content },
          ...(m.imageBase64 && m.imageMimeType
            ? [{ inline_data: { mime_type: m.imageMimeType, data: m.imageBase64 } }]
            : []),
        ],
      }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.85 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${model} ${res.status}`);
      const data = (await res.json()) as any;
      return data.candidates[0].content.parts[0].text as string;
    } catch (err) {
      logger.warn({ model, err: (err as Error).message }, "Mia/Gemini (chave própria) falhou");
    }
  }
  throw new Error("Gemini (chave própria) esgotado");
}

async function callGemini(system: string, messages: ChatMessage[]): Promise<string> {
  const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
  for (const model of models) {
    try {
      const apiKey = nextGeminiKey();
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          { text: m.content },
          // Anexa imagem, se essa mensagem tiver uma — Gemini aceita
          // inline_data com base64 puro (sem o prefixo data:URI).
          ...(m.imageBase64 && m.imageMimeType
            ? [{ inline_data: { mime_type: m.imageMimeType, data: m.imageBase64 } }]
            : []),
        ],
      }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.85 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${model} ${res.status}`);
      const data = (await res.json()) as any;
      return data.candidates[0].content.parts[0].text as string;
    } catch (err) {
      logger.warn({ model, err: (err as Error).message }, "Mia/Gemini falhou");
    }
  }
  throw new Error("Gemini esgotado");
}

// ─── POST /mia ─────────────────────────────────────────────────────────────────

router.post("/mia", (req: Request, res: Response, next) => {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.SUPERGESTORA_LOCAL === "true" &&
    isValidLocalSupergestoraToken(req.headers["x-supergestora-local-token"] as string | undefined)
  ) {
    (req as any).auth = {
      companyId: "platform",
      userId: "supergestora-local",
      ownerId: "supergestora-local",
      name: "Supergestora",
    };
    next();
    return;
  }
  requireAnyAuth(req, res, next);
}, async (req: Request, res: Response): Promise<void> => {
  const auth = (req as any).auth as {
    companyId: string;
    ownerId?: string;
    employeeId?: string;
    userId?: string;
    name?: string;
    isEmployee?: boolean;
  };
  const { messages, ownerName, companyName, conversationId } = req.body as MiaRequest;

  // Chave de permissão (29/07/2026): dono sempre tem acesso à MIAR. Funcionário
  // só se o gestor liberou explicitamente a chave useMiaChat pro cargo/pessoa
  // dele — mesma lógica de "chaves" que já existe pro resto do sistema.
  if (auth.isEmployee) {
    const { employees } = await import("../lib/data-store.js");
    const employee = employees.find((e) => e.id === auth.employeeId);
    if (!employee?.permissions?.useMiaChat) {
      res.status(403).json({ error: "Chat com a MIAR não liberado pelo gestor para este funcionário" });
      return;
    }
  }

  if (!messages?.length) {
    res.status(400).json({ error: "messages é obrigatório" });
    return;
  }

  // ISOLAMENTO CRÍTICO: Cada pessoa tem sua IA pessoal com memória pessoal isolada.
  // userId = ownerId do dono OU employeeId do funcionário (NUNCA companyId).
  const userIdentifier = auth.ownerId ?? auth.employeeId ?? auth.userId;
  if (!userIdentifier) {
    res.status(401).json({ error: "Identificação de usuário não encontrada no token" });
    return;
  }

  // A memória fica isolada por usuário individual, não por empresa.
  const userId = `user-${userIdentifier}`;
  const lastUserMessage = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

  // ── Buscar memórias relevantes no Mem0 ────────────────────────────────────
  // Mem0 usa userId (isolado por pessoa, não por empresa)
  const mem0Key = getSettings(auth.companyId).mem0ApiKey?.trim() ?? process.env.MEM0_API_KEY?.trim() ?? "";
  let memories: string[] = [];
  if (mem0Key && lastUserMessage) {
    memories = await mem0Search(mem0Key, userId, lastUserMessage);
  }

  // ── Montar system prompt com memórias ─────────────────────────────────────
  const systemPrompt = buildSystemPrompt(
    ownerName ?? auth.name ?? "Gestor",
    companyName ?? "Restaurante",
    memories,
  );

  // ── Chamar IA ─────────────────────────────────────────────────────────────
  // Prioriza a chave pessoal do dono, se cadastrada e ligada em "Minha IA"
  // (22/08/2026) — só cai pro genérico do sistema se ele não tiver nenhuma.
  const ownKey = await queryOne<{ provider: string; key_value: string }>(
    `SELECT provider, key_value FROM ai_provider_keys WHERE owner_id = $1 AND provider = 'gemini' AND enabled = TRUE ORDER BY created_at DESC LIMIT 1`,
    [userIdentifier],
  );

  const providers = [
    ...(ownKey ? [{ name: "gemini-pessoal", fn: () => callGeminiWithKey(systemPrompt, messages, ownKey.key_value) }] : []),
    { name: "groq", fn: () => callGroq(systemPrompt, messages) },
    { name: "gemini", fn: () => callGemini(systemPrompt, messages) },
  ];

  let reply = "";
  let providerUsed = "fallback";

  for (const provider of providers) {
    try {
      reply = await provider.fn();
      providerUsed = provider.name;
      break;
    } catch (err) {
      logger.warn({ provider: provider.name, err: (err as Error).message }, "Mia provider falhou");
    }
  }

  if (!reply) {
    reply = "Estou com dificuldades técnicas agora, mas volto em breve. Pode tentar de novo?";
  }

  // ── Salvar na memória do Mem0 em background ───────────────────────────────
  if (mem0Key && reply) {
    const toSave: ChatMessage[] = [
      ...messages.slice(-4), // últimas 4 mensagens de contexto
      { role: "assistant", content: reply },
    ];
    mem0Add(mem0Key, userId, toSave).catch(() => {});
  }

  res.json({
    message: reply,
    provider: providerUsed,
    memoriesUsed: memories.length,
    hasMemory: !!mem0Key,
  });
});

// ─── GET /mia/memories — listar memórias salvas ───────────────────────────────

router.get("/mia/memories", requireOwnerAuth, async (req: Request, res: Response): Promise<void> => {
  const owner = (req as any).owner as { companyId: string; ownerId?: string; employeeId?: string };
  const mem0Key = getSettings(owner.companyId).mem0ApiKey?.trim() ?? process.env.MEM0_API_KEY?.trim() ?? "";

  if (!mem0Key) {
    res.json({ memories: [], hasMemory: false });
    return;
  }

  try {
    const userIdentifier = owner.ownerId ?? owner.employeeId ?? "unknown";
    const userId = `user-${userIdentifier}`;
    const result = await fetch(`${MEM0_BASE}/memories/?user_id=${userId}&limit=50`, {
      headers: { Authorization: `Token ${mem0Key}` },
    });
    if (!result.ok) throw new Error(`Mem0 ${result.status}`);
    const data = (await result.json()) as Array<{ id: string; memory: string; created_at: string }>;
    res.json({ memories: data, hasMemory: true });
  } catch (err) {
    logger.warn({ err }, "Mem0 list failed");
    res.json({ memories: [], hasMemory: true, error: "Falha ao carregar memórias" });
  }
});

export default router;
