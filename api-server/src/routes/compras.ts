import { Router, type IRouter } from "express";
import { stockItems, purchaseLists, createPurchaseList, registrarRecebimento, getSettings, resolverLojaId, pertenceALoja, registerFinancialMovement } from "../lib/data-store";
import { requireAnyAuth } from "./auth";

// REGRA MULTI-TENANT: nunca use um restaurantId fixo aqui.
// Sempre extraia o companyId do token via (req as any).auth.companyId.

const router: IRouter = Router();

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
}

const groqKeys = parseKeys(process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY);
const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);
let groqIdx = 0, geminiIdx = 0;

async function callGroq(prompt: string): Promise<string> {
  if (!groqKeys.length) throw new Error("GROQ_API_KEYS não configurado");
  const key = groqKeys[groqIdx++ % groqKeys.length];
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Você é a Miar Ária, assistente de compras de um restaurante. Responda sempre em JSON válido conforme solicitado." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1500,
    }),
  });
  const d = await r.json() as any;
  return d.choices?.[0]?.message?.content ?? "";
}

async function callGemini(prompt: string): Promise<string> {
  if (!geminiKeys.length) throw new Error("GEMINI_API_KEYS não configurado");
  const key = geminiKeys[geminiIdx++ % geminiKeys.length];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const d = await r.json() as any;
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callAI(prompt: string): Promise<string> {
  try { return await callGroq(prompt); } catch { return await callGemini(prompt); }
}

// GET /compras — histórico de listas geradas
router.get("/compras", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const settings = getSettings(companyId);
  const lojaId = settings.comprasPorLoja
    ? resolverLojaId(companyId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;
  const lists = purchaseLists
    .filter(l => l.restaurantId === companyId && (!lojaId || pertenceALoja(l.lojaId, lojaId, companyId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
  res.json(lists);
});

// POST /compras — gerar nova lista de compras com IA
router.post("/compras", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const settings = getSettings(companyId);
  const lojaId = settings.comprasPorLoja
    ? resolverLojaId(companyId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;
  const { request: userRequest } = req.body as { request?: string };

  const baixoEstoque = stockItems
    .filter(i => i.restaurantId === companyId && (!lojaId || pertenceALoja(i.lojaId, lojaId, companyId)) && i.quantity <= i.minQuantity)
    .map(i => `${i.name} (${i.category}): ${i.quantity} ${i.unit} restante(s), mínimo ${i.minQuantity} ${i.unit}`);

  const prompt = `Você é a Miar Ária, assistente de compras de um restaurante.

Itens com estoque abaixo do mínimo:
${baixoEstoque.length > 0 ? baixoEstoque.join("\n") : "(nenhum no momento)"}

Pedido do gestor: "${userRequest ?? "Gere a lista de compras com base no estoque baixo"}"

Responda SOMENTE com um JSON no formato:
{
  "titulo": "string curta descrevendo a lista",
  "resumo": "string de 1-2 frases explicando a lista",
  "itens": [
    {
      "nome": "string",
      "categoria": "string",
      "quantidade": number,
      "unidade": "string",
      "precoEstimado": number,
      "fornecedorSugerido": "string",
      "prioridade": "alta" | "media" | "baixa"
    }
  ],
  "totalEstimado": number,
  "observacoes": "string opcional"
}`;

  try {
    const raw = await callAI(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(502).json({ error: "IA não retornou JSON válido" }); return; }
    const parsed = JSON.parse(jsonMatch[0]) as any;

    // Tenta vincular cada item sugerido pela IA a um item de estoque real
    // já cadastrado (por nome, sem diferenciar maiúsculas/acentos exatos).
    // Se não achar, fica sem vínculo — a conferência de recebimento não
    // inventa item de estoque novo sozinha.
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const estoqueDoRestaurante = stockItems.filter(i => i.restaurantId === companyId && (!lojaId || pertenceALoja(i.lojaId, lojaId, companyId)));
    const itensComVinculo = (parsed.itens ?? []).map((it: any) => {
      const match = estoqueDoRestaurante.find(s => norm(s.name) === norm(it.nome ?? ""));
      return { ...it, stockItemId: match?.id ?? null, quantidadeRecebida: null };
    });

    const list = createPurchaseList({
      restaurantId: companyId,
      lojaId,
      titulo: parsed.titulo ?? "Lista de compras",
      resumo: parsed.resumo ?? "",
      itens: itensComVinculo,
      totalEstimado: parsed.totalEstimado ?? 0,
      observacoes: parsed.observacoes ?? "",
      userRequest: userRequest ?? "",
    });

    res.status(201).json(list);
  } catch (err: any) {
    res.status(502).json({ error: "Erro ao gerar lista de compras", detail: String(err?.message ?? err) });
  }
});

// ─── Conferência de recebimento (esperado x recebido) ─────────────────────────
// Responde a pergunta real de cliente: "cadastro a nota e depois não chega
// tudo, como eu fico?" — o estoque só sobe com o que for confirmado aqui,
// nunca com o que a lista/nota promete.

// GET /compras/:id — detalhe de uma lista específica, com status de recebimento
router.get("/compras/:id", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const settings = getSettings(companyId);
  const lojaId = settings.comprasPorLoja
    ? resolverLojaId(companyId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;
  const list = purchaseLists.find(l => l.id === req.params.id && l.restaurantId === companyId && (!lojaId || pertenceALoja(l.lojaId, lojaId, companyId)));
  if (!list) { res.status(404).json({ error: "Lista de compras não encontrada" }); return; }
  res.json(list);
});

// POST /compras/:id/receber — confirmar o que chegou de verdade
// Body: { recebidos: [{ indice: number, quantidadeRecebida: number }] }
router.post("/compras/:id/receber", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const { recebidos } = req.body as { recebidos?: { indice: number; quantidadeRecebida: number }[] };

  if (!Array.isArray(recebidos) || recebidos.length === 0) {
    res.status(400).json({ error: "Informe pelo menos um item recebido em 'recebidos'" });
    return;
  }
  for (const r of recebidos) {
    if (typeof r.indice !== "number" || typeof r.quantidadeRecebida !== "number" || r.quantidadeRecebida < 0) {
      res.status(400).json({ error: "Cada item precisa de 'indice' e 'quantidadeRecebida' (número >= 0)" });
      return;
    }
  }

  const updated = registrarRecebimento(String(req.params.id), companyId, recebidos);
  if (!updated) { res.status(404).json({ error: "Lista de compras não encontrada" }); return; }

  // Registra somente o recebimento confirmado como evento operacional de custo.
  // A estimativa da IA não vira despesa paga: fica memo até existir uma baixa
  // financeira real com documento, fornecedor e forma de pagamento.
  for (const recebido of recebidos) {
    const item = updated.itens[recebido.indice];
    const quantidade = recebido.quantidadeRecebida;
    const amountCents = Math.round(Number(item?.precoEstimado ?? 0) * quantidade * 100);
    if (!item || quantidade <= 0 || !Number.isInteger(amountCents) || amountCents <= 0) continue;
    registerFinancialMovement({
      restaurantId: companyId,
      lojaId: updated.lojaId,
      kind: "purchase_received",
      direction: "memo",
      amountCents,
      currency: "BRL",
      paymentMethod: "other",
      occurredAt: updated.recebidoEm ?? new Date().toISOString(),
      sourceType: "purchase",
      sourceId: `${updated.id}:${recebido.indice}`,
      idempotencyKey: `purchase-received:${companyId}:${updated.id}:${recebido.indice}:${quantidade}`,
      purchaseListId: updated.id,
      description: `Recebimento conferido — ${item.nome}`,
      metadata: {
        settlementStatus: "estimated_not_paid",
        quantidadeRecebida: quantidade,
        unidade: item.unidade,
        precoEstimadoUnitario: item.precoEstimado,
      },
    });
  }

  // Monta um resumo de divergências pra resposta ficar clara sem o front
  // precisar recalcular sozinho.
  const divergencias = updated.itens
    .filter(i => i.quantidadeRecebida != null && i.quantidadeRecebida !== i.quantidade)
    .map(i => ({
      nome: i.nome,
      esperado: i.quantidade,
      recebido: i.quantidadeRecebida,
      diferenca: (i.quantidadeRecebida ?? 0) - i.quantidade,
      unidade: i.unidade,
    }));

  res.json({ list: updated, divergencias });
});

export default router;
