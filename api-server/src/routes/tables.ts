import { Router, type IRouter } from "express";
import { requireAnyAuth, requireOwnerAuth } from "./auth";
import {
  tables,
  createId,
  tableSessions,
  menuItems,
  orders,
  cashierAlerts,
  employees,
  findOpenSessionByTableId,
  recomputeSessionSubtotal,
  computeGuestShares,
  isSessionFullyPaid,
  resolverLojaId,
  pertenceALoja,
  checarResgatePorConsumo,
  financialMovements,
  registerFinancialMovement,
} from "../lib/data-store";
import type { FinancialPaymentMethod, SessionOrderItem } from "../lib/data-store";
import { scheduleSave } from "../lib/persistence";
import { fetchProviderPaymentStatus } from "./pix.js";

const router: IRouter = Router();

function persistTableFlow(): void {
  scheduleSave("tables", tables);
  scheduleSave("tableSessions", tableSessions);
  scheduleSave("orders", orders);
  scheduleSave("cashierAlerts", cashierAlerts);
}

// MULTI-LOJA (14/08/2026): loja opcional via header x-loja-id. Contas de
// loja única nunca precisam mandar isso — resolve pra loja padrão da conta.
function getLojaId(req: any, companyId: string): string {
  const solicitado = (req.headers["x-loja-id"] as string) || undefined;
  return resolverLojaId(companyId, solicitado);
}

function amountToCents(value: number): number {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("Valor de pagamento inválido");
  return cents;
}

function toFinancialPaymentMethod(method: "pix" | "card" | "cash" | "app"): FinancialPaymentMethod {
  return method === "pix" ? "pix" : method === "card" ? "card" : method === "app" ? "app" : "cash";
}

router.get("/tables", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const lojaId = getLojaId(req, companyId);
  res.json(tables.filter((t) => t.restaurantId === companyId && pertenceALoja(t.lojaId, lojaId, companyId)));
});

/** Cashier floor-plan view — all tables enriched with live session financials + pending ready orders */
router.get("/tables/with-sessions", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const lojaId = getLojaId(req, companyId);
  const result = tables.filter((t) => t.restaurantId === companyId && pertenceALoja(t.lojaId, lojaId, companyId)).map((table) => {
    const session = findOpenSessionByTableId(table.id) ?? null;
    const readyOrder = orders.find(
      (o) => o.tableId === table.id && o.status === "ready"
    ) ?? null;
    const activeOrder = !readyOrder
      ? orders.find((o) => o.tableId === table.id && ["pending", "preparing"].includes(o.status)) ?? null
      : null;

    let sessionInfo = null;
    if (session) {
      const shares = computeGuestShares(session);
      const paidGuestIds = new Set(
        session.payments.filter((p) => p.status === "paid").map((p) => p.guestId)
      );
      const paidAmount = session.payments
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0);
      sessionInfo = {
        id: session.id,
        subtotal: session.subtotal,
        paidAmount,
        pendingAmount: Math.max(0, session.subtotal - paidAmount),
        guestCount: session.guests.length,
        itemCount: session.items.reduce((s, i) => s + i.quantity, 0),
        splitMode: session.splitMode,
        fullyPaid: isSessionFullyPaid(session),
        guests: session.guests.map((g) => ({
          id: g.id,
          name: g.name,
          isComandante: g.isComandante,
          paid: paidGuestIds.has(g.id),
          amount: shares[g.id] ?? 0,
        })),
      };
    }

    return {
      ...table,
      session: sessionInfo,
      readyOrder: readyOrder
        ? { id: readyOrder.id, total: readyOrder.total, tableNumber: readyOrder.tableNumber,
            isPriority: readyOrder.isPriority, items: readyOrder.items, createdAt: readyOrder.createdAt }
        : null,
      activeOrder: activeOrder
        ? { id: activeOrder.id, total: activeOrder.total, status: activeOrder.status, createdAt: activeOrder.createdAt }
        : null,
    };
  });
  res.json(result);
});

/** Find table by its unique QR token (used by the client app when scanning) */
router.get("/tables/by-token/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = tables.find((t) => t.qrToken === token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }
  res.json(table);
});

/**
 * Find table + its current open session (or null) by the dedicated EXIT QR token.
 * The exit QR token identifies the table exactly like the entrance token does —
 * scanning it tells the app which table without needing anything else.
 */
