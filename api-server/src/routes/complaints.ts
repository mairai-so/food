import { Router, type IRouter } from "express";
import { requireOwnerAuth, verifyToken } from "./auth";
import { randomUUID } from "crypto";
import { query, execute } from "../lib/db";
import { orders } from "../lib/data-store";

const router: IRouter = Router();

// ── GET /api/complaints/mine — reclamações do cliente autenticado
router.get("/complaints/mine", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  const payload = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Login necessário" });
    return;
  }
  const rows = await query(
    "SELECT * FROM complaints WHERE user_id = $1 ORDER BY created_at DESC",
    [payload.clientId],
  );
  res.json(rows);
});

// ── GET /api/complaints/:userId — listar reclamações do usuário
router.get("/complaints/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const rows = await query(
    "SELECT * FROM complaints WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  res.json(rows);
});

// ── GET /api/complaints/admin/all — todas as reclamações (painel restaurante)
router.get("/complaints/admin/all", requireOwnerAuth, async (req, res): Promise<void> => {
  const { status, restaurantId } = req.query as { status?: string; restaurantId?: string };
  let sql = "SELECT * FROM complaints WHERE 1=1";
  const params: unknown[] = [];

  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  if (restaurantId) { params.push(restaurantId); sql += ` AND restaurant_id = $${params.length}`; }
  sql += " ORDER BY created_at DESC LIMIT 100";

  const rows = await query(sql, params);
  res.json(rows);
});

// ── POST /api/complaints — abrir reclamação
router.post("/complaints", async (req, res): Promise<void> => {
  const {
    userId: requestedUserId,
    orderId,
    restaurantId,
    restaurantName,
    type,
    description,
  } = req.body as {
    userId?: string;
    orderId?: string;
    restaurantId?: string;
    restaurantName?: string;
    type?: string;
    description: string;
  };

  const header = req.headers.authorization;
  const payload = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Login necessário" });
    return;
  }
  const userId = payload.clientId;
  if (requestedUserId && requestedUserId !== userId) {
    res.status(403).json({ error: "Usuário inválido" });
    return;
  }
  if (!orderId) {
    res.status(400).json({ error: "Pedido é obrigatório para abrir uma reclamação" });
    return;
  }
  const order = orders.find(order => order.id === orderId);
  if (!order || order.clientAccountId !== userId) {
    res.status(403).json({ error: "Pedido não pertence ao usuário autenticado" });
    return;
  }
  if (restaurantId && order.restaurantId !== restaurantId) {
    res.status(400).json({ error: "Restaurante não corresponde ao pedido" });
    return;
  }

  // Janela de 3 dias pra reclamação/sugestão: dá tempo pro cliente refletir
  // sem o constrangimento de reclamar na hora, mas não fica aberto pra sempre.
  const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;
  const pedidoEm = new Date(order.createdAt).getTime();
  if (!Number.isNaN(pedidoEm) && Date.now() - pedidoEm > TRES_DIAS_MS) {
    res.status(400).json({
      error: "O prazo de 3 dias após o pedido pra abrir reclamação ou sugestão já passou.",
    });
    return;
  }

  if (!description?.trim()) {
    res.status(400).json({ error: "Descrição obrigatória" });
    return;
  }

  const id = randomUUID();
  await execute(
    `INSERT INTO complaints (id, user_id, order_id, restaurant_id, restaurant_name, type, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, userId ?? null, orderId ?? null, restaurantId ?? null, restaurantName ?? null, type ?? "outro", description]
  );

  res.status(201).json({ id, status: "aberta", message: "Reclamação registrada. Retornaremos em até 24h." });
});

// ── PATCH /api/complaints/:id/respond — responder reclamação (painel)
router.patch("/complaints/:id/respond", requireOwnerAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { response, status } = req.body as { response: string; status: string };

  const validStatuses = ["em_analise", "resolvida", "encerrada"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }

  await execute(
    `UPDATE complaints SET staff_response = $1, status = $2, updated_at = NOW() WHERE id = $3`,
    [response, status, id]
  );

  res.json({ ok: true });
});

export default router;
