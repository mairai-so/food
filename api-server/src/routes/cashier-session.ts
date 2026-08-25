import { Router, type IRouter } from "express";
import { requireAnyAuth } from "./auth";
import { randomUUID } from "crypto";
import {
  cashierSessions,
  getCurrentCashierSession,
  getCashierSummary,
  resolverLojaId,
  pertenceALoja,
  type CashierMovement,
  type CashierMovementType,
  type CashierSession,
  type FinancialDirection,
  type FinancialMovementKind,
  type FinancialPaymentMethod,
  registerFinancialMovement,
} from "../lib/data-store";
import { scheduleSave } from "../lib/persistence.js";

const router: IRouter = Router();

function getCompanyId(req: any): string {
  return req.auth?.companyId ?? req.owner?.companyId;
}

// Loja é opcional no header (x-loja-id). Contas de loja única nunca precisam
// mandar isso — cai automaticamente na loja padrão da conta.
function getLojaId(req: any, companyId: string): string {
  const solicitado = (req.headers["x-loja-id"] as string) || undefined;
  return resolverLojaId(companyId, solicitado);
}

function amountToCents(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function paymentMethodForMovement(type: CashierMovementType): FinancialPaymentMethod | null {
  switch (type) {
    case "sale_cash": return "cash";
    case "sale_card": return "card";
    case "sale_debit": return "debit";
    case "sale_credit": return "credit";
    case "sale_voucher": return "voucher";
    case "sale_pix": return "pix";
    case "sale_app": return "app";
    case "sale_mixed": return "mixed";
    case "open":
    case "close":
    case "sangria":
    case "reforco": return "cash";
    default: return null;
  }
}

function registerCashierFinancialMovement(session: CashierSession, movement: CashierMovement): void {
  const amountCents = amountToCents(movement.amount);
  if (amountCents == null) throw new Error("amount inválido");

  let kind: FinancialMovementKind;
  let direction: FinancialDirection;
  if (movement.type.startsWith("sale_")) {
    kind = "sale";
    // Pix/cartão/voucher ainda são apenas registros operacionais neste
    // projeto; sem captura/provedor confirmado não podem virar receita
    // liquidada no Financeiro. Dinheiro físico é confirmado pelo caixa.
    const nonCashUnverified = movement.type !== "sale_cash" && movement.type !== "sale_mixed";
    const mixedHasNonCash = movement.type === "sale_mixed" && !!movement.paymentBreakdown && (
      (movement.paymentBreakdown.pix ?? 0) > 0 ||
      (movement.paymentBreakdown.cartao ?? 0) > 0 ||
      (movement.paymentBreakdown.debito ?? 0) > 0 ||
      (movement.paymentBreakdown.credito ?? 0) > 0 ||
      (movement.paymentBreakdown.voucher ?? 0) > 0
    );
    direction = nonCashUnverified || mixedHasNonCash ? "memo" : "inflow";
  } else if (movement.type === "sangria") {
    kind = "cash_out";
    direction = "outflow";
  } else if (movement.type === "reforco") {
    kind = "cash_in";
    direction = "inflow";
  } else if (movement.type === "open") {
    kind = "cashier_open";
    direction = "memo";
  } else if (movement.type === "close") {
    kind = "cashier_close";
    direction = "memo";
  } else {
    return;
  }

  // Zero is a valid opening/closing count but is not a financial movement.
  if (amountCents === 0) return;
  const paymentMethod = paymentMethodForMovement(movement.type);
  if (!paymentMethod) return;
  const breakdown = movement.paymentBreakdown;
  const paymentBreakdownCents = breakdown
    ? {
        ...(breakdown.dinheiro != null ? { cash: amountToCents(breakdown.dinheiro) ?? 0 } : {}),
        ...(breakdown.cartao != null ? { card: amountToCents(breakdown.cartao) ?? 0 } : {}),
        ...(breakdown.debito != null ? { debit: amountToCents(breakdown.debito) ?? 0 } : {}),
        ...(breakdown.credito != null ? { credit: amountToCents(breakdown.credito) ?? 0 } : {}),
        ...(breakdown.voucher != null ? { voucher: amountToCents(breakdown.voucher) ?? 0 } : {}),
        ...(breakdown.pix != null ? { pix: amountToCents(breakdown.pix) ?? 0 } : {}),
        ...(breakdown.app != null ? { app: amountToCents(breakdown.app) ?? 0 } : {}),
      }
    : undefined;
  const idempotencyKey = movement.orderId
    ? `cashier-sale:${session.restaurantId}:${movement.orderId}:${movement.type}`
    : `cashier-movement:${session.id}:${movement.id}`;

  registerFinancialMovement({
    restaurantId: session.restaurantId,
    lojaId: session.lojaId,
    kind,
    direction,
    amountCents,
    currency: "BRL",
    paymentMethod,
    occurredAt: movement.timestamp,
    sourceType: "cashier_session",
    sourceId: movement.id,
    idempotencyKey,
    orderId: movement.orderId,
    cashierSessionId: session.id,
    operatorName: movement.operatorName,
    description: movement.description,
    paymentBreakdownCents,
    metadata: movement.type.startsWith("sale_") && movement.type !== "sale_cash"
      ? { settlementStatus: "unverified_non_cash" }
      : undefined,
  });
}

// ─── GET current open session ─────────────────────────────────────────────────
router.get("/cashier/session/current", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const session = getCurrentCashierSession(companyId, lojaId);
  if (!session) { res.json({ session: null }); return; }
  res.json({ session, summary: getCashierSummary(session) });
});

