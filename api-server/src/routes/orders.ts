import { Router, type IRouter } from "express";
import { requireAnyAuth, verifyToken } from "./auth";
import { randomUUID } from "crypto";
import { preOrders, orders, tables, restaurants, menuItems, baixarEstoquePorPedido, resolverLojaId, pertenceALoja } from "../lib/data-store";
import { saveSnapshotConfirmed } from "../lib/persistence.js";
import type { PreOrder, Order, OrderItem } from "../lib/data-store";
import { broadcast } from "../lib/sse";
import { fetchProviderPaymentStatus } from "./pix.js";

const router: IRouter = Router();

// MULTI-LOJA (14/08/2026): usado pelas rotas do lado do gestor/cozinha
// (autenticadas). O App Cliente não manda esse header — nesses casos a loja
// do pedido é derivada da mesa escolhida (ver criação de Order/PreOrder abaixo).
function getLojaId(req: any, companyId: string): string {
  const solicitado = (req.headers["x-loja-id"] as string) || undefined;
  return resolverLojaId(companyId, solicitado);
}

function isValidOrderQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

// ─── Public order from client app (no auth required) ──────────────────────────

router.post("/orders", requireAnyAuth, async (req, res): Promise<void> => {
  const body = req.body as {
    restaurantId?: string;
    tableId?: string;
    items: { menuItemId: string; quantity: number; notes?: string }[];
    mode?: string;
    paymentMethod?: string;
    paymentId?: string;
    customerName?: string;
    vehiclePlate?: string;
  };
  const authenticatedCompanyId = (req as any).auth?.companyId as string | undefined;
  const requestedLojaId = typeof req.headers["x-loja-id"] === "string" ? req.headers["x-loja-id"] : undefined;
  const requestedRestaurantId = typeof body.restaurantId === "string" ? body.restaurantId.trim() : undefined;
  if (authenticatedCompanyId && requestedRestaurantId && requestedRestaurantId !== authenticatedCompanyId) {
    res.status(403).json({ error: "O restaurante do pedido não pertence à sessão autenticada" });
    return;
  }
  const restaurantId = authenticatedCompanyId ?? requestedRestaurantId;

  if (!restaurantId || !body.items?.length) {
    res.status(400).json({ error: "restaurantId (ou sessão autenticada) e items são obrigatórios" });
    return;
  }

  const restaurant = restaurants.find((r) => r.id === restaurantId);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurante não encontrado" });
    return;
  }

  if (body.items.some((input) => !isValidOrderQuantity(input.quantity) || !menuItems.some((item) => item.id === input.menuItemId && item.restaurantId === restaurantId))) {
    res.status(400).json({ error: "Item de cardápio inválido ou quantidade inválida" });
    return;
  }

  let paymentStatus: Order["paymentStatus"] = body.paymentMethod === "pix" ? "pending" : undefined;
  if (body.paymentMethod === "pix") {
    if (!body.paymentId) {
      res.status(400).json({ error: "paymentId é obrigatório para pedido Pix" });
      return;
    }
    try {
      if (await fetchProviderPaymentStatus(body.paymentId) !== "approved") {
        res.status(402).json({ error: "Pagamento Pix ainda não foi confirmado pelo provedor" });
        return;
      }
      paymentStatus = "paid";
    } catch {
      res.status(502).json({ error: "Não foi possível confirmar o pagamento Pix" });
      return;
    }
  }

  const orderItems: OrderItem[] = body.items.map((input) => {
    const menuItem = menuItems.find((m) => m.id === input.menuItemId);
    return {
      id: randomUUID(),
      menuItemId: input.menuItemId,
      name: menuItem?.name ?? "Item",
      price: menuItem?.price ?? 0,
      quantity: input.quantity,
      status: "pending" as const,
      notes: input.notes,
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const requestedTable = body.tableId && body.tableId !== "balcao"
    ? tables.find((t) => t.id === body.tableId && t.restaurantId === restaurantId)
    : undefined;
  const table = requestedTable ?? (body.mode === "dine-in"
    ? tables.find((t) => t.restaurantId === restaurantId)
    : undefined);

  // Se o cliente estiver autenticado, extrai o clientAccountId do token JWT.
  let clientAccountId: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyToken(authHeader.slice(7));
    if (payload?.isClientUser && typeof payload.clientId === "string") {
      clientAccountId = payload.clientId;
    }
  }

  const order: Order = {
    id: randomUUID(),
    restaurantId,
    // Cliente não escolhe loja explicitamente — herda a loja da mesa
    // escolhida. Sem mesa (ex. delivery/pickup/balcão sem mesa), cai na loja padrão.
    lojaId: table?.lojaId ?? resolverLojaId(restaurantId, requestedLojaId),
    tableId: table?.id ?? "sem-mesa",
    tableNumber: table?.number ?? 0,
    items: orderItems,
    status: paymentStatus === "paid" ? "paid" : "pending",
    mode: (body.mode as Order["mode"]) ?? "dine-in",
    total,
    isPriority: false,
    paymentMethod: body.paymentMethod,
    paymentId: body.paymentId,
    paymentStatus,
    paidAt: paymentStatus === "paid" ? new Date().toISOString() : undefined,
    clientAccountId,
    customerName: body.customerName,
    vehiclePlate: body.mode === "pickup" ? body.vehiclePlate?.trim().toUpperCase() || undefined : undefined,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 15,
  };

  orders.push(order);
  try {
    await saveSnapshotConfirmed("orders", orders);
  } catch {
    const failedOrderIndex = orders.findIndex((candidate) => candidate.id === order.id);
    if (failedOrderIndex >= 0) orders.splice(failedOrderIndex, 1);
    res.status(503).json({ error: "Não foi possível persistir o pedido" });
    return;
  }
  broadcast("order:new", { id: order.id, tableNumber: order.tableNumber, mode: order.mode, total: order.total });

  res.status(201).json(order);
});

router.get("/orders/mine", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  const payload = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Login necessário" });
    return;
  }
  res.json(orders.filter((order) => order.clientAccountId === payload.clientId));
});

