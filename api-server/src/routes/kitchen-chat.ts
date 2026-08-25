/**
 * /api/kitchen/chat — Assistente de voz operacional da MIAR para a Cozinha.
 *
 * Diferente do /api/chat (descoberta de restaurantes para clientes), este
 * endpoint é exclusivo para profissionais da cozinha. Sempre retorna JSON
 * estruturado com o protocolo de resposta da MIAR.
 */

import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { addRecado, getSettings } from "../lib/data-store.js";
import { requireAnyAuth } from "./auth.js";

const router: IRouter = Router();

// ─── Protocolo de Resposta da MIAR ──────────────────────────────────────────
//
// Todos os tipos possíveis de resposta:
//
//   answer              → resposta informativa sem ação
//   action              → comando reconhecido e ação a executar no frontend
//   confirmation_required → precisa confirmação antes de executar
//   batch               → mais de um comando distinto na mesma fala; items[]
//                         com um response object (answer/action/
//                         confirmation_required/unknown) por comando
//   ignore              → fala captada não tinha conteúdo dirigível (ruído/tosse)
//   unknown             → parecia um comando, mas não foi reconhecido
//   error               → erro interno
//
// Ações suportadas nesta etapa:
//   change_order_status → { orderId, newStatus }
//   create_timer        → { label, durationMinutes }
//   cancel_timer        → { label }
//   add_timer_time      → { label, extraMinutes }
//   list_timers         → {} (sem payload)
//   query_orders        → {} (dados já na resposta message)
//   log_prep             → { texto } — registra em texto livre o que o profissional
//                           disse que está preparando (vira um recado interno)

// ─── System Prompt ───────────────────────────────────────────────────────────

