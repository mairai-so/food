import { Router, type IRouter } from "express";
import { requireAnyAuth } from "./auth.js";
import { randomUUID } from "crypto";
import { waiterCalls, tables, type WaiterCall } from "../lib/data-store.js";

const router: IRouter = Router();

// CORRIGIDO (15/08/2026) — vazamento multi-tenant: WaiterCall não tinha
// restaurantId, então GET /waiter-calls devolvia as chamadas de TODOS os
// restaurantes pra qualquer garçom autenticado, e /claim deixava qualquer
// garçom "atender" a chamada de um restaurante que não é o dele.

// GET /api/waiter-calls — lista chamadas pendentes (garçom faz polling),
// filtradas pelo restaurante (e loja, quando a conta usa multi-loja) do
// garçom autenticado.
router.get("/waiter-calls", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const lojaId = req.headers["x-loja-id"] as string | undefined;
  const pending = waiterCalls.filter(
    (c) => c.status === "pending" && c.restaurantId === companyId && (!lojaId || !c.lojaId || c.lojaId === lojaId)
  );
  res.json(pending);
});

// POST /api/waiter-calls — cliente chama o garçom da mesa. Sem token de
// staff (é o cliente na mesa quem chama) — o restaurante é derivado da
// própria mesa, nunca aceito do body, pra não dar pra falsificar a
// chamada pra outro restaurante.
router.post("/waiter-calls", (req, res): void => {
  const { tableId, tableNumber, message } = req.body as {
    tableId: string;
    tableNumber: number;
    message?: string;
  };

  if (!tableId || tableNumber === undefined) {
    res.status(400).json({ error: "tableId e tableNumber são obrigatórios" });
    return;
  }

  const table = tables.find((t) => t.id === tableId);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada" });
    return;
  }

  // Remove chamada pendente anterior da mesma mesa (evita duplicatas)
  const existing = waiterCalls.findIndex(
    (c) => c.tableId === tableId && c.status === "pending"
  );
  if (existing !== -1) waiterCalls.splice(existing, 1);

  const call: WaiterCall = {
    id: randomUUID(),
    restaurantId: table.restaurantId,
    lojaId: table.lojaId,
    tableId,
    tableNumber,
    message: message?.trim() || undefined,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  waiterCalls.push(call);
  res.status(201).json(call);
});

// PATCH /api/waiter-calls/:id/claim — garçom confirma "peguei". Só pode
// atender chamada do próprio restaurante.
router.patch("/waiter-calls/:id/claim", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const { id } = req.params;
  const { waiterName } = req.body as { waiterName?: string };

  const call = waiterCalls.find((c) => c.id === id);
  if (!call) {
    res.status(404).json({ error: "Chamada não encontrada" });
    return;
  }
  if (call.restaurantId !== companyId) {
    res.status(403).json({ error: "Esta chamada não é do seu restaurante" });
    return;
  }
  if (call.status === "claimed") {
    res.status(409).json({ error: "Chamada já foi atendida por outro garçom" });
    return;
  }

  call.status = "claimed";
  call.claimedBy = waiterName?.trim() || "Garçom";
  call.claimedAt = new Date().toISOString();
  res.json(call);
});

export default router;