// ─── Pre-Orders ───────────────────────────────────────────────────────────────

router.post("/pre-orders", async (req, res): Promise<void> => {
  const body = req.body as {
    restaurantId: string;
    tableId: string;
    items: { menuItemId: string; quantity: number; notes?: string }[];
    payNow: boolean;
    expectedArrivalMinutes?: number;
    customerName?: string;
    customerPhone?: string;
    persons?: number;
  };

  if (!body.restaurantId || !body.tableId || !body.items?.length) {
    res.status(400).json({ error: "restaurantId, tableId e items são obrigatórios" });
    return;
  }

  if (body.items.some((input) => !isValidOrderQuantity(input.quantity))) {
    res.status(400).json({ error: "Quantidade inválida: use um inteiro finito maior que zero" });
    return;
  }

  const restaurant = restaurants.find((r) => r.id === body.restaurantId);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurante não encontrado" });
    return;
  }

  const table = tables.find((t) => t.id === body.tableId && t.restaurantId === body.restaurantId);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada neste restaurante" });
    return;
  }

  if (body.items.some((input) => !menuItems.some((item) => item.id === input.menuItemId && item.restaurantId === body.restaurantId))) {
    res.status(400).json({ error: "Item de cardápio inválido para este restaurante" });
    return;
  }

  const orderItems: OrderItem[] = body.items.map((input) => {
    const menuItem = menuItems.find((m) => m.id === input.menuItemId);
    return {
      id: randomUUID(),
      menuItemId: input.menuItemId,
      name: menuItem?.name ?? "Item",
      price: menuItem?.price ?? 0,
      quantity: input.quantity,
      status: "pending" as const,
      notes: input.notes,
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const expectedArrivalAt = body.expectedArrivalMinutes
    ? new Date(Date.now() + body.expectedArrivalMinutes * 60000).toISOString()
    : undefined;

  const preOrder: PreOrder = {
    id: randomUUID(),
    restaurantId: body.restaurantId,
    restaurantName: restaurant.name,
    tableId: body.tableId,
    tableNumber: table.number,
    status: "pending",
    items: orderItems,
    total,
    isPriority: body.payNow,
    paidAt: body.payNow ? new Date().toISOString() : undefined,
    expectedArrivalAt,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    createdAt: new Date().toISOString(),
  };

  preOrders.push(preOrder);
  const statusAnteriorMesa = table.status;
  const preOrderAnteriorMesa = table.preOrderId;
  table.status = "reserved";
  table.preOrderId = preOrder.id;

  try {
    await saveSnapshotConfirmed("preOrders", preOrders);
    await saveSnapshotConfirmed("tables", tables);
  } catch {
    preOrders.splice(preOrders.findIndex((candidate) => candidate.id === preOrder.id), 1);
    table.status = statusAnteriorMesa;
    table.preOrderId = preOrderAnteriorMesa;
    res.status(503).json({ error: "Não foi possível persistir o pré-pedido" });
    return;
  }

  res.status(201).json(preOrder);
});

// CORRIGIDO EM 14/08/2026: antes retornava TODOS os pré-pedidos de TODOS os
// restaurantes sem nenhum filtro — vazamento de dados multi-tenant grave.
// Agora filtra por companyId, e por loja quando a conta usa multi-loja.
router.get("/pre-orders", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const lojaId = getLojaId(req, companyId);
  res.json(preOrders.filter((p) => p.restaurantId === companyId && pertenceALoja(p.lojaId, lojaId, companyId)));
});

