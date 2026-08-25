import { randomUUID } from "node:crypto";

export type FinancialMovementKind =
  | "sale"
  | "receivable_created"
  | "receivable_payment"
  | "purchase_received"
  | "expense"
  | "cashier_open"
  | "cashier_close"
  | "cash_in"
  | "cash_out"
  | "refund"
  | "adjustment";

export type FinancialDirection = "inflow" | "outflow" | "memo";

export type FinancialPaymentMethod =
  | "cash"
  | "pix"
  | "debit"
  | "credit"
  | "card"
  | "voucher"
  | "app"
  | "mixed"
  | "fiado"
  | "other";

export type FinancialMovementStatus = "posted" | "voided" | "reversed";

export interface FinancialMovement {
  id: string;
  restaurantId: string;
  lojaId?: string;
  kind: FinancialMovementKind;
  direction: FinancialDirection;
  amountCents: number;
  currency: "BRL";
  paymentMethod: FinancialPaymentMethod;
  occurredAt: string;
  createdAt: string;
  sourceType: "order" | "table_session" | "cashier_session" | "fiado" | "purchase" | "manual";
  sourceId: string;
  idempotencyKey: string;
  orderId?: string;
  tableSessionId?: string;
  cashierSessionId?: string;
  fiadoId?: string;
  purchaseListId?: string;
  operatorName?: string;
  actorId?: string;
  description?: string;
  paymentBreakdownCents?: {
    cash?: number;
    pix?: number;
    debit?: number;
    credit?: number;
    card?: number;
    voucher?: number;
    app?: number;
    fiado?: number;
  };
  status: FinancialMovementStatus;
  reversalOfId?: string;
  metadata?: Record<string, unknown>;
}

export type NewFinancialMovement = Omit<FinancialMovement, "id" | "createdAt" | "status">;

export function paymentBreakdownTotalCents(breakdown: FinancialMovement["paymentBreakdownCents"]): number {
  return Object.values(breakdown ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
}

/** Regista um movimento numa coleção já pertencente ao data-store central. */
export function registerFinancialMovementInMemory(
  collection: FinancialMovement[],
  input: NewFinancialMovement,
): FinancialMovement {
  if (!input.restaurantId || !input.sourceId || !input.idempotencyKey) {
    throw new Error("Movimento financeiro exige restaurantId, sourceId e idempotencyKey");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Movimento financeiro exige amountCents inteiro maior que zero");
  }
  if (input.paymentMethod === "mixed" && paymentBreakdownTotalCents(input.paymentBreakdownCents) !== input.amountCents) {
    throw new Error("Pagamento misto deve somar exatamente o valor do movimento");
  }

  const existing = collection.find(
    (movement) => movement.restaurantId === input.restaurantId && movement.idempotencyKey === input.idempotencyKey,
  );
  if (existing) return existing;

  const movement: FinancialMovement = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: "posted",
  };
  collection.push(movement);
  return movement;
}

export function listFinancialMovementsForTenant(
  collection: FinancialMovement[],
  restaurantId: string,
  lojaId?: string,
  belongsToStore: (movementLojaId: string | undefined, requestedLojaId: string, restaurantId: string) => boolean = (movementLojaId, requestedLojaId) => movementLojaId === requestedLojaId,
): FinancialMovement[] {
  return collection.filter(
    (movement) => movement.restaurantId === restaurantId && (!lojaId || belongsToStore(movement.lojaId, lojaId, restaurantId)),
  );
}