// ─── GET session history ──────────────────────────────────────────────────────
router.get("/cashier/session/history", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const closed = cashierSessions
    .filter(s => s.status === 'closed' && s.restaurantId === companyId && pertenceALoja(s.lojaId, lojaId, companyId))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .slice(0, 30)
    .map(s => ({ ...s, summary: getCashierSummary(s) }));
  res.json(closed);
});

// ─── POST open session ────────────────────────────────────────────────────────
router.post("/cashier/session/open", requireAnyAuth, (req, res): void => {
  const companyId: string = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const existing = getCurrentCashierSession(companyId, lojaId);
  if (existing) {
    res.status(409).json({ error: "Já existe um turno aberto nesta loja", session: existing });
    return;
  }

  const { initialFloat, operatorName, openingDenominations } = req.body as { initialFloat: number; operatorName: string; openingDenominations?: Record<string, number> };
  const initialFloatNumber = Number(initialFloat);
  if (initialFloat == null || !Number.isFinite(initialFloatNumber) || initialFloatNumber < 0 || !operatorName) {
    res.status(400).json({ error: "initialFloat válido e operatorName são obrigatórios" });
    return;
  }

  const openMovement: CashierMovement = {
    id: randomUUID(), type: 'open', amount: initialFloatNumber,
    description: `Abertura de turno — Fundo R$ ${initialFloatNumber.toFixed(2)}`,
    operatorName, timestamp: new Date().toISOString(),
  };

  const session: CashierSession = {
    id: randomUUID(), restaurantId: companyId, lojaId,
    openedAt: new Date().toISOString(), status: 'open',
    initialFloat: initialFloatNumber, operatorName,
    movements: [openMovement],
    openingDenominations,
  };
  try {
    registerCashierFinancialMovement(session, openMovement);
  } catch {
    res.status(400).json({ error: "Não foi possível registrar a abertura no Ledger" });
    return;
  }
  cashierSessions.push(session);
  scheduleSave("cashierSessions", cashierSessions);
  res.status(201).json({ session, summary: getCashierSummary(session) });
});

