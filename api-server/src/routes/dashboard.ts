import { Router, type IRouter } from "express";
import { orders, tables, preOrders, listarLojas, stockItems, getCurrentCashierSession, pertenceALoja } from "../lib/data-store";
import { requireOwnerAuth } from "./auth";

const router: IRouter = Router();

// CORRIGIDO (15/08/2026) — vazamento multi-tenant: não filtrava por
// restaurante, então devolvia pedidos/mesas de TODOS os restaurantes da
// plataforma somados. Também removidos os valores fake hardcoded
// (`revenueToday > 0 ? revenueToday : 2145`) que apareciam como fallback
// sempre que o faturamento real do dia era zero — dado de demonstração
// misturado com lógica real é o tipo de coisa que a seção 32 do manual
// pede pra nunca deixar passar.
router.get("/dashboard/stats", requireOwnerAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).owner.companyId;

  const meusOrders = orders.filter((o) => o.restaurantId === companyId);
  const minhasTables = tables.filter((t) => t.restaurantId === companyId);
  const meusPreOrders = preOrders.filter((p) => p.restaurantId === companyId);

  const openOrders = meusOrders.filter((o) => !["paid", "delivered"].includes(o.status)).length;
  const occupiedTables = minhasTables.filter((t) => ["occupied", "reserved"].includes(t.status)).length;
  const totalTables = minhasTables.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const paidToday = meusOrders.filter((o) => o.paidAt && new Date(o.paidAt) >= today);
  const revenueToday = paidToday.reduce((sum, o) => sum + o.total, 0);
  const tipsToday = Math.round(revenueToday * 0.1 * 100) / 100;

  const preOrdersPending = meusPreOrders.filter((p) => p.status === "pending").length;
  const arrivalsSoon = meusPreOrders.filter((p) => {
    if (p.status !== "pending" || !p.expectedArrivalAt) return false;
    const arrival = new Date(p.expectedArrivalAt);
    const now = new Date();
    return arrival.getTime() - now.getTime() < 15 * 60000;
  }).length;

  res.json({
    openOrders,
    occupiedTables,
    totalTables,
    revenueToday,
    tipsToday,
    preOrdersPending,
    arrivalsSoon,
  });
});

export default router;

// GET /dashboard/lojas — resumo por loja, base da visão "lojas lado a
// lado" da Central de Comando (15/08/2026). Uma linha por loja ativa da
// conta, com os números que já existem em Estoque/Mesas/Pedidos/Caixa,
// só agrupados por lojaId em vez de olhar a conta inteira junta.
router.get("/dashboard/lojas", requireOwnerAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).owner.companyId;
  const lojas = listarLojas(companyId).filter((l) => l.ativa);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const resumo = lojas.map((loja) => {
    // pertenceALoja já trata "sem lojaId" como pertencente à loja padrão da
    // conta — mesmo critério usado em todo o resto do sistema.
    const mesasDaLoja = tables.filter((t) => t.restaurantId === companyId && pertenceALoja(t.lojaId, loja.id, companyId));
    const pedidosDaLoja = orders.filter((o) => o.restaurantId === companyId && pertenceALoja(o.lojaId, loja.id, companyId));
    const estoqueDaLoja = stockItems.filter((s) => s.restaurantId === companyId && pertenceALoja(s.lojaId, loja.id, companyId));

    const pedidosPagosHoje = pedidosDaLoja.filter((o) => o.paidAt && new Date(o.paidAt) >= today);
    const faturamentoHoje = pedidosPagosHoje.reduce((s, o) => s + o.total, 0);

    const sessaoCaixa = getCurrentCashierSession(companyId, loja.id);
    const estoqueBaixo = estoqueDaLoja.filter((s) => s.quantity <= s.minQuantity).length;

    return {
      lojaId: loja.id,
      nome: loja.nome,
      endereco: loja.endereco,
      mesasOcupadas: mesasDaLoja.filter((t) => ["occupied", "reserved"].includes(t.status)).length,
      totalMesas: mesasDaLoja.length,
      pedidosAbertos: pedidosDaLoja.filter((o) => !["paid", "delivered"].includes(o.status)).length,
      faturamentoHoje,
      caixaAberto: !!sessaoCaixa,
      alertasEstoque: estoqueBaixo,
    };
  });

  res.json(resumo);
});