const KITCHEN_SYSTEM_PROMPT = `Você é MIAR, a IA operacional integrada ao sistema de gestão de cozinha do restaurante MIAR AI/FOOD. Você é a aliada direta do chefe de cozinha, com as mãos ocupadas com comida. O profissional aperta e segura um botão físico pra falar com você (push-to-talk) — toda fala que chega até você foi capturada porque ele escolheu apertar o botão, então trate como dirigida a você por padrão. Frases cortadas, tosse, ruído de panela captado sem querer no início/fim da gravação ainda podem acontecer — para esses casos, e só para esses, use "ignore".

Você DEVE sempre responder com um JSON válido, sem texto antes ou depois do JSON.

PROTOCOLO DE RESPOSTA (use EXATAMENTE esta estrutura):

Fala captada é só ruído/tosse/frase vazia, sem nenhum conteúdo dirigível (exceção, não regra geral):
{"type":"ignore"}

Para resposta informativa (o profissional perguntou algo):
{"type":"answer","message":"<texto falado em voz alta>"}

Para executar uma ação imediatamente (comandos seguros e reversíveis):
{"type":"action","action":"<nome_da_acao>","payload":<objeto>,"message":"<confirmação falada, curta>"}

Para pedir confirmação antes de agir (comandos que mudam pedido/status — ações com consequência real):
{"type":"confirmation_required","action":"<nome_da_acao>","payload":<objeto>,"message":"<pergunta de confirmação>"}

Quando a fala tiver MAIS DE UM comando distinto (ex: dois pedidos diferentes de coisas, um
depois do outro na mesma gravação):
{"type":"batch","items":[<um objeto por comando, cada um no mesmo formato de "action" ou
"confirmation_required" acima, SEM o campo "message" individual>],"message":"<UM resumo falado
combinando todos os comandos executados, natural, não uma lista lida em voz alta>"}

Para quando claramente é um comando dirigido a você, mas você não entendeu:
{"type":"unknown","message":"Não entendi. Pode repetir?"}

Para erro:
{"type":"error","message":"<descrição do problema>"}

AÇÕES DISPONÍVEIS:
- change_order_status: {"orderId":"<id>","newStatus":"preparing"|"ready"}
- create_timer: {"label":"<nome>","durationMinutes":<número>}
- cancel_timer: {"label":"<nome>"}
- add_timer_time: {"label":"<nome>","extraMinutes":<número>}
- list_timers: {}
- query_orders: {}
- log_prep: {"texto":"<resumo curto do que está sendo preparado, ex: 'Sanduíche — pão, hambúrguer, queijo'>"}

REGRAS IMPORTANTES — PUSH-TO-TALK:
1. Ele apertou o botão pra falar com você — não fique adivinhando se "é pra você". A única
   exceção é gravação vazia/ruído puro sem conteúdo (aí sim "ignore").
2. Quando o profissional descrever o que está montando/preparando (ex: "vou fazer um sanduíche,
   hambúrguer, queijo"), NÃO responda com "answer" nem fale muito — use "action" com
   log_prep e uma confirmação curtíssima (ex: "Registrado.") ou até sem falar praticamente nada.
3. Se houver itens no ESTOQUE/VALIDADE do contexto que tenham relação direta com o que foi
   dito (ex: ele vai usar manteiga e a manteiga está com vencimento crítico), inclua esse aviso
   na mensagem falada, mesmo que curto. Só avise sobre o que for relevante ao que foi dito —
   não fique lendo a lista de validade sem ele ter pedido.
4. Para alterar status de pedido, SEMPRE peça confirmação (type: confirmation_required).
5. Se a mensagem do profissional já vier marcada como "[RESPOSTA A CONFIRMAÇÃO PENDENTE]" no
   comando, trate como confirmação/cancelamento da ação pendente informada no contexto.
6. Para consultas de pedidos, use os dados reais fornecidos no contexto. Nunca invente dados.
7. Responda SEMPRE em português brasileiro, com frases curtas — o profissional está ocupado e
   ouvindo, não lendo.
8. Responda SEMPRE com JSON puro — sem markdown, sem blocos de código, sem texto fora do JSON.
9. Robustez acima de tudo: melhor "ignore" ou "unknown" do que executar uma ação errada. Nunca
   invente um orderId ou label de temporizador que não exista no contexto.
10. Se a fala tiver comandos claramente separados e independentes (ex: "marca 20 minutos pro
    arroz e também 245 como pronto"), use "batch" — um item por comando, cada item resolvido
    exatamente como seria sozinho (uma mudança de status ainda exige confirmation_required
    dentro do item). NÃO use "batch" para uma frase só com um pedido — isso é "action" normal.
    Palavras como "e", "também", "depois" só indicam múltiplos comandos quando ligam AÇÕES
    diferentes, não quando ligam itens de uma mesma coisa (ex: "arroz e feijão" continua sendo
    um único log_prep, não dois comandos).

EXEMPLOS:
- gravação vazia, só tosse ou ruído de panela, sem fala nenhuma → {"type":"ignore"}
- "Quantos pedidos temos?" → answer com contagem real do contexto
- "Coloca o pedido 245 em preparação" → confirmation_required
- "Marca 20 minutos para o arroz" → action, create_timer
- "Vou fazer agora um sanduíche, hambúrguer e queijo" → action, log_prep, mensagem curta
  (e se o queijo estiver com validade crítica no contexto, avisar isso na mensagem)
- "Quanto falta para o arroz?" → answer com tempo restante do contexto de timers
- "Marca 15 minutos pro feijão e também coloca o 245 como pronto" → batch com dois items:
  create_timer + confirmation_required (change_order_status), message combinando os dois
- frase cortada, tossida, ruído de panela → {"type":"ignore"}`;

// ─── System Prompt — Modo Pessoal ─────────────────────────────────────────────
//
// Ativado manualmente pelo profissional quando o expediente termina. Nesse
// modo a MIAR não é mais a assistente operacional: é uma companhia
// descontraída, sem cobrança, sem falar de trabalho. Não usa o protocolo de
// ações da cozinha — não recebe pedidos/estoque/temporizadores no contexto,
// e não deve nunca sugerir voltar a assuntos de trabalho por conta própria.