// ─── POST close session ───────────────────────────────────────────────────────
router.post("/cashier/session/:id/close", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const { id } = req.params;
  // CORRIGIDO: antes não checava dono nem loja — bastava saber o id do turno
  // pra fechar o caixa de outro restaurante.
  const session = cashierSessions.find(s => s.id === id && s.status === 'open' && s.restaurantId === companyId && pertenceALoja(s.lojaId, lojaId, companyId));
  if (!session) { res.status(404).json({ error: "Turno não encontrado ou já fechado" }); return; }

  const { actualCash, operatorName, closingNotes, closingDenominations } = req.body as {
    actualCash: number; operatorName: string; closingNotes?: string; closingDenominations?: Record<string, number>;
  };

  const actualCashNumber = Number(actualCash);
  if (actualCash == null || !Number.isFinite(actualCashNumber) || actualCashNumber < 0 || !operatorName) {
    res.status(400).json({ error: "actualCash válido e operatorName são obrigatórios" });
    return;
  }
  const summary = getCashierSummary(session);
  const expectedCash = summary.cashInDrawer;
  const difference = actualCashNumber - expectedCash;
  const closeMovement: CashierMovement = {
    id: randomUUID(), type: 'close', amount: actualCashNumber,
    description: `Fechamento — Contagem R$ ${actualCashNumber.toFixed(2)} (diff: ${difference >= 0 ? '+' : ''}${difference.toFixed(2)})`,
    operatorName, timestamp: new Date().toISOString(),
  };

  try {
    registerCashierFinancialMovement(session, closeMovement);
  } catch {
    res.status(400).json({ error: "Não foi possível registrar o fechamento no Ledger" });
    return;
  }
  session.movements.push(closeMovement);
  session.status = 'closed';
  session.closedAt = new Date().toISOString();
  session.expectedCash = expectedCash;
  session.actualCash = actualCashNumber;
  session.difference = difference;
  session.closingNotes = closingNotes;
  session.closingDenominations = closingDenominations;
  scheduleSave("cashierSessions", cashierSessions);

  res.json({ session, summary, difference, expectedCash });
});

// ─── POST handoff — entrega do turno com ou sem sangria ────────────────────────
router.post("/cashier/session/:id/handoff", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const { id } = req.params;
  const session = cashierSessions.find((s) => s.id === id && s.status === "open" && s.restaurantId === companyId && pertenceALoja(s.lojaId, lojaId, companyId));
  if (!session) { res.status(404).json({ error: "Turno não encontrado ou já fechado" }); return; }

  const body = req.body as {
    mode?: "with_sangria" | "without_sangria";
    actualCash?: number;
    operatorName?: string;
    closingNotes?: string;
    incomingNotes?: string;
    closingDenominations?: Record<string, number>;
  };
  const actualCash = Number(body.actualCash);
  if ((body.mode !== "with_sangria" && body.mode !== "without_sangria") || !Number.isFinite(actualCash) || actualCash < 0) {
    res.status(400).json({ error: "mode e actualCash válidos são obrigatórios" });
    return;
  }

  const auth = (req as any).auth as { name?: string; employeeId?: string; isEmployee?: boolean };
  const outgoingOperatorName = String(auth?.name ?? body.operatorName ?? session.operatorName ?? "Caixa").trim();
  if (!outgoingOperatorName) { res.status(400).json({ error: "operatorName é obrigatório" }); return; }
  const expectedCash = getCashierSummary(session).cashInDrawer;
  const difference = actualCash - expectedCash;
  const now = new Date().toISOString();

  try {
    if (body.mode === "with_sangria" && actualCash > 0) {
      const sangria: CashierMovement = {
        id: randomUUID(), type: "sangria", amount: actualCash,
        description: "Sangria integral na troca de operador",
        operatorName: outgoingOperatorName, timestamp: now,
      };
      registerCashierFinancialMovement(session, sangria);
      session.movements.push(sangria);
    }
    const close: CashierMovement = {
      id: randomUUID(), type: "close", amount: body.mode === "with_sangria" ? 0 : actualCash,
      description: `Troca de operador — ${body.mode === "with_sangria" ? "com sangria" : "sem sangria"} — Contagem R$ ${actualCash.toFixed(2)}`,
      operatorName: outgoingOperatorName, timestamp: now,
    };
    registerCashierFinancialMovement(session, close);
    session.movements.push(close);
    session.status = "closed";
    session.closedAt = now;
    session.expectedCash = expectedCash;
    session.actualCash = actualCash;
    session.difference = difference;
    session.closingNotes = body.closingNotes;
    session.closingDenominations = body.closingDenominations;
    session.handoff = {
      mode: body.mode,
      outgoingOperatorName,
      outgoingNotes: body.closingNotes,
      countedCash: actualCash,
      at: now,
    };
    scheduleSave("cashierSessions", cashierSessions);
    res.json({ session, summary: getCashierSummary(session), expectedCash, actualCash, difference, handoff: session.handoff });
  } catch {
    res.status(400).json({ error: "Não foi possível registrar a troca no Ledger" });
  }
});

