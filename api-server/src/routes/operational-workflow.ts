import { Router, type IRouter } from "express";
import {
  applyOperationalPayment,
  getOperationalWorkflowNextStatus,
  type OperationalWorkflowOrder,
  type OperationalWorkflowOrderStatus,
} from "../lib/operational-workflow.js";
import {
  createId,
  orders as persistedOrders,
  restaurants,
  resolverLojaId,
  type Order,
} from "../lib/data-store.js";
import { saveSnapshotConfirmed } from "../lib/persistence.js";
import { requireAnyAuth } from "./auth.js";

const router: IRouter = Router();

type OperationalInput = {
  restaurantName?: string;
  customerName?: string;
  mode: "delivery" | "pickup" | "dine-in";
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  phone?: string;
  address?: string;
  etaMinutes?: number;
  kind?: "pizza" | "churrasco" | "generic";
  customization?: Record<string, unknown>;
};

function restaurantNameFor(companyId: string, fallback?: string): string {
  return fallback ?? restaurants.find((restaurant) => restaurant.id === companyId)?.name ?? "MIAR AI/FOOD";
}

function operationalStatusFor(order: Order): OperationalWorkflowOrderStatus {
  if (order.operationalStatus) return order.operationalStatus;
  if (order.status === "preparing") return "preparing";
  if (order.status === "ready") return "ready";
  if (order.status === "delivered" || order.status === "paid") return "completed";
  return "received";
}

function toOperationalOrder(order: Order): OperationalWorkflowOrder {
  return {
    id: order.id,
    restaurantId: order.restaurantId ?? "",
    restaurantName: restaurantNameFor(order.restaurantId ?? ""),
    customerName: order.customerName ?? "Cliente",
    mode: order.mode ?? "dine-in",
    status: operationalStatusFor(order),
    items: order.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
    total: order.total,
    createdAt: order.createdAt,
    etaMinutes: order.estimatedMinutes,
  };
}

function persistentStatusFor(status: OperationalWorkflowOrderStatus): Order["status"] {
  if (status === "preparing") return "preparing";
  if (status === "ready") return "ready";
  if (status === "delivering" || status === "completed") return "delivered";
  return "pending";
}

function buildPersistentOrder(companyId: string, input: OperationalInput): Order {
  const now = new Date().toISOString();
  return {
    id: createId(),
    restaurantId: companyId,
    lojaId: resolverLojaId(companyId),
    tableId: "sem-mesa",
    tableNumber: 0,
    status: "pending",
    operationalStatus: "received",
    mode: input.mode,
    items: input.items.map((item) => ({
      id: createId(),
      // Fluxos especiais antigos (pizza/churrasco) não escolhem um item do
      // cardápio. O pedido continua persistente, mas não baixa estoque sem
      // ficha técnica correspondente.
      menuItemId: `operational-${createId()}`,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      status: "pending",
    })),
    total: input.total,
    isPriority: false,
    customerName: input.customerName ?? "Cliente",
    createdAt: now,
    estimatedMinutes: input.etaMinutes ?? 25,
  };
}

async function saveOrders(): Promise<void> {
  await saveSnapshotConfirmed("orders", persistedOrders);
}

function findCompanyOrder(companyId: string, id: string): Order | undefined {
  return persistedOrders.find((order) => order.id === id && order.restaurantId === companyId);
}

async function createOperationalOrder(companyId: string, input: OperationalInput): Promise<OperationalWorkflowOrder> {
  const order = buildPersistentOrder(companyId, input);
  persistedOrders.push(order);
  await saveOrders();
  const operational = toOperationalOrder(order);
  if (input.kind) operational.kind = input.kind;
  if (input.customization) operational.customization = input.customization;
  return operational;
}

router.post("/operational-workflow/orders", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).auth.companyId as string;
  const body = req.body as OperationalInput;
  const record = await createOperationalOrder(companyId, body);
  res.status(201).json(record);
});

