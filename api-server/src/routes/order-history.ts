import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { query, queryOne, execute } from "../lib/db";
import { requireAnyAuth } from "./auth.js";

const router: IRouter = Router();

// ── GET /api/orders/history/:userId — histórico de pedidos do cliente
// Protegido: só equipe autenticada (garçom, caixa, entregador, gestor)
// pode consultar histórico e gasto de um cliente — antes qualquer pessoa
// na internet conseguia, só sabendo/adivinhando o userId.
router.get("/orders/history/:userId", requireAnyAuth, async (req, res): Promise<void> => {
  const { userId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const rows = await query<{
    id: string;
    restaurant_id: string;
    restaurant_name: string;
    items: unknown;
    total: string;
    status: string;
    payment_method: string;
    table_number: number;
    created_at: string;
  }>(
    `SELECT * FROM order_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  // Total gasto
  const aggRow = await queryOne<{ total_spent: string; count: string }>(
    "SELECT COALESCE(SUM(total),0) AS total_spent, COUNT(*) AS count FROM order_history WHERE user_id = $1",
    [userId]
  );

  // Gasto no mês atual
  const monthRow = await queryOne<{ month_spent: string }>(
    `SELECT COALESCE(SUM(total),0) AS month_spent FROM order_history
     WHERE user_id = $1 AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
    [userId]
  );

  res.json({
    orders: rows.map((r) => ({ ...r, total: parseFloat(r.total) })),
    totalSpent: parseFloat(aggRow?.total_spent ?? "0"),
    totalOrders: parseInt(aggRow?.count ?? "0"),
    monthSpent: parseFloat(monthRow?.month_spent ?? "0"),
  });
});

// ── POST /api/orders/history — registra pedido no histórico
router.post("/orders/history", requireAnyAuth, async (req, res): Promise<void> => {
  const {
    userId,
    restaurantId,
    restaurantName,
    items,
    total,
    status = "entregue",
    paymentMethod,
    tableNumber,
  } = req.body as {
    userId: string;
    restaurantId?: string;
    restaurantName?: string;
    items?: unknown[];
    total?: number;
    status?: string;
    paymentMethod?: string;
    tableNumber?: number;
  };

  if (!userId) {
    res.status(400).json({ error: "userId obrigatório" });
    return;
  }

  const id = randomUUID();
  await execute(
    `INSERT INTO order_history
       (id, user_id, restaurant_id, restaurant_name, items, total, status, payment_method, table_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      userId,
      restaurantId ?? null,
      restaurantName ?? null,
      JSON.stringify(items ?? []),
      total ?? 0,
      status,
      paymentMethod ?? null,
      tableNumber ?? null,
    ]
  );

  res.status(201).json({ id });
});

// ── GET /api/orders/spending/:userId — relatório de gastos por mês
router.get("/orders/spending/:userId", requireAnyAuth, async (req, res): Promise<void> => {
  const { userId } = req.params;

  const monthly = await query<{ month: string; total: string; count: string }>(
    `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
            SUM(total) AS total,
            COUNT(*) AS count
     FROM order_history
     WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
     GROUP BY 1 ORDER BY 1 DESC`,
    [userId]
  );

  const byRestaurant = await query<{ restaurant_name: string; total: string; count: string }>(
    `SELECT restaurant_name, SUM(total) AS total, COUNT(*) AS count
     FROM order_history
     WHERE user_id = $1 AND restaurant_name IS NOT NULL
     GROUP BY restaurant_name ORDER BY total DESC LIMIT 5`,
    [userId]
  );

  res.json({
    monthly: monthly.map((r) => ({ month: r.month, total: parseFloat(r.total), count: parseInt(r.count) })),
    byRestaurant: byRestaurant.map((r) => ({
      restaurantName: r.restaurant_name,
      total: parseFloat(r.total),
      count: parseInt(r.count),
    })),
  });
});

export default router;