// ─── POST handoff/receive — recebimento autenticado do próximo operador ───────
router.post("/cashier/session/handoff/receive", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const body = req.body as {
    previousSessionId?: string;
    initialFloat?: number;
    operatorName?: string;
    incomingNotes?: string;
    openingDenominations?: Record<string, number>;
  };
  const previous = cashierSessions.find((s) => s.id === body.previousSessionId && s.status === "closed" && s.restaurantId === companyId && pertenceALoja(s.lojaId, lojaId, companyId));
  if (!previous?.handoff) { res.status(404).json({ error: "Entrega de turno não encontrada" }); return; }
  if (previous.handoff.receivedAt) { res.status(409).json({ error: "Esta entrega já foi recebida" }); return; }
  if (getCurrentCashierSession(companyId, lojaId)) { res.status(409).json({ error: "Já existe um turno aberto nesta loja" }); return; }

  const initialFloat = Number(body.initialFloat);
  const expectedHandoffFloat = previous.handoff.mode === "without_sangria" ? previous.handoff.countedCash ?? 0 : undefined;
  if (!Number.isFinite(initialFloat) || initialFloat < 0 || (expectedHandoffFloat !== undefined && Math.abs(initialFloat - expectedHandoffFloat) > 0.005)) {
    res.status(400).json({ error: "O fundo recebido não coincide com a entrega do turno" });
    return;
  }
  const auth = (req as any).auth as { name?: string; employeeId?: string };
  const incomingOperatorName = String(auth?.name ?? body.operatorName ?? "Caixa").trim();
  if (!incomingOperatorName) { res.status(400).json({ error: "operatorName é obrigatório" }); return; }

  const now = new Date().toISOString();
  const openMovement: CashierMovement = {
    id: randomUUID(), type: "open", amount: initialFloat,
    description: `Recebimento de turno — ${previous.handoff.mode === "with_sangria" ? "fundo novo" : "fundo conferido"}`,
    operatorName: incomingOperatorName, timestamp: now,
  };
  const session: CashierSession = {
    id: randomUUID(), restaurantId: companyId, lojaId, openedAt: now, status: "open",
    initialFloat, operatorName: incomingOperatorName, movements: [openMovement],
    openingDenominations: body.openingDenominations,
  };
  try {
    registerCashierFinancialMovement(session, openMovement);
    cashierSessions.push(session);
    previous.handoff.incomingOperatorName = incomingOperatorName;
    previous.handoff.incomingOperatorId = auth?.employeeId;
    previous.handoff.incomingNotes = body.incomingNotes;
    previous.handoff.receivedAt = now;
    scheduleSave("cashierSessions", cashierSessions);
    res.status(201).json({ session, summary: getCashierSummary(session), previousSession: previous });
  } catch {
    res.status(400).json({ error: "Não foi possível registrar o recebimento no Ledger" });
  }
});

