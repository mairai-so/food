/**
 * recados.ts — Mural de recados internos da casa (caixa ⇄ salão).
 *
 * GET   /api/recados                → lista recados ativos (mesa fechada some)
 * POST  /api/recados                → { tipo, autor, texto, mesa? } cria recado
 * PATCH /api/recados/:id/lido       → { quem } marca leitura confirmada
 * POST  /api/recados/mesa/:n/fechar → fecha (arquiva) todos os recados da mesa n
 *
 * Recado é curto e persistente. Dois tipos que não se misturam:
 *  - "operacao": voz do comando (ex.: "acabou troco")
 *  - "mesa": nota amarrada a uma mesa (some quando a mesa fecha)
 *
 * CORRIGIDO (15/08/2026) — vazamento multi-tenant crítico: Recado não tinha
 * restaurantId, então GET /recados devolvia o Feed Interno de TODOS os
 * restaurantes misturado pra qualquer funcionário autenticado, e fechar a
 * mesa 5 de um restaurante fechava também os recados da mesa 5 de QUALQUER
 * outro restaurante.
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { requireAnyAuth } from "./auth.js";
import {
  recados,
  addRecado,
  marcarRecadoLido,
  fecharRecadosDaMesa,
  type Recado,
} from "../lib/data-store.js";

const router: IRouter = Router();

// Lista recados ativos (não arquivados) do restaurante do usuário logado,
// mais novos primeiro
router.get("/recados", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  res.json(recados.filter((r) => !r.fechado && r.restaurantId === companyId));
});

// Cria recado
router.post("/recados", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const { tipo, autor, texto, mesa } = req.body as {
    tipo?: "operacao" | "mesa";
    autor?: string;
    texto?: string;
    mesa?: number;
  };

  if (!texto || !texto.trim()) {
    res.status(400).json({ error: "texto é obrigatório" });
    return;
  }
  const tipoFinal: "operacao" | "mesa" = tipo === "mesa" ? "mesa" : "operacao";
  if (tipoFinal === "mesa" && (mesa === undefined || mesa === null)) {
    res.status(400).json({ error: "mesa é obrigatória para recado de mesa" });
    return;
  }

  const recado: Recado = {
    id: randomUUID(),
    restaurantId: companyId,
    tipo: tipoFinal,
    autor: (autor && autor.trim()) || "Caixa",
    texto: texto.trim().slice(0, 500),
    mesa: tipoFinal === "mesa" ? Number(mesa) : undefined,
    criadoEm: new Date().toISOString(),
    leram: [],
  };
  res.status(201).json(addRecado(recado));
});

// Marca leitura confirmada — só do próprio restaurante
router.patch("/recados/:id/lido", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { quem } = req.body as { quem?: string };
  const atualizado = marcarRecadoLido(id, (quem && quem.trim()) || "Caixa", companyId);
  if (!atualizado) {
    res.status(404).json({ error: "Recado não encontrado" });
    return;
  }
  res.json(atualizado);
});

// Fecha (arquiva) os recados de uma mesa — chamado quando a mesa fecha, só
// afeta as mesas do próprio restaurante
router.post("/recados/mesa/:n/fechar", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const n = Number(req.params.n);
  if (Number.isNaN(n)) {
    res.status(400).json({ error: "número de mesa inválido" });
    return;
  }
  fecharRecadosDaMesa(n, companyId);
  res.json({ ok: true });
});

export default router;
