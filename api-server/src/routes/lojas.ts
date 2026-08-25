import { Router, type IRouter } from "express";
import { logger } from "../lib/logger.js";
import { requireAnyAuth, requireOwnerAuth } from "./auth";
import { listarLojas, criarLoja, atualizarLoja } from "../lib/data-store";
import { queryOne } from "../lib/db";
import { conferirSenhaMestra } from "./registro-protegido";

const router: IRouter = Router();

function getCompanyId(req: any): string {
  return req.auth?.companyId ?? req.owner?.companyId;
}

// GET /lojas — lista as lojas da conta logada. Dono OU funcionário podem
// listar (o operador de caixa/garçom/cozinha precisa ver em qual loja está
// trabalhando); só o dono pode criar ou editar (abaixo). Se a conta nunca
// criou nenhuma loja explícita, cria e retorna a "Loja Principal" automaticamente.
router.get("/lojas", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  if (!companyId) {
    res.status(401).json({ error: "Conta não identificada" });
    return;
  }
  try {
    res.json(listarLojas(companyId));
  } catch (error) {
    logger.error({ error, companyId }, "Erro ao listar lojas");
    res.status(500).json({ error: "Falha ao carregar as lojas" });
  }
});

// POST /lojas — cria uma nova loja pra conta logada.
router.post("/lojas", requireOwnerAuth, async (req, res): Promise<void> => {
  const owner = (req as any).owner as { companyId?: unknown } | undefined;
  const companyId = typeof owner?.companyId === "string" ? owner.companyId : "";
  const body = req.body && typeof req.body === "object" ? req.body as { nome?: unknown; endereco?: unknown; modoNome?: unknown } : {};
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const endereco = typeof body.endereco === "string" ? body.endereco.trim() : undefined;
  const modoNome = body.modoNome === "filial" || body.modoNome === "unidade" ? body.modoNome : "automatico";

  if (!companyId) {
    res.status(401).json({ error: "Conta não identificada" });
    return;
  }
  try {
    const company = await queryOne<{ name: string }>("SELECT name FROM companies WHERE id = $1", [companyId]);
    const base = company?.name?.trim() || "Loja";
    const existentes = listarLojas(companyId);
    const numero = existentes.length + 1;
    const nomeFinal = nome || (modoNome === "filial" ? `${base} - Filial ${numero}` : modoNome === "unidade" ? `${base} - Unidade ${numero}` : `${base} ${numero}`);
    const loja = criarLoja(companyId, nomeFinal, endereco);
    res.status(201).json(loja);
  } catch (error) {
    logger.error({ error, companyId }, "Erro ao criar nova loja");
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: process.env.NODE_ENV === "development" ? `Falha ao criar a loja: ${detail}` : "Falha ao criar a loja",
    });
  }
});

// PATCH /lojas/:id — edita nome/endereco/ativa. Nunca deleta de verdade
// (uma loja desativada mantém seu histórico de pedidos, caixa, estoque).
router.patch("/lojas/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { id } = req.params as { id: string };
  const { nome, endereco, ativa, senhaMestra } = req.body as { nome?: string; endereco?: string; ativa?: boolean; senhaMestra?: string };
  if (!(await conferirSenhaMestra(companyId, senhaMestra ?? ""))) {
    res.status(401).json({ error: "Senha mestra incorreta ou não configurada." });
    return;
  }
  const updates: { nome?: string; endereco?: string; ativa?: boolean } = {};
  if (typeof nome === "string") updates.nome = nome.trim();
  if (typeof endereco === "string") updates.endereco = endereco.trim();
  if (typeof ativa === "boolean") updates.ativa = ativa;
  const loja = atualizarLoja(companyId, id, updates);
  if (!loja) {
    res.status(404).json({ error: "Loja não encontrada" });
    return;
  }
  res.json(loja);
});

// Excluir significa desativar: pedidos, caixa e histórico continuam preservados.
router.delete("/lojas/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const senhaMestra = typeof req.body?.senhaMestra === "string" ? req.body.senhaMestra : "";
  if (!(await conferirSenhaMestra(companyId, senhaMestra))) {
    res.status(401).json({ error: "Senha mestra incorreta ou não configurada." });
    return;
  }
  const loja = listarLojas(companyId).find((item) => item.id === req.params.id);
  if (!loja) { res.status(404).json({ error: "Loja não encontrada" }); return; }
  if (loja.padrao) { res.status(409).json({ error: "A loja principal não pode ser excluída." }); return; }
  const desativada = atualizarLoja(companyId, loja.id, { ativa: false });
  res.json({ ...desativada, excluida: true });
});

export default router;