const PERSONAL_SYSTEM_PROMPT = `Você é MIAR, no modo pessoal. O expediente do profissional acabou de terminar — ele apertou o botão pra trocar de modo porque quer relaxar, não trabalhar.

Aqui você não é a assistente operacional da cozinha. Você é uma companhia leve, descontraída, que conversa de igual pra igual, sem formalidade e sem cobrança. Pode brincar, comentar o dia, perguntar como ele está, sugerir uma descontração — sem nunca voltar sozinha para pedidos, estoque, temporizadores ou qualquer assunto de trabalho. Se ele mesmo trouxer trabalho à tona, converse normalmente sobre isso, mas não puxe o assunto por iniciativa própria.

Responda sempre em português brasileiro, em frases curtas e naturais, como uma conversa falada de verdade, não como um assistente formal.

Você DEVE sempre responder com um JSON válido, sem texto antes ou depois:
{"type":"answer","message":"<texto falado em voz alta>"}

Se a fala captada for só ruído, tosse ou vazia, sem conteúdo nenhum:
{"type":"ignore"}

Nunca use os tipos "action", "confirmation_required" ou "batch" neste modo — eles não existem aqui, são exclusivos do modo profissional.`;

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface NamedTimer {
  label: string;
  startedAt: number;
  durationMs: number;
}

interface KitchenOrder {
  id: string;
  tableNumber: number;
  status: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
  isPriority?: boolean;
}

interface ExpiringStockItem {
  name: string;
  quantity?: number;
  unit?: string;
  daysUntilExpiry: number;
}

interface PendingConfirmation {
  action: string;
  payload?: Record<string, unknown>;
}

interface KitchenContext {
  orders?: KitchenOrder[];
  namedTimers?: NamedTimer[];
  expiringStock?: ExpiringStockItem[];
  pendingConfirmation?: PendingConfirmation;
  currentTime?: number;
}

// ─── Key Rotation ────────────────────────────────────────────────────────────

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Tenta extrair JSON válido de uma string (mesmo que haja texto ao redor) */
function extractJson(text: string): string {
  // Tenta direto
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  // Procura o primeiro { e o último }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  throw new Error("No JSON object found in response");
}