router.post("/operational-workflow/orders/pizza", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).auth.companyId as string;
  const body = req.body as {
    restaurantName: string;
    customerName: string;
    mode: "delivery" | "pickup" | "dine-in";
    size: string;
    flavor: string;
    split?: string;
    edge?: string;
    additions?: string[];
    removals?: string[];
    estimatedMinutes?: number;
    total: number;
  };
  const enriched = await createOperationalOrder(companyId, {
    restaurantName: body.restaurantName,
    customerName: body.customerName,
    mode: body.mode,
    items: [{ name: `${body.size} ${body.flavor}`, quantity: 1, price: body.total }],
    total: body.total,
    etaMinutes: body.estimatedMinutes ?? 25,
    kind: "pizza",
    customization: {
      size: body.size,
      flavor: body.flavor,
      split: body.split ?? "full",
      edge: body.edge ?? "normal",
      additions: body.additions ?? [],
      removals: body.removals ?? [],
      stage: "massa -> recheio -> forno -> acabamento",
    },
  });
  res.status(201).json(enriched);
});

router.post("/operational-workflow/orders/churrasco", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).auth.companyId as string;
  const body = req.body as {
    restaurantName: string;
    customerName: string;
    mode: "delivery" | "pickup" | "dine-in";
    cut: string;
    weight?: number;
    doneness: string;
    sides?: string[];
    total: number;
    estimatedMinutes?: number;
  };
  const enriched = await createOperationalOrder(companyId, {
    restaurantName: body.restaurantName,
    customerName: body.customerName,
    mode: body.mode,
    items: [{ name: `${body.cut} • ${body.doneness}`, quantity: 1, price: body.total }],
    total: body.total,
    etaMinutes: body.estimatedMinutes ?? 30,
    kind: "churrasco",
    customization: {
      cut: body.cut,
      weight: body.weight ?? 0,
      doneness: body.doneness,
      sides: body.sides ?? [],
      note: "Corte com acompanhamento específico",
    },
  });
  res.status(201).json(enriched);
});

router.get("/operational-workflow/orders", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId = (req as any).auth.companyId as string;
  res.json(persistedOrders.filter((order) => order.restaurantId === companyId).map(toOperationalOrder));
});

router.patch("/operational-workflow/orders/:id/status", requireAnyAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const companyId = (req as any).auth.companyId as string;
  const order = findCompanyOrder(companyId, id);
  if (!order) {
    res.status(404).json({ error: "pedido não encontrado" });
    return;
  }
  const { status } = req.body as { status: OperationalWorkflowOrderStatus };
  order.operationalStatus = status;
  order.status = persistentStatusFor(status);
  await saveOrders();
  res.json(toOperationalOrder(order));
});

router.post("/operational-workflow/orders/:id/payment", requireAnyAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const companyId = (req as any).auth.companyId as string;
  const order = findCompanyOrder(companyId, id);
  if (!order) {
    res.status(404).json({ error: "pedido não encontrado" });
    return;
  }
  const current = toOperationalOrder(order);
  const paid = applyOperationalPayment(current);
  order.operationalStatus = paid.status;
  order.status = "ready";
  order.paymentStatus = "paid";
  order.paidAt = new Date().toISOString();
  await saveOrders();
  res.json({ ok: true, order: toOperationalOrder(order) });
});

router.post("/operational-workflow/orders/:id/advance", requireAnyAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const companyId = (req as any).auth.companyId as string;
  const order = findCompanyOrder(companyId, id);
  if (!order) {
    res.status(404).json({ error: "pedido não encontrado" });
    return;
  }
  const requestedStage = (req.body as { stage?: string }).stage;
  const stage = requestedStage === "delivered" ? "delivery" : requestedStage === "cashier" ? "cashier" : "kitchen";
  const current = operationalStatusFor(order);
  const next = requestedStage === "delivered"
    ? "completed"
    : getOperationalWorkflowNextStatus(current, stage);
  order.operationalStatus = next;
  order.status = persistentStatusFor(next);
  if (next === "completed") order.paidAt = order.paidAt ?? new Date().toISOString();
  await saveOrders();
  res.json(toOperationalOrder(order));
});

export default router;
