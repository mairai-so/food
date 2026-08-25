/**
 * atalhos.ts — Atalhos Inteligentes (seção 125 do Manual de Fábrica).
 *
 * Cada usuário (dono ou funcionário) personaliza os atalhos do sistema,
 * por teclado ou por botão de mouse. Escopo por restaurantId + userId —
 * dois usuários do mesmo restaurante podem ter combinações diferentes
 * para a mesma função.
 *
 * GET  /api/atalhos            → { atalhos, acoesDisponiveis }
 * POST /api/atalhos            → { action, key, tipo, forcar? } grava/atualiza
 *                                  responde 409 com o conflito se a combinação
 *                                  já estiver em uso, a menos que forcar=true
 * DELETE /api/atalhos/:action  → remove o atalho daquela função
 * POST /api/atalhos/restaurar-padrao → volta para os atalhos de fábrica
 */
import { Router, type IRouter } from "express";
import { requireAnyAuth } from "./auth.js";
import {
  ATALHO_ACOES_DISPONIVEIS,
  getAtalhosDoUsuario,
  encontrarConflitoAtalho,
  definirAtalho,
  removerAtalho,
  restaurarAtalhosPadrao,
  type AtalhoTipo,
} from "../lib/data-store.js";

const router: IRouter = Router();

function getIdentidade(req: any): { restaurantId: string; userId: string } | null {
  const auth = req.auth;
  if (!auth) return null;
  const restaurantId = auth.companyId;
  const userId = auth.isEmployee ? auth.employeeId : auth.ownerId;
  if (!restaurantId || !userId) return null;
  return { restaurantId, userId };
}

router.get("/atalhos", requireAnyAuth, (req, res): void => {
  const identidade = getIdentidade(req);
  if (!identidade) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  res.json({
    atalhos: getAtalhosDoUsuario(identidade.restaurantId, identidade.userId),
    acoesDisponiveis: ATALHO_ACOES_DISPONIVEIS,
  });
});

router.post("/atalhos", requireAnyAuth, (req, res): void => {
  const identidade = getIdentidade(req);
  if (!identidade) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  const { action, key, tipo, forcar } = req.body as {
    action?: string;
    key?: string;
    tipo?: AtalhoTipo;
    forcar?: boolean;
  };

  if (!action || !key || (tipo !== "teclado" && tipo !== "mouse")) {
    res.status(400).json({ error: "action, key e tipo ('teclado' ou 'mouse') são obrigatórios" });
    return;
  }
  if (!ATALHO_ACOES_DISPONIVEIS.some((a) => a.action === action)) {
    res.status(400).json({ error: "action desconhecida" });
    return;
  }

  const conflito = encontrarConflitoAtalho(identidade.restaurantId, identidade.userId, key, tipo, action);
  if (conflito && !forcar) {
    res.status(409).json({
      error: "Essa combinação já está em uso",
      conflito,
    });
    return;
  }
  // Se o usuário confirmou substituir, libera a combinação do outro atalho antes de gravar.
  if (conflito && forcar) {
    removerAtalho(identidade.restaurantId, identidade.userId, conflito.action);
  }

  const salvo = definirAtalho(identidade.restaurantId, identidade.userId, action, key, tipo);
  res.status(201).json(salvo);
});

router.delete("/atalhos/:action", requireAnyAuth, (req, res): void => {
  const identidade = getIdentidade(req);
  if (!identidade) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  const action = Array.isArray(req.params.action) ? req.params.action[0] : req.params.action;
  const removido = removerAtalho(identidade.restaurantId, identidade.userId, action);
  if (!removido) {
    res.status(404).json({ error: "Atalho não encontrado" });
    return;
  }
  res.json({ ok: true });
});

router.post("/atalhos/restaurar-padrao", requireAnyAuth, (req, res): void => {
  const identidade = getIdentidade(req);
  if (!identidade) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  const restaurados = restaurarAtalhosPadrao(identidade.restaurantId, identidade.userId);
  res.json({ atalhos: restaurados, acoesDisponiveis: ATALHO_ACOES_DISPONIVEIS });
});

export default router;