// ─── POST add movement (sangria / reforço / manual) ──────────────────────────
router.post("/cashier/session/:id/movement", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const session = cashierSessions.find(s => s.id === id && s.status === 'open' && s.restaurantId === companyId);
  if (!session) { res.status(404).json({ error: "Turno não encontrado ou fechado" }); return; }

  const { type, amount, description, operatorName, orderId, tableNumber,
          receivedAmount, changeGiven, paymentBreakdown } = req.body as any;

  const normalizedAmount = amountToCents(amount);
  const normalizedReceivedAmount = receivedAmount == null ? undefined : Number(receivedAmount);
  const normalizedChangeGiven = changeGiven == null ? undefined : Number(changeGiven);
  const isCashMovement = type === "sangria" || type === "reforco";
  if (!isCashMovement || normalizedAmount == null || normalizedAmount <= 0 || !operatorName ||
      (normalizedReceivedAmount != null && (!Number.isFinite(normalizedReceivedAmount) || normalizedReceivedAmount < 0)) ||
      (normalizedChangeGiven != null && (!Number.isFinite(normalizedChangeGiven) || normalizedChangeGiven < 0))) {
    res.status(400).json({ error: "type, amount e operatorName válidos são obrigatórios; sangria e reforço devem ser positivos e finitos" });
    return;
  }

  const movement: CashierMovement = {
    id: randomUUID(), type: type as CashierMovementType, amount: Number(amount),
    description: description ?? type,
    operatorName, timestamp: new Date().toISOString(),
    orderId, tableNumber,
    receivedAmount: normalizedReceivedAmount,
    changeGiven: normalizedChangeGiven,
    paymentBreakdown,
  };
  try {
    registerCashierFinancialMovement(session, movement);
  } catch {
    res.status(400).json({ error: "Não foi possível registrar o movimento no Ledger" });
    return;
  }
  session.movements.push(movement);
  scheduleSave("cashierSessions", cashierSessions);
  res.json({ movement, summary: getCashierSummary(session) });
});

// ─── PATCH — register sale on current session (called from pay flow) ──────────
router.post("/cashier/session/sale", requireAnyAuth, (req, res): void => {
  const companyId = getCompanyId(req);
  const lojaId = getLojaId(req, companyId);
  const session = getCurrentCashierSession(companyId, lojaId);
  if (!session) { res.json({ ok: false, reason: "no_session" }); return; }

  const { type, amount, operatorName, orderId, tableNumber,
          receivedAmount, changeGiven, paymentBreakdown, voucherBrand } = req.body as any;

  const descByType: Record<string, string> = {
    sale_cash: 'Dinheiro', sale_card: 'Cartão', sale_debit: 'Débito', sale_credit: 'Crédito',
    sale_voucher: 'Vale-alimentação', sale_pix: 'PIX', sale_app: 'Pagamento pelo App',
  };
  const saleType = (type ?? 'sale_cash') as CashierMovementType;
  const saleAmount = amountToCents(amount);
  if (!paymentMethodForMovement(saleType) || saleAmount == null || saleAmount <= 0 || !operatorName && saleType !== "sale_cash") {
    res.status(400).json({ error: "tipo, amount e operatorName válidos são obrigatórios para a venda" });
    return;
  }
  const movement: CashierMovement = {
    id: randomUUID(),
    type: saleType,
    amount: Number(amount),
    description: `Mesa #${tableNumber} — ${descByType[type as string] ?? 'Misto'}`,
    operatorName: operatorName ?? 'Caixa',
    timestamp: new Date().toISOString(),
    orderId, tableNumber,
    receivedAmount: receivedAmount != null ? Number(receivedAmount) : undefined,
    changeGiven: changeGiven != null ? Number(changeGiven) : undefined,
    paymentBreakdown,
    voucherBrand,
  };
  try {
    registerCashierFinancialMovement(session, movement);
  } catch {
    res.status(400).json({ error: "Não foi possível registrar a venda no Ledger; confira os valores e o pagamento misto" });
    return;
  }
  session.movements.push(movement);
  scheduleSave("cashierSessions", cashierSessions);
  res.json({ ok: true, movement, summary: getCashierSummary(session) });
});

export default router;
