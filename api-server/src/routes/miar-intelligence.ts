/**
 * miar-intelligence.ts — Motor de Inteligência de Negócio da MIAR
 *
 * Analisa dados internos + pesquisa externa para gerar:
 * - Briefings diários proativos
 * - Análise de clientes inativos
 * - Gaps competitivos e tendências
 * - Conteúdo de treinamento para funcionários
 * - Análise de desempenho do cardápio
 *
 * A MIAR sugere. O gestor aprova. O sistema executa.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireOwnerAuth } from "./auth.js";
import { logger } from "../lib/logger.js";
import { restaurants, menuItems, orders } from "../lib/data-store.js";

const router: IRouter = Router();

// ─── Provedor de IA (mesmo padrão do mia.ts) ─────────────────────────────────

const GROQ_KEYS = (process.env.GROQ_API_KEY ?? "").split(",").map((k) => k.trim()).filter(Boolean);
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
let groqKeyIndex = 0;
function nextGroqKey() {
  if (!GROQ_KEYS.length) return null;
  const key = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length];
  groqKeyIndex++;
  return key;
}

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  // Tenta Groq primeiro
  const groqKey = nextGroqKey();
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return data.choices?.[0]?.message?.content ?? "";
      }
    } catch (e) {
      logger.warn("Groq falhou, tentando Gemini...");
    }
  }

  // Fallback: Gemini
  if (GEMINI_KEY) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
        }),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }
  }

  throw new Error("Nenhum provedor de IA disponível.");
}

// ─── Helpers de análise de dados ──────────────────────────────────────────────

function getRestaurantData(companyId: string) {
  return restaurants.find((r: any) => r.companyId === companyId || r.id === companyId) ?? restaurants[0];
}

function getOrderStats(companyId: string) {
  const restaurantOrders = orders.filter(
    (o: any) => o.companyId === companyId || o.restaurantId === companyId
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();
  const weekAgo = todayTs - 7 * 24 * 60 * 60 * 1000;

  const todayOrders = restaurantOrders.filter((o: any) => (o.createdAt ?? 0) >= todayTs);
  const weekOrders = restaurantOrders.filter((o: any) => (o.createdAt ?? 0) >= weekAgo);

  const totalRevenue = weekOrders.reduce((sum: number, o: any) => sum + (o.total ?? 0), 0);
  const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + (o.total ?? 0), 0);

  // Análise de itens do cardápio
  const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const order of weekOrders) {
    for (const item of order.items ?? []) {
      const key = item.name ?? item.id;
      if (!itemCounts[key]) itemCounts[key] = { name: key, count: 0, revenue: 0 };
      itemCounts[key].count += item.quantity ?? 1;
      itemCounts[key].revenue += (item.price ?? 0) * (item.quantity ?? 1);
    }
  }

  const itemsSorted = Object.values(itemCounts).sort((a, b) => b.count - a.count);
  const topSellers = itemsSorted.slice(0, 5);
  const slowMovers = itemsSorted.slice(-5).reverse();

  return {
    totalOrdersToday: todayOrders.length,
    totalOrdersWeek: weekOrders.length,
    todayRevenue,
    weekRevenue: totalRevenue,
    topSellers,
    slowMovers,
    pendingOrders: restaurantOrders.filter((o: any) => o.status === "pending").length,
  };
}

function getMenuItems(companyId: string) {
  const restaurant = restaurants.find(
    (r: any) => r.companyId === companyId || r.id === companyId
  ) ?? restaurants[0];
  if (!restaurant) return [];
  return menuItems.filter((m: any) => m.restaurantId === restaurant.id);
}

// ─── Rota 1: Briefing Diário ──────────────────────────────────────────────────

router.get("/intelligence/briefing", requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string;
    const stats = getOrderStats(companyId);
    const menuItems = getMenuItems(companyId);
    const restaurant = getRestaurantData(companyId);

    const systemPrompt = `Você é a MIAR, inteligência de negócio de um restaurante.
Sua função é gerar um briefing diário conciso, acionável e inteligente para o gestor.
Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "saudacao": "string curta e calorosa de bom dia",
  "resumo": "string - 1 frase resumindo o dia",
  "alertas": [
    {"tipo": "danger|warning|success|info", "titulo": "string", "descricao": "string", "acao": "string opcional"}
  ],
  "oportunidades": [
    {"titulo": "string", "descricao": "string", "impacto": "alto|medio|baixo"}
  ],
  "pergunta_do_dia": "string - uma pergunta estratégica provocativa para o gestor refletir"
}`;

    const userMessage = `Dados do restaurante "${restaurant?.name ?? "Restaurante"}":
- Pedidos hoje: ${stats.totalOrdersToday}
- Faturamento hoje: R$ ${stats.todayRevenue.toFixed(2)}
- Pedidos na semana: ${stats.totalOrdersWeek}
- Faturamento semanal: R$ ${stats.weekRevenue.toFixed(2)}
- Pedidos pendentes agora: ${stats.pendingOrders}
- Itens mais vendidos esta semana: ${stats.topSellers.map((i) => `${i.name} (${i.count}x)`).join(", ") || "dados insuficientes"}
- Itens menos vendidos: ${stats.slowMovers.map((i) => `${i.name} (${i.count}x)`).join(", ") || "dados insuficientes"}
- Total de itens no cardápio: ${menuItems.length}

Gere um briefing inteligente e proativo. Seja direto, não use linguagem corporativa. Fale como uma parceira de negócio que realmente se importa.`;

    const raw = await callAI(systemPrompt, userMessage);

    // Extrai o JSON da resposta
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA não retornou JSON válido");

    const briefing = JSON.parse(match[0]);
    briefing.generatedAt = new Date().toISOString();
    briefing.stats = stats;

    res.json({ ok: true, briefing });
  } catch (err: any) {
    logger.error({ err }, "Erro ao gerar briefing");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Rota 2: Análise de Clientes Inativos ─────────────────────────────────────

router.get("/intelligence/inactive-clients", requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string;
    const dias = parseInt(String(req.query.dias ?? "14"), 10);

    const threshold = Date.now() - dias * 24 * 60 * 60 * 1000;

    // Agrupa pedidos por nome do cliente — é o único dado de identidade que o
    // pedido guarda hoje (o pedido ainda não é ligado à conta do cliente
    // autenticado). É aproximado: dois clientes com o mesmo nome digitado
    // entram no mesmo grupo. Ligar o pedido a client_accounts.id é a forma
    // correta de resolver isso — fica pendente como melhoria futura.
    const clientLastOrder: Record<string, { name: string; lastOrder: number; totalOrders: number; totalSpent: number }> = {};

    for (const order of orders) {
      if (order.restaurantId !== companyId) continue;
      const key = order.customerName?.trim().toLowerCase();
      if (!key) continue;
      if (!clientLastOrder[key]) {
        clientLastOrder[key] = {
          name: order.customerName ?? "Cliente",
          lastOrder: 0,
          totalOrders: 0,
          totalSpent: 0,
        };
      }
      clientLastOrder[key].totalOrders++;
      clientLastOrder[key].totalSpent += order.total ?? 0;
      const orderTime = new Date(order.createdAt).getTime();
      if (orderTime > clientLastOrder[key].lastOrder) {
        clientLastOrder[key].lastOrder = orderTime;
      }
    }

    const inactive = Object.values(clientLastOrder)
      .filter((c) => c.lastOrder > 0 && c.lastOrder < threshold)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const systemPrompt = `Você é a MIAR, especialista em retenção de clientes de restaurante.
Dado um cliente inativo, gere uma mensagem de reconquista personalizada, calorosa e autêntica — não genérica.
Responda em JSON: {"mensagem": "string", "motivo_provavel": "string", "estrategia": "string"}`;

    // Gera sugestão de mensagem para os top 3 inativos
    const inactiveWithSuggestions = await Promise.all(
      inactive.slice(0, 10).map(async (client) => {
        const diasInativo = Math.floor((Date.now() - client.lastOrder) / (24 * 60 * 60 * 1000));
        try {
          const raw = await callAI(
            systemPrompt,
            `Cliente "${client.name}" estava ativo (${client.totalOrders} pedidos, R$${client.totalSpent.toFixed(0)} gastos) e está inativo há ${diasInativo} dias. Gere uma abordagem de reconquista.`
          );
          const match = raw.match(/\{[\s\S]*\}/);
          const suggestion = match ? JSON.parse(match[0]) : null;
          return { ...client, diasInativo, suggestion };
        } catch {
          return { ...client, diasInativo, suggestion: null };
        }
      })
    );

    res.json({
      ok: true,
      totalInativos: inactive.length,
      diasReferencia: dias,
      clientes: inactiveWithSuggestions,
    });
  } catch (err: any) {
    logger.error({ err }, "Erro ao analisar clientes inativos");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Rota 3: Análise de Lacuna Competitiva ────────────────────────────────────

router.post("/intelligence/gap-analysis", requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string;
    const { concorrente, categoria } = req.body as { concorrente?: string; categoria?: string };

    const restaurant = getRestaurantData(companyId);
    const menuItems = getMenuItems(companyId);
    const stats = getOrderStats(companyId);

    const systemPrompt = `Você é a MIAR, especialista em inteligência competitiva para restaurantes.
Analise o gap competitivo entre o restaurante do usuário e o mercado.
Responda em JSON com esta estrutura:
{
  "gaps_identificados": [{"titulo": "string", "descricao": "string", "oportunidade": "string", "urgencia": "alta|media|baixa"}],
  "diferenciais_possiveis": [{"titulo": "string", "descricao": "string"}],
  "acoes_imediatas": [{"acao": "string", "custo_estimado": "string", "impacto_esperado": "string"}],
  "insight_principal": "string"
}`;

    const menuNames = menuItems.slice(0, 20).map((i: any) => i.name ?? i.title).join(", ");

    const userMessage = `Restaurante: "${restaurant?.name ?? "Meu Restaurante"}"
Culinária: ${restaurant?.cuisine ?? categoria ?? "Não informada"}
Cardápio atual (amostra): ${menuNames || "Dados não disponíveis"}
Pedidos semanais: ${stats.totalOrdersWeek}
Faturamento semanal: R$ ${stats.weekRevenue.toFixed(2)}
${concorrente ? `Concorrente mencionado: "${concorrente}"` : "Análise geral do mercado"}

Analise o que pode estar faltando neste restaurante em comparação com o mercado.
Considere: variedade de cardápio, faixa de preço, opções especiais (vegano, sem glúten, fit),
delivery, experiência do cliente, promoções, horários, presença digital.`;

    const raw = await callAI(systemPrompt, userMessage);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA não retornou JSON válido");

    const analysis = JSON.parse(match[0]);
    res.json({ ok: true, analysis, restaurantName: restaurant?.name });
  } catch (err: any) {
    logger.error({ err }, "Erro na análise de gap");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Rota 4: Análise de Cardápio ─────────────────────────────────────────────

router.get("/intelligence/menu-analysis", requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string;
    const stats = getOrderStats(companyId);
    const menuItems = getMenuItems(companyId);
    const restaurant = getRestaurantData(companyId);

    const systemPrompt = `Você é a MIAR, especialista em otimização de cardápio para restaurantes.
Analise o desempenho do cardápio e gere recomendações estratégicas.
Responda em JSON:
{
  "estrelas": [{"nome": "string", "motivo": "string"}],
  "reformular": [{"nome": "string", "sugestao": "string"}],
  "remover": [{"nome": "string", "motivo": "string"}],
  "adicionar": [{"categoria": "string", "sugestao": "string", "motivo": "string"}],
  "precificacao": "string - análise de preços",
  "insight": "string - insight principal"
}`;

    const userMessage = `Restaurante: ${restaurant?.name ?? "Restaurante"}
Culinária: ${restaurant?.cuisine ?? "Não informada"}

Top vendidos esta semana: ${stats.topSellers.map((i) => `${i.name} (${i.count}x, R$${i.revenue.toFixed(0)})`).join(", ") || "sem dados"}
Menos vendidos: ${stats.slowMovers.map((i) => `${i.name} (${i.count}x)`).join(", ") || "sem dados"}
Total de itens no cardápio: ${menuItems.length}
Itens no cardápio (amostra): ${menuItems.slice(0, 15).map((i: any) => `${i.name ?? i.title} (R$${i.price ?? "?"})`).join(", ")}

Gere uma análise estratégica do cardápio com recomendações concretas.`;

    const raw = await callAI(systemPrompt, userMessage);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA não retornou JSON válido");

    res.json({ ok: true, analysis: JSON.parse(match[0]), stats });
  } catch (err: any) {
    logger.error({ err }, "Erro na análise de cardápio");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Rota 5: Conteúdo de Treinamento ─────────────────────────────────────────

router.post("/intelligence/training", requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string;
    const { tema, duracao_minutos = 15, role = "todos" } = req.body as {
      tema: string;
      duracao_minutos?: number;
      role?: string;
    };

    const restaurant = getRestaurantData(companyId);

    const systemPrompt = `Você é a MIAR, responsável pelo desenvolvimento de equipe em restaurantes.
Crie um módulo de treinamento completo, prático e envolvente para equipe de restaurante.
Responda em JSON:
{
  "titulo": "string",
  "objetivo": "string",
  "publico_alvo": "string",
  "duracao_estimada": "string",
  "modulos": [
    {
      "nome": "string",
      "conteudo": "string",
      "atividade_pratica": "string",
      "tempo_minutos": number
    }
  ],
  "avaliacao": {
    "perguntas": ["string"],
    "gabarito": ["string"]
  },
  "dica_do_gestor": "string"
}`;

    const userMessage = `Restaurante: ${restaurant?.name ?? "Restaurante"}
Tema do treinamento: "${tema}"
Público alvo: ${role}
Duração total: ${duracao_minutos} minutos

Crie um treinamento prático, com linguagem simples e atividades que podem ser feitas durante o expediente.
Adapte ao contexto de restaurante. Seja motivador e direto.`;

    const raw = await callAI(systemPrompt, userMessage);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA não retornou JSON válido");

    const training = JSON.parse(match[0]);
    training.criadoEm = new Date().toISOString();
    training.restaurante = restaurant?.name;

    res.json({ ok: true, training });
  } catch (err: any) {
    logger.error({ err }, "Erro ao gerar treinamento");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Rota 6: Tendências de Mercado ────────────────────────────────────────────

router.post("/intelligence/trends", requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId as string;
    const { categoria } = req.body as { categoria?: string };
    const restaurant = getRestaurantData(companyId);

    const systemPrompt = `Você é a MIAR, especialista em tendências gastronômicas e de mercado.
Analise tendências relevantes para o restaurante e sugira como aproveitá-las.
Responda em JSON:
{
  "tendencias": [
    {
      "nome": "string",
      "descricao": "string",
      "como_aplicar": "string",
      "urgencia": "imediato|proximo_mes|proximo_trimestre",
      "investimento_estimado": "baixo|medio|alto"
    }
  ],
  "alertas_mercado": ["string"],
  "oportunidade_oculta": "string",
  "acao_desta_semana": "string"
}`;

    const userMessage = `Restaurante: ${restaurant?.name ?? "Restaurante"}
Culinária: ${restaurant?.cuisine ?? categoria ?? "Diversificada"}
Data atual: ${new Date().toLocaleDateString("pt-BR")}

Identifique tendências gastronômicas e de mercado relevantes para este perfil de restaurante no Brasil em 2025.
Considere: redes sociais (TikTok Food, Instagram), dietas em alta (vegano, fit, low carb),
experiências (jantares temáticos, exclusividade), delivery inteligente, fidelização.`;

    const raw = await callAI(systemPrompt, userMessage);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("IA não retornou JSON válido");

    res.json({ ok: true, trends: JSON.parse(match[0]) });
  } catch (err: any) {
    logger.error({ err }, "Erro ao buscar tendências");
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
