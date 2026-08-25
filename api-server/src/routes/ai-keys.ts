/**
 * ai-keys.ts — Gerenciamento das chaves de IA pessoais do gestor.
 *
 * Criado 22/08/2026, pedido do Robson: trazer pro Gestor a capacidade de
 * cadastrar múltiplas chaves de provedor de IA (Groq, Gemini, Mistral,
 * OpenRouter), com editar/excluir/ligar-desligar — mesmo conceito que já
 * existe no MIAR AI Pessoal, construído aqui do zero porque os dois
 * projetos têm backend separado (confirmado antes de começar).
 *
 * Escopo: por ownerId (dono/gestor individual), não por empresa — cada
 * pessoa tem suas próprias chaves, ninguém vê a chave de outro dono.
 * Valor da chave nunca é devolvido pro frontend depois de salva (só
 * "presente"/"ausente" + prefixo curto pra reconhecer qual é qual).
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { requireOwnerAuth } from "./auth.js";
import { execute, query } from "../lib/db.js";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

export const AI_PROVIDERS = ["groq", "gemini", "mistral", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

function getOwnerId(req: Request): string {
  return (req as any).auth?.ownerId ?? (req as any).auth?.userId;
}

router.use(async (_req, _res, next) => {
  await execute(`
    CREATE TABLE IF NOT EXISTS ai_provider_keys (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      key_value TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  next();
});

// ─── GET /ai-keys — lista as chaves do dono logado, sem expor o valor ────────

router.get("/ai-keys", requireOwnerAuth, async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  const rows = await query<{ id: string; provider: string; key_value: string; enabled: boolean; created_at: string }>(
    `SELECT id, provider, key_value, enabled, created_at FROM ai_provider_keys WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId],
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      enabled: r.enabled,
      createdAt: r.created_at,
      // Só os 4 primeiros caracteres, pra reconhecer qual chave é qual
      // sem nunca devolver o valor completo pro navegador.
      preview: `${r.key_value.slice(0, 4)}••••`,
    })),
  );
});

// ─── POST /ai-keys — cadastra chave nova ─────────────────────────────────────

router.post("/ai-keys", requireOwnerAuth, async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  const { provider, key } = req.body as { provider?: string; key?: string };
  if (!provider || !AI_PROVIDERS.includes(provider as AiProvider)) {
    res.status(400).json({ error: "Provedor inválido" });
    return;
  }
  if (!key?.trim()) {
    res.status(400).json({ error: "Chave é obrigatória" });
    return;
  }
  const id = randomUUID();
  await execute(
    `INSERT INTO ai_provider_keys (id, owner_id, provider, key_value, enabled) VALUES ($1, $2, $3, $4, TRUE)`,
    [id, ownerId, provider, key.trim()],
  );
  res.status(201).json({ id });
});

// ─── PATCH /ai-keys/:id — edita valor ou liga/desliga ────────────────────────

router.patch("/ai-keys/:id", requireOwnerAuth, async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  const { key, enabled } = req.body as { key?: string; enabled?: boolean };
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (key?.trim()) { updates.push(`key_value = $${++i}`); values.push(key.trim()); }
  if (typeof enabled === "boolean") { updates.push(`enabled = $${++i}`); values.push(enabled); }
  if (updates.length === 0) { res.status(400).json({ error: "Nada para atualizar" }); return; }
  await execute(
    `UPDATE ai_provider_keys SET ${updates.join(", ")} WHERE id = $1 AND owner_id = $${++i}`,
    [req.params.id, ...values, ownerId],
  );
  res.json({ ok: true });
});

// ─── DELETE /ai-keys/:id ──────────────────────────────────────────────────────

router.delete("/ai-keys/:id", requireOwnerAuth, async (req: Request, res: Response): Promise<void> => {
  const ownerId = getOwnerId(req);
  await execute(`DELETE FROM ai_provider_keys WHERE id = $1 AND owner_id = $2`, [req.params.id, ownerId]);
  res.json({ ok: true });
});

export default router;