router.get("/tables/by-exit-token/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = tables.find((t) => t.exitQrToken === token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }
  const session = findOpenSessionByTableId(table.id) ?? null;
  res.json({ table, session });
});

/** Create new table — qrToken/exitQrToken are generated automatically and are globally unique */
router.post("/tables", requireOwnerAuth, async (req, res): Promise<void> => {
  // REGRA MULTI-TENANT: restaurantId nunca vem do body — sempre do token.
  const restaurantId: string = (req as any).owner.companyId;
  const lojaId = getLojaId(req, restaurantId);
  const { number, seats } = req.body as {
    number: number;
    seats: number;
  };

  if (!number || !seats) {
    res.status(400).json({ error: "number e seats são obrigatórios" });
    return;
  }

  // Número de mesa só precisa ser único DENTRO da mesma loja — duas lojas da
  // mesma conta podem ambas ter uma "Mesa 1".
  const exists = tables.find(
    (t) => t.restaurantId === restaurantId && t.number === number && pertenceALoja(t.lojaId, lojaId, restaurantId)
  );
  if (exists) {
    res.status(409).json({ error: `Mesa #${number} já existe nesta loja` });
    return;
  }

  const newTable = {
    id: createId(),
    restaurantId,
    lojaId,
    number,
    seats,
    status: "free" as const,
    qrToken: createId(),
    exitQrToken: createId(),
  };

  tables.push(newTable);
  persistTableFlow();
  res.status(201).json(newTable);
});

router.delete("/tables/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const idx = tables.findIndex((t) => t.id === id && t.restaurantId === companyId);
  if (idx === -1) {
    res.status(404).json({ error: "Mesa não encontrada" });
    return;
  }
  tables.splice(idx, 1);
  persistTableFlow();
  res.status(204).send();
});

router.patch("/tables/:id/status", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const table = tables.find((t) => t.id === id && t.restaurantId === companyId);

  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada" });
    return;
  }

  const { status } = req.body as { status: "free" | "occupied" | "reserved" | "cleaning" | "paid" };

  if (!["free", "occupied", "reserved", "cleaning", "paid"].includes(status)) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }

  // Segurança: liberar mesa que acabou de ser paga (saída) só pode passar
  // pelo caixa — dono, ou funcionário com a chave closeCashier liberada.
  // Evita que qualquer funcionário libere a mesa por fora do caixa.
  if (status === "free" && table.status === "paid") {
    const auth = (req as any).auth;
    const isOwner = auth.role === "owner" || !auth.isEmployee;
    if (!isOwner) {
      const employee = employees.find((e) => e.id === auth.employeeId);
      if (!employee?.permissions?.closeCashier) {
        res.status(403).json({
          error: "Só o caixa pode liberar a mesa depois do pagamento. Peça pro caixa confirmar a saída.",
        });
        return;
      }
    }
  }

  table.status = status;
  persistTableFlow();
  res.json(table);
});

/** Unresolved cashier alerts — staff panel polls this to know which tables just finished paying.
 * CORRIGIDO (15/08/2026): não filtrava por restaurante — qualquer caixa autenticado
 * via alertas de pagamento de TODOS os restaurantes. */
router.get("/alerts", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  res.json(cashierAlerts.filter((a) => !a.resolvedAt && a.restaurantId === companyId));
});

router.post("/alerts/:id/resolve", requireAnyAuth, async (req, res): Promise<void> => {
  const companyId: string = (req as any).auth.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const alert = cashierAlerts.find((a) => a.id === id && a.restaurantId === companyId);
  if (!alert) {
    res.status(404).json({ error: "Alerta não encontrado" });
    return;
  }
  alert.resolvedAt = new Date().toISOString();
  persistTableFlow();
  res.json(alert);
});

// ─── Table Sessions ("a conta da mesa") ─────────────────────────────────────────
// Every guest at a table scans the SAME entrance QR. The first scan opens a
// session and that guest becomes the "comandante" (session owner); every
// following scan of that same QR joins the same open session as a guest.
// Everything below is simulated payment — no real money moves.

function findTableByToken(token: string) {
  return tables.find((t) => t.qrToken === token);
}

/** Close accepts either the entrance QR or the dedicated exit QR — both identify the same table. */
function findTableByAnyToken(token: string) {
  return tables.find((t) => t.qrToken === token || t.exitQrToken === token);
}

