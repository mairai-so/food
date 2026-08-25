/**
 * rentabilidade.ts — Análise de rentabilidade por prato (30/07/2026).
 *
 * Responde às perguntas já especificadas: quanto este prato custa pra
 * cozinha, quanto sobra quando vendido, qual o preço mínimo pra bater a
 * margem-alvo, quais pratos vendem muito mas dão pouco lucro. Depende da
 * baixa automática de estoque + ficha técnica já existirem.
 */
import { Router, type IRouter } from "express";
import { requireAnyAuth, requireOwnerAuth } from "./auth";
import { getCostSettings, setCostSettings, calcularRentabilidadePorPrato, getSettings, resolverLojaId } from "../lib/data-store";
import { relatoriosGerados } from "../lib/relatorio-scheduler.js";

const router: IRouter = Router();

// GET /rentabilidade/config — ver configuração atual (custo fixo, margem-alvo)
router.get("/rentabilidade/config", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  res.json(getCostSettings(companyId));
});

// POST /rentabilidade/config — só o dono configura (é dado financeiro sensível)
router.post("/rentabilidade/config", requireOwnerAuth, (req, res): void => {
  const companyId: string = (req as any).owner.companyId;
  const { custoFixoMensal, margemAlvoPercent, frequenciaRelatorio } = req.body as {
    custoFixoMensal?: number;
    margemAlvoPercent?: number;
    frequenciaRelatorio?: "diario" | "semanal" | "quinzenal" | "mensal" | "desligado";
  };

  if (custoFixoMensal !== undefined && (typeof custoFixoMensal !== "number" || custoFixoMensal < 0)) {
    res.status(400).json({ error: "custoFixoMensal precisa ser um número >= 0" });
    return;
  }
  if (margemAlvoPercent !== undefined && (typeof margemAlvoPercent !== "number" || margemAlvoPercent < 0 || margemAlvoPercent >= 100)) {
    res.status(400).json({ error: "margemAlvoPercent precisa ser um número entre 0 e 100" });
    return;
  }

  const updated = setCostSettings(companyId, { custoFixoMensal, margemAlvoPercent, frequenciaRelatorio });
  res.json(updated);
});

// GET /rentabilidade/pratos?desde=ISO&ate=ISO — análise por prato no período
// Sem parâmetros, usa o mês corrente (visão "estimada" até o fechamento real).
router.get("/rentabilidade/pratos", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  // Multi-loja (15/08/2026): antes misturava pedidos/pratos de todas as
  // lojas da conta — agora filtra pela loja ativa quando cardapioPorLoja
  // está ligado (mesmo critério usado em estoque/mesas/pedidos).
  const settings = getSettings(companyId);
  const lojaId = settings.cardapioPorLoja
    ? resolverLojaId(companyId, (req.headers["x-loja-id"] as string) || undefined)
    : undefined;
  const agora = new Date();
  const inicioMesPadrao = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const desdeParam = req.query.desde as string | undefined;
  const ateParam = req.query.ate as string | undefined;
  const desde = desdeParam ? new Date(desdeParam) : inicioMesPadrao;
  const ate = ateParam ? new Date(ateParam) : agora;

  if (isNaN(desde.getTime()) || isNaN(ate.getTime())) {
    res.status(400).json({ error: "desde/ate precisam ser datas ISO 8601 válidas" });
    return;
  }

  const { pratos, semFichaTecnica } = calcularRentabilidadePorPrato(companyId, desde, ate, lojaId);

  // Ordena por lucro total gerado no período (quantidade x lucro por unidade)
  // — ajuda a responder "qual prato dá mais lucro" sem o front ter que calcular.
  const pratosOrdenados = [...pratos].sort(
    (a, b) => b.lucroReais * b.quantidadeVendidaPeriodo - a.lucroReais * a.quantidadeVendidaPeriodo
  );

  const isEstimativa = ate.toDateString() === agora.toDateString() && !ateParam;

  res.json({
    periodo: { desde: desde.toISOString(), ate: ate.toISOString() },
    estimativa: isEstimativa, // true = ainda dentro do mês corrente, número pode mudar
    pratos: pratosOrdenados,
    semFichaTecnica, // pratos que não têm como calcular ainda (faltou cadastrar ficha técnica)
  });
});

// GET /rentabilidade/relatorios — lista relatórios gerados automaticamente
router.get("/rentabilidade/relatorios", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const lista = relatoriosGerados
    .filter(r => r.companyId === companyId)
    .slice(0, 30);
  res.json(lista);
});

export default router;
