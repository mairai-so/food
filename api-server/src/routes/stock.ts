import { Router, type IRouter } from "express";
import {
  stockItems,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  resolverLojaId,
  pertenceALoja,
  itemDeEstoquePertenceALoja,
  LOJA_ID_COMPARTILHADO,
} from "../lib/data-store";
import { requireAnyAuth } from "./auth";

const router: IRouter = Router();

// CORRIGIDO EM 29/07/2026: antes havia um RESTAURANT_ID = "rest-1" fixo aqui,
// que fazia TODOS os restaurantes cadastrados compartilharem o mesmo estoque.
// Agora o id vem sempre do token de quem está autenticado (dono ou funcionário),
// nunca de uma constante. Isso é o que garante isolamento real entre restaurantes.
function getCompanyId(req: any): string {
  return req.auth?.companyId;
}

// MULTI-LOJA (14/08/2026): loja é opcional via header x-loja-id. Contas de
// loja única nunca precisam mandar isso — resolve pra loja padrão da conta.
function getLojaId(req: any, companyId: string): string {
  const solicitado = (req.headers["x-loja-id"] as string) || undefined;
  return resolverLojaId(companyId, solicitado);
}

// GET /stock — all items for the restaurant, filtrado pela loja ativa
router.get("/stock", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const items = stockItems.filter(i => i.restaurantId === companyId && itemDeEstoquePertenceALoja(i.lojaId, lojaId, companyId));
  res.json(items);
});

// POST /stock — create item
router.post("/stock", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaIdDaLojaAtiva = getLojaId(req, companyId);
  const body = req.body as any;
  if (!body.name || !body.category || body.quantity == null || !body.unit) {
    res.status(400).json({ error: "name, category, quantity e unit são obrigatórios" });
    return;
  }
  // Escolha no cadastro (15/08/2026): "compartilhado" = mesmo item, mesmo
  // saldo, visível/descontado em qualquer loja da conta. Default (sem o
  // campo) continua sendo o comportamento de sempre: item da loja ativa.
  const lojaId = body.compartilhado === true ? LOJA_ID_COMPARTILHADO : lojaIdDaLojaAtiva;
  const item = createStockItem({
    restaurantId: companyId,
    lojaId,
    name: body.name,
    category: body.category,
    quantity: Number(body.quantity),
    unit: body.unit,
    minQuantity: Number(body.minQuantity ?? 0),
    alertDaysBefore: Number(body.alertDaysBefore ?? 3),
    expiresAt: body.expiresAt ?? undefined,
    unitCost: body.unitCost != null ? Number(body.unitCost) : undefined,
  });
  res.status(201).json(item);
});

// PATCH /stock/:id — update quantity / expiry / etc.
router.patch("/stock/:id", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const { id } = req.params as { id: string };
  const updates = req.body as any;

  // CORRIGIDO: antes não checava se o item pertence a este restaurante —
  // qualquer restaurante logado podia editar item de outro só sabendo o id.
  const existing = stockItems.find(i => i.id === id);
  if (!existing || existing.restaurantId !== companyId) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }

  // Reversível (15/08/2026): tela de Configurações troca compartilhado <->
  // separado a qualquer momento sem perder histórico do item. Quando volta
  // pra "separado", usa a loja ativa de quem está editando no momento.
  if (updates.compartilhado === true) {
    updates.lojaId = LOJA_ID_COMPARTILHADO;
  } else if (updates.compartilhado === false) {
    updates.lojaId = getLojaId(req, companyId);
  }

  const now = new Date().toISOString();
  if (updates.quantity !== undefined) updates.lastCountedAt = now;

  const item = updateStockItem(id, updates);
  if (!item) { res.status(404).json({ error: "Item não encontrado" }); return; }
  res.json(item);
});

// DELETE /stock/:id
router.delete("/stock/:id", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const { id } = req.params as { id: string };

  // CORRIGIDO: mesma checagem de posse do PATCH acima.
  const existing = stockItems.find(i => i.id === id);
  if (!existing || existing.restaurantId !== companyId) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }

  const ok = deleteStockItem(id);
  if (!ok) { res.status(404).json({ error: "Item não encontrado" }); return; }
  res.status(204).send();
});

// POST /stock/bulk — upsert multiple items (from AI count)
router.post("/stock/bulk", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const { items } = req.body as {
    items: Array<{
      id?: string;
      name: string;
      category: string;
      quantity: number;
      unit: string;
      expiresAt?: string;
      minQuantity?: number;
      alertDaysBefore?: number;
    }>;
  };

  if (!Array.isArray(items)) {
    res.status(400).json({ error: "items deve ser um array" });
    return;
  }

  const results = items.map(it => {
    if (it.id) {
      // Update existing — só se pertencer a este restaurante.
      const existing = stockItems.find(i => i.id === it.id);
      if (!existing || existing.restaurantId !== companyId) return null;
      const updated = updateStockItem(it.id, {
        quantity: it.quantity,
        expiresAt: it.expiresAt,
        lastCountedAt: new Date().toISOString(),
      });
      return updated;
    }
    // Create new
    return createStockItem({
      restaurantId: companyId,
      lojaId,
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      unit: it.unit,
      minQuantity: it.minQuantity ?? 0,
      alertDaysBefore: it.alertDaysBefore ?? 3,
      expiresAt: it.expiresAt ?? undefined,
    });
  }).filter(Boolean);

  res.json(results);
});

export default router;