router.get("/tables/by-token/:token/session", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = findTableByToken(token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }
  res.json({ session: findOpenSessionByTableId(table.id) ?? null });
});

router.post("/tables/by-token/:token/session/join", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = findTableByToken(token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }

  const { guestName, guestId: rejoinGuestId } = req.body as { guestName?: string; guestId?: string };
  let session = findOpenSessionByTableId(table.id);

  // Rejoining with a guestId we already know (same device reopening the page)
  if (session && rejoinGuestId) {
    const existingGuest = session.guests.find((g) => g.id === rejoinGuestId);
    if (existingGuest) {
      res.json({ session, guestId: existingGuest.id });
      return;
    }
  }

  const now = new Date().toISOString();

  if (!session) {
    // First scan at this table opens a brand-new session; this guest commands it.
    const comandanteId = createId();
    session = {
      id: createId(),
      tableId: table.id,
      tableNumber: table.number,
      restaurantId: table.restaurantId,
      status: "open",
      splitMode: "equal",
      guests: [{ id: comandanteId, name: guestName?.trim() || "Comandante", isComandante: true, joinedAt: now }],
      items: [],
      payments: [],
      customAmounts: {},
      subtotal: 0,
      createdAt: now,
    };
    tableSessions.push(session);
    table.status = "occupied";
    persistTableFlow();
    res.json({ session, guestId: comandanteId });
    return;
  }

  // Session already open at this table — join it as a regular guest
  const guestId = createId();
  session.guests.push({
    id: guestId,
    name: guestName?.trim() || `Convidado ${session.guests.length + 1}`,
    isComandante: false,
    joinedAt: now,
  });
  persistTableFlow();
  res.json({ session, guestId });
});

router.post("/tables/by-token/:token/session/items", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = findTableByToken(token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }

  const session = findOpenSessionByTableId(table.id);
  if (!session) {
    res.status(404).json({ error: "Nenhuma sessão aberta nesta mesa. Escaneie o QR Code para entrar." });
    return;
  }

  const { guestId, items } = req.body as {
    guestId: string;
    items: { menuItemId: string; quantity: number; notes?: string }[];
  };

  if (!guestId || !session.guests.find((g) => g.id === guestId)) {
    res.status(400).json({ error: "guestId inválido para esta sessão" });
    return;
  }
  if (!items?.length) {
    res.status(400).json({ error: "items é obrigatório" });
    return;
  }

  const newItems: SessionOrderItem[] = items.map((input) => {
    const menuItem = menuItems.find((m) => m.id === input.menuItemId);
    return {
      id: createId(),
      guestId,
      menuItemId: input.menuItemId,
      name: menuItem?.name ?? "Item",
      price: menuItem?.price ?? 0,
      quantity: input.quantity,
      status: "pending" as const,
      notes: input.notes,
    };
  });

  session.items.push(...newItems);
  recomputeSessionSubtotal(session);

  // Mirror into the kitchen queue so Kitchen View / Dashboard reflect the real order
  let kitchenOrder = orders.find((o) => o.tableId === table.id && o.status !== "paid");
  if (!kitchenOrder) {
    kitchenOrder = {
      id: createId(),
      restaurantId: table.restaurantId,
      lojaId: table.lojaId,
      tableId: table.id,
      tableNumber: table.number,
      status: "pending",
      items: [],
      total: 0,
      isPriority: false,
      createdAt: new Date().toISOString(),
      estimatedMinutes: 15,
    };
    orders.push(kitchenOrder);
  }
  kitchenOrder.items.push(
    ...newItems.map((i) => ({ id: i.id, menuItemId: i.menuItemId, name: i.name, price: i.price, quantity: i.quantity, status: i.status, notes: i.notes }))
  );
  kitchenOrder.total = kitchenOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  persistTableFlow();
  res.json({ session, orderId: kitchenOrder.id });
});

router.patch("/tables/by-token/:token/session/split", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = findTableByToken(token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }

  const session = findOpenSessionByTableId(table.id);
  if (!session) {
    res.status(404).json({ error: "Nenhuma sessão aberta nesta mesa" });
    return;
  }

  const { mode, customAmounts } = req.body as {
    mode: "equal" | "byItems" | "custom";
    customAmounts?: { guestId: string; amount: number }[];
  };
  if (!["equal", "byItems", "custom"].includes(mode)) {
    res.status(400).json({ error: "mode inválido" });
    return;
  }

  session.splitMode = mode;
  if (mode === "custom") {
    const map: Record<string, number> = {};
    for (const entry of customAmounts ?? []) {
      if (session.guests.find((g) => g.id === entry.guestId) && entry.amount >= 0) {
        map[entry.guestId] = entry.amount;
      }
    }
    session.customAmounts = map;
  }
  persistTableFlow();
  res.json(session);
});

