import { Router, type IRouter } from "express";
import { requireOwnerAuth } from "./auth";
import {
  registrarSinalDemanda,
  agregarDemanda,
  type EstadoDemanda,
} from "../lib/data-store.js";

/**
 * MOTOR DE INTELIGENCIA DE DEMANDA — rotas.
 * O cliente registra toda busca (encontrou ou nao). O dono le o painel
 * agregado: o que a cidade procura e nao acha (demanda reprimida), o que
 * rejeita, e o nivel por volume.
 */

const router: IRouter = Router();

// POST /api/demanda/sinal — o app do cliente chama a cada busca
router.post("/demanda/sinal", (req, res): void => {
  const { termo, estado, regiao, origem, resultados } = req.body as {
    termo?: string;
    estado?: EstadoDemanda;
    regiao?: string;
    origem?: "morador" | "visitante";
    resultados?: number;
  };
  if (!termo || !termo.trim()) {
    res.status(400).json({ error: "termo obrigatorio" });
    return;
  }
  const estadoFinal: EstadoDemanda =
    estado ?? ((resultados ?? 0) > 0 ? "encontrada" : "nao_encontrada");
  const sinal = registrarSinalDemanda({
    termo,
    estado: estadoFinal,
    regiao,
    origem,
    resultados,
  });
  res.status(201).json(sinal);
});

// GET /api/demanda/painel?dias=30 — visao do dono (so dono/gestor)
router.get("/demanda/painel", requireOwnerAuth, (req, res): void => {
  const dias = Number(req.query.dias) || 30;
  const linhas = agregarDemanda(dias);
  const reprimida = linhas.filter((l) => l.naoEncontrada > 0);
  res.json({
    periodoDias: dias,
    oportunidades: reprimida, // o que a cidade quer e nao acha, ordenado
    tudo: linhas,
  });
});

export default router;