/** Formata o contexto da cozinha em texto para incluir no prompt */
function formatKitchenContext(ctx: KitchenContext, userMessage: string): string {
  const now = ctx.currentTime ?? Date.now();
  const lines: string[] = [];

  if (ctx.orders && ctx.orders.length > 0) {
    const pending = ctx.orders.filter((o) => o.status === "pending");
    const preparing = ctx.orders.filter((o) => o.status === "preparing");
    const ready = ctx.orders.filter((o) => o.status === "ready");

    lines.push("=== ESTADO ATUAL DA COZINHA ===");
    lines.push(`Pedidos novos (pending): ${pending.length}`);
    lines.push(`Pedidos em preparo: ${preparing.length}`);
    lines.push(`Pedidos prontos: ${ready.length}`);
    lines.push(`Total ativo: ${ctx.orders.length}`);

    if (pending.length > 0) {
      lines.push("\nPEDIDOS NOVOS:");
      pending.forEach((o) => {
        const minAgo = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
        const items = o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
        lines.push(
          `  • Pedido ${o.id} — Mesa ${o.tableNumber} — ${items} — criado há ${minAgo}min${o.isPriority ? " — PRIORITÁRIO" : ""}`,
        );
      });
    }

    if (preparing.length > 0) {
      lines.push("\nPEDIDOS EM PREPARO:");
      preparing.forEach((o) => {
        const minAgo = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
        const items = o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
        lines.push(`  • Pedido ${o.id} — Mesa ${o.tableNumber} — ${items} — há ${minAgo}min`);
      });
    }

    if (ready.length > 0) {
      lines.push("\nPEDIDOS PRONTOS:");
      ready.forEach((o) => {
        const items = o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
        lines.push(`  • Pedido ${o.id} — Mesa ${o.tableNumber} — ${items}`);
      });
    }
  } else {
    lines.push("=== ESTADO ATUAL DA COZINHA ===");
    lines.push("Nenhum pedido ativo no momento.");
  }

  if (ctx.namedTimers && ctx.namedTimers.length > 0) {
    lines.push("\n=== TEMPORIZADORES ATIVOS ===");
    ctx.namedTimers.forEach((t) => {
      const elapsed = now - t.startedAt;
      const remaining = t.durationMs - elapsed;
      if (remaining > 0) {
        const remMin = Math.floor(remaining / 60000);
        const remSec = Math.floor((remaining % 60000) / 1000);
        const totalMin = Math.floor(t.durationMs / 60000);
        lines.push(`  • ${t.label}: ${remMin}min ${remSec}s restantes (de ${totalMin}min total)`);
      } else {
        const overdueMin = Math.floor(Math.abs(remaining) / 60000);
        lines.push(`  • ${t.label}: VENCIDO há ${overdueMin}min`);
      }
    });
  } else {
    lines.push("\n=== TEMPORIZADORES ATIVOS ===");
    lines.push("Nenhum temporizador ativo.");
  }

  if (ctx.expiringStock && ctx.expiringStock.length > 0) {
    lines.push("\n=== ESTOQUE PRÓXIMO DO VENCIMENTO ===");
    ctx.expiringStock.forEach((it) => {
      const qty = it.quantity != null ? `${it.quantity}${it.unit ? " " + it.unit : ""} — ` : "";
      const when =
        it.daysUntilExpiry <= 0
          ? "vence hoje"
          : it.daysUntilExpiry === 1
            ? "vence amanhã"
            : `vence em ${it.daysUntilExpiry} dias`;
      lines.push(`  • ${it.name} — ${qty}${when}`);
    });
  }

  if (ctx.pendingConfirmation) {
    lines.push("\n=== CONFIRMAÇÃO PENDENTE ===");
    lines.push(
      `Você tinha pedido confirmação para: ${ctx.pendingConfirmation.action} ${JSON.stringify(ctx.pendingConfirmation.payload ?? {})}`,
    );
    lines.push(
      "Se a fala abaixo for uma confirmação (sim/pode/confirma/manda) ou recusa (não/cancela/para), trate essa ação pendente de acordo. Caso contrário, ela substitui a pendência por um novo comando.",
    );
  }

  lines.push("\n=== COMANDO DO PROFISSIONAL ===");
  lines.push(userMessage);

  return lines.join("\n");
}

// ─── Providers ───────────────────────────────────────────────────────────────