/**
 * Mark a guest's share as paid. Simulated — no real charge happens.
 * Supports "pix", "card" (guest pays their own share in-app) and "cash"
 * (comandante/waiter marks it paid after physically collecting the money).
 */
router.post("/tables/by-token/:token/session/pay", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = findTableByToken(token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }

  const session = findOpenSessionByTableId(table.id);
  if (!session) {
    res.status(404).json({ error: "Nenhuma sessão aberta nesta mesa" });
    return;
  }

  const { guestId, method, markedByStaff, paymentId } = req.body as {
    guestId: string;
    method: "pix" | "card" | "cash" | "app";
    markedByStaff?: boolean;
    paymentId?: string;
  };

  const guest = session.guests.find((g) => g.id === guestId);
  if (!guest) {
    res.status(400).json({ error: "guestId inválido para esta sessão" });
    return;
  }
  if (!["pix", "card", "cash", "app"].includes(method)) {
    res.status(400).json({ error: "method inválido (use pix, card, cash ou app)" });
    return;
  }
  if (method === "app" && (!paymentId || !String(paymentId).trim())) {
    res.status(400).json({ error: "paymentId é obrigatório para pagamento pelo App" });
    return;
  }

  const shares = computeGuestShares(session);
  const amount = shares[guestId] ?? 0;
  const idempotencyKey = `table-payment:${session.restaurantId}:${session.id}:${guestId}`;
  const existingPayment = session.payments.find((p) => p.guestId === guestId);
  if (method === "app") {
    const providerStatus = await fetchProviderPaymentStatus(String(paymentId));
    if (providerStatus !== "approved") {
      const pendingStatus = providerStatus === "rejected" || providerStatus === "cancelled" ? "failed" : providerStatus ? "reconciling" : "pending";
      const pendingPayment = existingPayment ?? { id: createId(), guestId, amount, method: "app" as const, status: "pending" as const };
      pendingPayment.amount = amount;
      pendingPayment.method = "app";
      pendingPayment.providerPaymentId = String(paymentId);
      pendingPayment.status = pendingStatus;
      pendingPayment.failureReason = pendingStatus === "failed" ? `Provedor: ${providerStatus}` : undefined;
      if (!existingPayment) session.payments.push(pendingPayment);
      persistTableFlow();
      res.status(pendingStatus === "failed" ? 402 : 202).json({ session, payment: pendingPayment, status: pendingStatus });
      return;
    }
  }
  const existingLedgerMovement = financialMovements.find((movement) =>
    movement.restaurantId === session.restaurantId &&
    movement.idempotencyKey === idempotencyKey &&
    movement.status === "posted",
  );
  if (existingPayment?.status === "paid" || existingLedgerMovement) {
    const paidAt = existingPayment?.paidAt ?? existingLedgerMovement?.occurredAt ?? new Date().toISOString();
    if (existingPayment) {
      existingPayment.amount = amount;
      existingPayment.method = method;
      existingPayment.status = "paid";
      existingPayment.paidAt = paidAt;
      existingPayment.providerPaymentId = method === "app" ? String(paymentId) : existingPayment.providerPaymentId;
      existingPayment.failureReason = undefined;
      existingPayment.markedByStaff = method === "cash" || !!markedByStaff;
    } else {
      session.payments.push({
        id: existingLedgerMovement?.sourceId ?? createId(),
        guestId,
        amount,
        method,
        status: "paid",
        paidAt,
        providerPaymentId: method === "app" ? String(paymentId) : undefined,
        markedByStaff: method === "cash" || !!markedByStaff,
      });
    }
    persistTableFlow();
    res.json(session);
    return;
  }
  const payment = existingPayment ?? { id: createId(), guestId, amount, method, status: "pending" as const };
  const paidAt = new Date().toISOString();
  try {
    registerFinancialMovement({
      restaurantId: session.restaurantId,
      lojaId: table.lojaId,
      kind: "sale",
      direction: "inflow",
      amountCents: amountToCents(amount),
      currency: "BRL",
      paymentMethod: toFinancialPaymentMethod(method),
      occurredAt: paidAt,
      sourceType: "table_session",
      sourceId: payment.id,
      idempotencyKey,
      tableSessionId: session.id,
      description: `Mesa #${table.number} — pagamento do convidado ${guestId}`,
      metadata: { guestId, markedByStaff: method === "cash" || !!markedByStaff },
    });
  } catch {
    res.status(400).json({ error: "Não foi possível registrar o pagamento no Ledger" });
    return;
  }
  if (!existingPayment) session.payments.push(payment);
  payment.amount = amount;
  payment.method = method;
  payment.status = "paid";
  payment.paidAt = paidAt;
  payment.providerPaymentId = method === "app" ? String(paymentId) : payment.providerPaymentId;
  payment.failureReason = undefined;
  payment.markedByStaff = method === "cash" || !!markedByStaff;

  // Every guest paid in full: the table becomes "semi-free" — guests are still
  // physically there, but the cashier is alerted and the table shows as settled
  // until someone scans the exit QR to actually release it.
  if (isSessionFullyPaid(session) && table.status !== "paid") {
    table.status = "paid";
    const alreadyAlerted = cashierAlerts.some((a) => a.tableId === table.id && !a.resolvedAt);
    if (!alreadyAlerted) {
      cashierAlerts.push({
        id: createId(),
        restaurantId: table.restaurantId,
        tableId: table.id,
        tableNumber: table.number,
        type: "payment_complete",
        createdAt: new Date().toISOString(),
      });
    }
  }

  persistTableFlow();
  res.json(session);
});

