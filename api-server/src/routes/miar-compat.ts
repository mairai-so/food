/**
 * Rotas de compatibilidade para o MIAR AI/FOOD Premium.
 * Mapeia os endpoints que o cockpit premium (miar-ai-food) precisa
 * para os dados do data-store existente.
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { restaurants, menuItems, tables, orders, stockItems } from "../lib/data-store";
import { requireOwnerAuth } from "./auth.js";

const router: IRouter = Router();

// Trava geral: nada nesta camada de compatibilidade é público. Ela expõe
// nome/endereço de TODOS os restaurantes cadastrados e estatísticas globais
// (visão "cockpit premium" entre estabelecimentos) — sem login, qualquer
// pessoa na internet conseguia listar todos os restaurantes da plataforma.
// Aviso: isto exige login de UM dono (requireOwnerAuth), o que impede acesso
// anônimo, mas não isola dados entre restaurantes diferentes — um dono
// autenticado ainda vê a lista de todos. Para isolar de verdade entre
// clientes da plataforma, será necessário um papel de "administrador da
// plataforma" separado do papel de dono de restaurante.
router.use(requireOwnerAuth);

// ─── Establishments (alias para restaurants) ─────────────────────────────────

// Lista todos os estabelecimentos (view SaaS)
router.get("/establishments", (_req, res): void => {
  const plans = ["Essencial", "Inteligente IA", "Premium"];
  const statuses = ["active", "trial", "active", "active", "active"];
  const cities = ["São Paulo", "Campinas", "Rio de Janeiro", "Belo Horizonte", "Curitiba"];

  const result = restaurants.map((r, idx) => ({
    id: idx + 1,
    name: r.name,
    type: r.cuisine,
    planId: (idx % 3) + 1,
    planName: plans[idx % 3],
    status: statuses[idx % statuses.length],
    city: cities[idx % cities.length],
    address: r.address,
    createdAt: new Date(Date.now() - (idx + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  res.json(result);
});

// GET single establishment
router.get("/establishments/:id", (req, res): void => {
  const numId = parseInt(req.params.id as string, 10);
  const restId = `rest-${numId}`;
  const r = restaurants.find((x) => x.id === restId) ?? restaurants[0];

  const plans = ["Essencial", "Inteligente IA", "Premium"];
  res.json({
    id: numId,
    name: r.name,
    type: r.cuisine,
    planId: 3,
    planName: plans[2],
    status: "active",
    city: "São Paulo",
    address: r.address,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

// POST – cria novo estabelecimento (cadastro)
router.post("/establishments", (req, res): void => {
  const body = req.body as {
    name: string;
    type?: string;
    ownerName?: string;
    email?: string;
    phone?: string;
    planId?: number;
    address?: string;
    city?: string;
  };

  const plans: Record<number, string> = { 1: "Essencial", 2: "Inteligente IA", 3: "Premium" };
  const planId = body.planId ?? 2;

  const newEst = {
    id: restaurants.length + 1,
    name: body.name,
    type: body.type ?? "restaurant",
    planId,
    planName: plans[planId] ?? "Inteligente IA",
    status: planId >= 2 ? "trial" : "active",
    city: body.city ?? "",
    address: body.address ?? "",
    ownerName: body.ownerName ?? "",
    email: body.email ?? "",
    phone: body.phone ?? "",
    createdAt: new Date().toISOString(),
  };

  // Also add to data-store so it persists in memory
  restaurants.push({
    id: `rest-${newEst.id}`,
    name: body.name,
    rating: 0,
    distance: 0,
    pricePerPerson: 0,
    cuisine: body.type ?? "restaurant",
    address: body.address ?? "",
    preOrderEnabled: true,
    reserveMesasEnabled: true,
    qrEntranceEnabled: true,
    priorityPaymentEnabled: true,
    openNow: true,
    waitTime: 0,
  });

  res.status(201).json(newEst);
});

// ─── Menu / Categories / Products per establishment ───────────────────────────

router.get("/establishments/:id/categories", (req, res): void => {
  const numId = parseInt(req.params.id as string, 10);
  const restId = `rest-${numId}`;
  const items = menuItems.filter((m) => m.restaurantId === restId);

  const catMap = new Map<string, { id: number; name: string; icon: string; sortOrder: number }>();
  let idx = 1;
  for (const item of items) {
    if (!catMap.has(item.category)) {
      const icons: Record<string, string> = {
        "Carnes": "🥩", "Bebidas": "🍺", "Petiscos": "🍟", "Sobremesas": "🍰",
        "Entradas": "🥗", "Massas": "🍝", "Peixes": "🐟", "Vegano": "🌱",
      };
      catMap.set(item.category, {
        id: idx++,
        name: item.category,
        icon: icons[item.category] ?? "🍽️",
        sortOrder: idx,
      });
    }
  }

  res.json(Array.from(catMap.values()));
});

router.get("/establishments/:id/products", (req, res): void => {
  const numId = parseInt(req.params.id as string, 10);
  const restId = `rest-${numId}`;
  const items = menuItems.filter((m) => m.restaurantId === restId);

  // Build category ID map
  const catMap = new Map<string, number>();
  let catIdx = 1;
  for (const item of items) {
    if (!catMap.has(item.category)) catMap.set(item.category, catIdx++);
  }

  const result = items.map((m, i) => ({
    id: i + 1,
    name: m.name,
    description: m.description,
    price: m.price,
    imageUrl: null,
    available: m.available,
    featured: i < 3,
    categoryId: catMap.get(m.category) ?? 1,
    categoryName: m.category,
  }));

  res.json(result);
});

// PATCH – toggle product availability
router.patch("/establishments/:estId/products/:productId", (req, res): void => {
  const numId = parseInt(req.params.estId as string, 10);
  const prodIdx = parseInt(req.params.productId as string, 10) - 1;
  const restId = `rest-${numId}`;
  const items = menuItems.filter((m) => m.restaurantId === restId);

  if (prodIdx >= 0 && prodIdx < items.length) {
    const { available } = req.body as { available?: boolean };
    if (available !== undefined) items[prodIdx].available = available;
    res.json({ ...items[prodIdx], id: prodIdx + 1, available: items[prodIdx].available });
  } else {
    res.status(404).json({ error: "Produto não encontrado" });
  }
});

// ─── Orders for establishment ─────────────────────────────────────────────────

router.get("/establishments/:id/orders", (_req, res): void => {
  const result = orders.map((o) => ({
    id: o.id,
    tableNumber: o.tableNumber,
    status: o.status,
    total: o.total,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    items: o.items.map((it) => ({
      id: it.id,
      quantity: it.quantity,
      productName: it.name,
      notes: it.notes ?? null,
    })),
  }));
  res.json(result);
});

// POST – create a simple order (from cliente cardápio)
router.post("/establishments/:id/orders", (req, res): void => {
  const body = req.body as {
    tableId?: number;
    items: { productId: number; quantity: number; notes?: string }[];
  };

  const numId = parseInt(req.params.id as string, 10);
  const restId = `rest-${numId}`;
  const restItems = menuItems.filter((m) => m.restaurantId === restId);

  const orderItems = body.items.map((it) => {
    const menu = restItems[it.productId - 1] ?? restItems[0];
    return {
      id: randomUUID(),
      menuItemId: menu?.id ?? "unknown",
      name: menu?.name ?? "Item",
      price: menu?.price ?? 0,
      quantity: it.quantity,
      status: "pending" as const,
      notes: it.notes,
    };
  });

  const total = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const newOrder = {
    id: randomUUID(),
    tableId: `table-${body.tableId ?? 1}`,
    tableNumber: body.tableId ?? 1,
    status: "pending" as const,
    items: orderItems,
    total,
    isPriority: false,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 15,
  };

  orders.push(newOrder);
  res.status(201).json(newOrder);
});

// PATCH – update order status (compatibility alias)
router.patch("/establishments/:estId/orders/:orderId", (req, res): void => {
  const { orderId } = req.params as { orderId: string };
  const { status } = req.body as { status: string };

  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  (order as any).status = status;
  if (status === "paid" || status === "delivered") {
    (order as any).paidAt = new Date().toISOString();
  }

  res.json({
    id: order.id,
    tableNumber: order.tableNumber,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items.map((it) => ({ id: it.id, quantity: it.quantity, productName: it.name, notes: it.notes ?? null })),
  });
});

// ─── Tables for establishment ─────────────────────────────────────────────────

router.get("/establishments/:id/tables", (req, res): void => {
  const numId = parseInt(req.params.id as string, 10);
  const restId = `rest-${numId}`;
  const restTables = tables.filter((t) => t.restaurantId === restId);

  const result = restTables.map((t) => ({
    id: t.id,
    number: t.number,
    status: t.status,
    capacity: t.seats,
  }));

  res.json(result);
});

// ─── Inventory / Stock per establishment ──────────────────────────────────────

router.get("/establishments/:id/inventory", (_req, res): void => {
  const result = stockItems.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    minQuantity: item.minQuantity,
    lowStock: item.quantity < item.minQuantity,
    expiresAt: item.expiresAt ?? null,
    alertDaysBefore: item.alertDaysBefore,
  }));
  res.json(result);
});

// ─── Analytics per establishment ──────────────────────────────────────────────

router.get("/establishments/:id/analytics/summary", (_req, res): void => {
  const paidOrders = orders.filter((o) => o.paidAt);
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0) || 18420;
  const totalOrders = orders.length || 47;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 89.5;
  const occupiedTables = tables.filter((t) => t.status === "occupied" || t.status === "reserved").length;
  const occupancyRate = tables.length > 0 ? (occupiedTables / tables.length) * 100 : 62;

  res.json({
    totalRevenue,
    revenueGrowth: 12.4,
    totalOrders,
    avgTicket,
    occupancyRate,
    topCategory: "Carnes",
    satisfactionScore: 92,
  });
});

router.get("/establishments/:id/analytics/hourly-sales", (_req, res): void => {
  const slots = [
    { hour: "11h", revenue: 320 },
    { hour: "12h", revenue: 1850 },
    { hour: "13h", revenue: 2640 },
    { hour: "14h", revenue: 980 },
    { hour: "15h", revenue: 410 },
    { hour: "16h", revenue: 290 },
    { hour: "17h", revenue: 560 },
    { hour: "18h", revenue: 1240 },
    { hour: "19h", revenue: 3180 },
    { hour: "20h", revenue: 4210 },
    { hour: "21h", revenue: 3890 },
    { hour: "22h", revenue: 2750 },
    { hour: "23h", revenue: 1680 },
  ];
  res.json(slots);
});

router.get("/establishments/:id/analytics/top-products", (req, res): void => {
  const numId = parseInt(req.params.id as string, 10);
  const restId = `rest-${numId}`;
  const items = menuItems.filter((m) => m.restaurantId === restId).slice(0, 8);

  const trends: Array<"up" | "down" | "stable"> = ["up", "up", "stable", "down", "up", "stable", "up", "down"];

  const result = items.map((item, idx) => ({
    productName: item.name,
    totalSold: Math.floor(80 - idx * 8 + Math.random() * 10),
    revenue: parseFloat(((80 - idx * 8) * item.price).toFixed(2)),
    trend: trends[idx % trends.length],
    imageUrl: null,
  }));

  res.json(result);
});

// ─── IA / Sugestões por estabelecimento ──────────────────────────────────────

router.get("/establishments/:id/ai/suggestions", (_req, res): void => {
  res.json([
    {
      type: "combo",
      title: "Criar Combo Final de Semana",
      description: "Seus dados mostram que Picanha + Chopp têm 73% de pedido conjunto às sextas. Crie um combo com 12% de desconto para aumentar o ticket médio.",
      impact: "high",
      estimatedGain: 18,
    },
    {
      type: "estoque",
      title: "Reposição Urgente: Pão de Queijo",
      description: "Estoque de Pão de Queijo vai zerar em ~2 horas no ritmo atual. Peça ao fornecedor ou reduza visibilidade no cardápio temporariamente.",
      impact: "high",
      estimatedGain: 0,
    },
    {
      type: "cardapio",
      title: "Destaque Moqueca de Camarão",
      description: "Este prato tem margem 34% maior que a média e avaliação 4.9. Colocá-lo como destaque pode aumentar pedidos em 22%.",
      impact: "medium",
      estimatedGain: 22,
    },
    {
      type: "operacao",
      title: "Ajustar Escala para Pico de Sábado",
      description: "Histórico mostra ocupação de 98% entre 20h-22h nos sábados. Adicionar 1 atendente nesse turno reduz tempo de espera em 40%.",
      impact: "medium",
      estimatedGain: 12,
    },
    {
      type: "fidelizacao",
      title: "Programa de Retorno para Clientes 30+ dias",
      description: "42 clientes não retornam há mais de 30 dias. Uma promoção personalizada via WhatsApp pode trazer de volta até 60% deles.",
      impact: "low",
      estimatedGain: 8,
    },
  ]);
});

router.get("/establishments/:id/ai/demand-forecast", (req, res): void => {
  const numId = parseInt(req.params.id as string, 10);
  const restId = `rest-${numId}`;
  const items = menuItems.filter((m) => m.restaurantId === restId).slice(0, 6);

  const result = items.map((item, idx) => ({
    productName: item.name,
    predictedDemand: Math.floor(40 - idx * 5 + Math.random() * 8),
    confidence: Math.floor(88 - idx * 3),
    suggestedStock: Math.floor(50 - idx * 5 + 10),
  }));

  res.json(result);
});

// ─── Admin stats (global SaaS view) ──────────────────────────────────────────

router.get("/admin/stats", (_req, res): void => {
  res.json({
    totalRevenue: 48_750,
    activeEstablishments: restaurants.length,
    trialEstablishments: 3,
    recentSignups: 12,
    totalEstablishments: restaurants.length + 3,
    planBreakdown: [
      { planName: "Essencial", count: 8, revenue: 800 },
      { planName: "Inteligente IA", count: 14, revenue: 2800 },
      { planName: "Premium", count: 9, revenue: 2700 },
    ],
  });
});

export default router;
