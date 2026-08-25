/**
 * menu-ia.ts — Geração automática de cardápio a partir de texto livre.
 *
 * POST /api/menu-ia/gerar     → { textoLivre } → IA devolve rascunho de itens
 *                                 (não insere direto, gestor revisa antes)
 * POST /api/menu-ia/confirmar → { itens: [...] } → grava de fato no cardápio
 *
 * Reaproveita o mesmo padrão de fallback de provedor (Groq → Gemini) usado
 * em mia.ts. Segue o princípio do manual: IA gera rascunho, humano revisa
 * antes de virar dado real (mesma lógica aplicada ao MIAR EDITA).
 */
import { Router, type IRouter } from "express";
import { requireOwnerAuth } from "./auth.js";
import { logger } from "../lib/logger.js";
import { menuItems, createId, type MenuItem } from "../lib/data-store.js";

const router: IRouter = Router();

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean);
}

const groqKeys = parseKeys(process.env.GROQ_API_KEYS ?? process.env.GROQ_API_KEY);
const geminiKeys = parseKeys(process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY);
let groqIdx = 0;
let geminiIdx = 0;

interface RascunhoItem {
  name: string;
  description: string;
  price: number;
  category: string;
}

const SYSTEM_PROMPT = `Você extrai itens de cardápio a partir de uma descrição livre em português que o dono do restaurante escreveu ou ditou.

Responda SOMENTE com um array JSON válido, sem texto antes ou depois, sem markdown, no formato:
[{"name": "string", "description": "string curta", "price": number, "category": "string"}]

Regras:
- Se o preço não estiver claro no texto, estime um preço razoável pra esse tipo de prato no Brasil e NÃO invente um valor absurdo.
- category deve ser algo simples como "Pratos principais", "Bebidas", "Sobremesas", "Entradas", "Lanches", conforme o que fizer sentido pro item.
- Nunca invente itens que não foram mencionados nem sugeridos pelo texto.
- Se o texto não tiver nenhum item de cardápio identificável, responda com [].`;

async function callGroq(userText: string): Promise<string> {
  if (!groqKeys.length) throw new Error("GROQ_API_KEY não configurada");
  const apiKey = groqKeys[groqIdx++ % groqKeys.length];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      max_tokens: 1500,
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  return data.choices[0].message.content as string;
}

async function callGemini(userText: string): Promise<string> {
  if (!geminiKeys.length) throw new Error("GEMINI_API_KEY não configurada");
  const apiKey = geminiKeys[geminiIdx++ % geminiKeys.length];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.4 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as any;
  return data.candidates[0].content.parts[0].text as string;
}

function extrairJson(texto: string): RascunhoItem[] {
  // Remove eventuais cercas de markdown (```json ... ```) que o modelo às vezes inclui.
  const limpo = texto.replace(/```json\s*|```/g, "").trim();
  const inicio = limpo.indexOf("[");
  const fim = limpo.lastIndexOf("]");
  if (inicio === -1 || fim === -1) return [];
  try {
    const parsed = JSON.parse(limpo.slice(inicio, fim + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && typeof it.name === "string" && it.name.trim())
      .map((it) => ({
        name: String(it.name).slice(0, 120),
        description: String(it.description ?? "").slice(0, 300),
        price: Number(it.price) > 0 ? Number(it.price) : 0,
        category: String(it.category ?? "Outros").slice(0, 60),
      }));
  } catch {
    return [];
  }
}

// ── POST /menu-ia/gerar — gera rascunho, NÃO insere no cardápio ainda ────────
router.post("/menu-ia/gerar", requireOwnerAuth, async (req, res): Promise<void> => {
  const { textoLivre } = req.body as { textoLivre?: string };
  if (!textoLivre?.trim()) {
    res.status(400).json({ error: "textoLivre é obrigatório" });
    return;
  }
  if (textoLivre.length > 4000) {
    res.status(400).json({ error: "Texto muito longo (máximo 4000 caracteres)" });
    return;
  }

  let bruto = "";
  let provider = "fallback";
  for (const tentativa of [
    { name: "groq", fn: () => callGroq(textoLivre) },
    { name: "gemini", fn: () => callGemini(textoLivre) },
  ]) {
    try {
      bruto = await tentativa.fn();
      provider = tentativa.name;
      break;
    } catch (err) {
      logger.warn({ provider: tentativa.name, err: (err as Error).message }, "menu-ia: provedor falhou");
    }
  }

  if (!bruto) {
    res.status(503).json({ error: "Não consegui gerar o cardápio agora. Tenta de novo em instantes." });
    return;
  }

  const itens = extrairJson(bruto);
  res.json({ itens, provider, aviso: "Rascunho gerado por IA — revise antes de confirmar. Nada foi salvo ainda." });
});

// ── POST /menu-ia/confirmar — grava de fato os itens revisados pelo gestor ──
router.post("/menu-ia/confirmar", requireOwnerAuth, async (req, res): Promise<void> => {
  const restaurantId: string = (req as any).owner.companyId;
  const { itens } = req.body as { itens?: RascunhoItem[] };

  if (!Array.isArray(itens) || itens.length === 0) {
    res.status(400).json({ error: "itens é obrigatório e não pode ser vazio" });
    return;
  }

  const criados: MenuItem[] = itens
    .filter((it) => it?.name?.trim())
    .map((it) => ({
      id: createId(),
      restaurantId,
      name: it.name.trim(),
      description: it.description?.trim() ?? "",
      price: Number(it.price) > 0 ? Number(it.price) : 0,
      category: it.category?.trim() || "Outros",
      available: true,
      prepTime: 15,
    }));

  menuItems.push(...criados);
  res.status(201).json({ criados: criados.length, itens: criados });
});

export default router;