router.post("/tables/by-token/:token/session/close", requireAnyAuth, async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const table = findTableByAnyToken(token);
  if (!table) {
    res.status(404).json({ error: "Mesa não encontrada para este QR code" });
    return;
  }

  // Segurança: liberar mesa (fechar sessão / "saída") só pode passar pelo
  // caixa — dono, ou funcionário com a chave closeCashier liberada.
  const auth = (req as any).auth;
  const isOwner = auth.role === "owner" || !auth.isEmployee;
  if (!isOwner) {
    const employee = employees.find((e) => e.id === auth.employeeId);
    if (!employee?.permissions?.closeCashier) {
      res.status(403).json({
        error: "Só o caixa pode liberar a mesa na saída. Peça pro caixa confirmar.",
      });
      return;
    }
  }

  const session = findOpenSessionByTableId(table.id);
  if (!session) {
    res.status(404).json({ error: "Nenhuma sessão aberta nesta mesa" });
    return;
  }

  const { force } = (req.body ?? {}) as { force?: boolean };
  const shares = computeGuestShares(session);
  const paidGuestIds = new Set(session.payments.filter((p) => p.status === "paid").map((p) => p.guestId));
  const pendingGuests = session.guests.filter((g) => !paidGuestIds.has(g.id) && (shares[g.id] ?? 0) > 0);

  if (pendingGuests.length > 0 && !force) {
    res.status(409).json({
      ...session,
      pendingGuests: pendingGuests.map((g) => ({ id: g.id, name: g.name, amount: shares[g.id] ?? 0 })),
    });
    return;
  }

  session.status = "closed";
  session.closedAt = new Date().toISOString();
  // Guests scanned the exit QR (or staff force-closed) — the table is now actually
  // free of people; it goes to "cleaning" before it can be marked "free" again.
  table.status = "cleaning";

  // Any pending cashier alert for this table is resolved now that it's released.
  for (const alert of cashierAlerts) {
    if (alert.tableId === table.id && !alert.resolvedAt) alert.resolvedAt = session.closedAt;
  }

  const kitchenOrder = orders.find((o) => o.tableId === table.id && o.status !== "paid");
  if (kitchenOrder) {
    kitchenOrder.status = "paid";
    kitchenOrder.paidAt = session.closedAt;
    // Fidelidade — resgate por consumo (15/08/2026): só dispara quando o
    // pedido tem cliente autenticado vinculado (sessão de mesa anônima não
    // acumula fidelidade).
    if (kitchenOrder.clientAccountId && kitchenOrder.restaurantId) {
      checarResgatePorConsumo(kitchenOrder.restaurantId, kitchenOrder.clientAccountId);
    }
  }

  persistTableFlow();
  res.json(session);
});

export default router;