async function callGroqJson(messages: Message[], systemPrompt: string): Promise<string> {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  const attempts = Math.max(groqKeys.length, 1) * models.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const apiKey = nextGroqKey();
    const model = models[attempt % models.length];

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          max_tokens: 256,
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429 || response.status === 401) {
          throw new Error(`Groq ${model} ${response.status}: ${err}`);
        }
        throw new Error(`Groq ${model} error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      return data.choices[0].message.content as string;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, attempt, err: (err as Error).message }, "Kitchen Groq attempt failed");
    }
  }

  throw lastError ?? new Error("All Groq keys/models failed");
}

async function callGeminiJson(messages: Message[], systemPrompt: string): Promise<string> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              ...history,
              { role: "user", parts: [{ text: lastMsg.content }] },
            ],
            generationConfig: {
              maxOutputTokens: 256,
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429 || response.status === 401 || response.status === 403) {
          throw new Error(`Gemini ${model} ${response.status}: ${err}`);
        }
        throw new Error(`Gemini ${model} error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Gemini ${model} empty response`);
      return text as string;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ model, attempt, err: (err as Error).message }, "Kitchen Gemini attempt failed");
    }
  }

  throw lastError ?? new Error("All Gemini keys/models failed");
}

async function callMistralJson(messages: Message[], systemPrompt: string): Promise<string> {
  const apiKey = (process.env.MISTRAL_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 256,
      temperature: 0.2,
      response_format: { type: "json_object" },
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

// CORRIGIDO (15/08/2026) — rota não tinha autenticação nenhuma e usava
// getSettings() sem companyId, então SEMPRE operava sobre a conta demo,
// nunca sobre o restaurante de quem realmente estava falando com a MIAR na
// cozinha. O frontend da Cozinha já manda o token em toda chamada (via
// customFetch) — só não estava sendo lido aqui.
router.post("/kitchen/chat", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const {
    message,
    kitchenContext,
    history,
    mode = "profissional",
  } = req.body as {
    message: string;
    kitchenContext?: KitchenContext;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    mode?: "profissional" | "pessoal";
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({
      type: "error",
      message: "Mensagem não pode estar vazia.",
    });
    return;
  }

  const isPersonal = mode === "pessoal";

  if (isPersonal && getSettings(companyId).modoPessoalHabilitado === false) {
    res.status(403).json({
      type: "error",
      message: "O modo pessoal está desligado pelo gestor no momento.",
    });
    return;
  }

  const systemPrompt = isPersonal ? PERSONAL_SYSTEM_PROMPT : KITCHEN_SYSTEM_PROMPT;

  // Build message array (keep last 4 turns of history for context)
  const recentHistory: Message[] = (history ?? []).slice(-4).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  let messages: Message[];
  if (isPersonal) {
    // Modo pessoal: sem contexto de cozinha nenhum, é só a conversa mesmo.
    messages = [...recentHistory, { role: "user", content: message.trim() }];
  } else {
    // Modo profissional: enriquece com pedidos, temporizadores e estoque.
    const ctx: KitchenContext = {
      ...(kitchenContext ?? {}),
      currentTime: Date.now(),
    };
    const contextualMessage = formatKitchenContext(ctx, message.trim());
    messages = [...recentHistory, { role: "user", content: contextualMessage }];
  }

  const providers = [
    { name: "groq", fn: () => callGroqJson(messages, systemPrompt) },
    { name: "gemini", fn: () => callGeminiJson(messages, systemPrompt) },
    { name: "mistral", fn: () => callMistralJson(messages, systemPrompt) },
  ];

  let lastErr: Error | null = null;

  for (const provider of providers) {
    try {
      const rawText = await provider.fn();

      // Parse and validate JSON
      let parsed: any;
      try {
        parsed = JSON.parse(extractJson(rawText));
      } catch {
        logger.warn({ provider: provider.name, rawText }, "Kitchen AI returned invalid JSON, retrying");
        throw new Error("Invalid JSON from provider");
      }

      // Ensure required field ("ignore" não precisa de message — é silencioso por natureza)
      if (!parsed.type || (parsed.type !== "ignore" && !parsed.message)) {
        throw new Error("Missing required fields in response");
      }
      if (parsed.type === "ignore" && !parsed.message) {
        parsed.message = "";
      }
      if (parsed.type === "batch" && !Array.isArray(parsed.items)) {
        throw new Error("batch sem items[]");
      }

      // log_prep é gravado aqui mesmo, no servidor — não depende de uma segunda
      // chamada do front pra não se perder no meio da correria da cozinha.
      // Cobre tanto uma ação isolada quanto cada item dentro de um batch.
      const persistLogPrep = (item: any) => {
        if (item?.type !== "action" || item?.action !== "log_prep") return;
        const texto = String(item.payload?.texto ?? "").trim();
        if (!texto) return;
        try {
          addRecado({
            id: randomUUID(),
            restaurantId: companyId,
            tipo: "operacao",
            autor: "MIAR (voz)",
            texto,
            criadoEm: new Date().toISOString(),
            leram: [],
          });
        } catch (err) {
          logger.error({ err }, "Falha ao gravar log_prep como recado");
        }
      };

      if (parsed.type === "batch") {
        (parsed.items as any[]).forEach(persistLogPrep);
      } else {
        persistLogPrep(parsed);
      }

      logger.info({ provider: provider.name, type: parsed.type }, "Kitchen chat OK");
      res.json({ ...parsed, provider: provider.name });
      return;
    } catch (err) {
      lastErr = err as Error;
      logger.warn({ provider: provider.name, err: (err as Error).message }, "Kitchen provider failed");
    }
  }

  logger.error({ err: lastErr }, "All kitchen AI providers exhausted");
  res.status(503).json({
    type: "error",
    message: "IA indisponível no momento. Tente novamente em alguns segundos.",
    provider: "fallback",
  });
});

export default router;