router.patch("/pre-orders/:id/arrival", requireAnyAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const preOrder = preOrders.find((p) => p.id === id);

  if (!preOrder) {
    res.status(404).json({ error: "Pré-pedido não encontrado" });
    return;
  }

  preOrder.status = "arrived";
  preOrder.arrivedAt = new Date().toISOString();

  const existingOrder = orders.find((o) => o.tableId === preOrder.tableId);
  if (!existingOrder) {
    const kitchenOrder: Order = {
      id: randomUUID(),
      restaurantId: preOrder.restaurantId,
      tableId: preOrder.tableId,
      tableNumber: preOrder.tableNumber,
      status: "preparing",
      items: preOrder.items,
      total: preOrder.total,
      isPriority: preOrder.isPriority,
      paidAt: preOrder.paidAt,
      customerName: preOrder.customerName,
      createdAt: new Date().toISOString(),
      estimatedMinutes: 15,
    };
    orders.push(kitchenOrder);
  }

  try {
    await saveSnapshotConfirmed("preOrders", preOrders);
    await saveSnapshotConfirmed("orders", orders);
  } catch {
    res.status(503).json({ error: "Não foi possível persistir a chegada do pré-pedido" });
    return;
  }

  res.json(preOrder);
});

// ─── Kitchen Orders ───────────────────────────────────────────────────────────

// CORRIGIDO EM 14/08/2026: antes retornava TODOS os pedidos de TODOS os
// restaurantes sem filtro nenhum — a Cozinha de um restaurante via pedido de
// outro restaurante junto. Vazamento de dados multi-tenant grave, corrigido
// junto com o filtro de loja (multi-loja).
router.get("/orders", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const lojaId = getLojaId(req, companyId);
  res.json(orders.filter((o) => o.restaurantId === companyId && pertenceALoja(o.lojaId, lojaId, companyId)));
});

router.patch("/orders/:id/status", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = orders.find((o) => o.id === id && o.restaurantId === companyId);

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const { status } = req.body as { status: Order["status"] };
  const statusAnterior = order.status;
  if (status === "delivered" && statusAnterior !== "paid") {
    res.status(409).json({ error: "O pedido precisa estar pago antes de ser concluído" });
    return;
  }
  const paidAtAnterior = order.paidAt;
  const estoqueBaixadoAnterior = order.estoqueBaixado;
  const table = tables.find((t) => t.id === order.tableId);
  const statusAnteriorMesa = table?.status;
  order.status = status;

  // Baixa automática de estoque: dispara na confirmação (pending -> preparing),
  // uma única vez por pedido (estoqueBaixado evita descontar 2x se o status
  // for setado pra "preparing" mais de uma vez por engano).
  if (status === "preparing" && statusAnterior !== "preparing" && !order.estoqueBaixado) {
    const resultado = baixarEstoquePorPedido(order, companyId);
    order.estoqueBaixado = true;
    if (resultado.movimentos.length > 0) {
      broadcast("stock-baixa-automatica", { orderId: order.id, movimentos: resultado.movimentos });
    }
  }

  if (status === "paid") {
    order.paidAt = new Date().toISOString();
    if (table) table.status = "cleaning";
  }

  try {
    await saveSnapshotConfirmed("orders", orders);
    if (table) await saveSnapshotConfirmed("tables", tables);
  } catch {
    order.status = statusAnterior;
    order.paidAt = paidAtAnterior;
    order.estoqueBaixado = estoqueBaixadoAnterior;
    if (table && statusAnteriorMesa) table.status = statusAnteriorMesa;
    res.status(503).json({ error: "Não foi possível persistir o status do pedido" });
    return;
  }

  res.json(order);
});

// Public endpoint — order status tracking (no auth required, returns limited info)
router.get("/orders/:id/public-status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }
  res.json({
    id: order.id,
    status: order.status,
    mode: order.mode,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, status: i.status })),
    total: order.items.reduce((s, i) => s + i.price * i.quantity, 0),
  });
});

export default router;
