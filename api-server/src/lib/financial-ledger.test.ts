import assert from "node:assert/strict";
import test from "node:test";
import {
  registerFinancialMovementInMemory,
  type FinancialMovement,
} from "./financial-ledger-domain.ts";

function baseMovement(overrides: Partial<Omit<FinancialMovement, "id" | "createdAt" | "status">> = {}) {
  return {
    restaurantId: "tenant-ledger-test",
    lojaId: "loja-principal",
    kind: "sale" as const,
    direction: "inflow" as const,
    amountCents: 1000,
    currency: "BRL" as const,
    paymentMethod: "cash" as const,
    occurredAt: "2026-08-17T12:00:00.000Z",
    sourceType: "order" as const,
    sourceId: "order-ledger-test",
    idempotencyKey: "order-ledger-test:paid",
    ...overrides,
  };
}

test("registers one movement and returns the same movement on retry", () => {
  const collection: FinancialMovement[] = [];
  const first = registerFinancialMovementInMemory(collection, baseMovement());
  const second = registerFinancialMovementInMemory(collection, baseMovement());

  assert.equal(first.id, second.id);
  assert.equal(first.status, "posted");
  assert.equal(first.amountCents, 1000);
  assert.equal(collection.length, 1);
});

test("rejects a mixed payment whose parts do not equal the total", () => {
  assert.throws(
    () => registerFinancialMovementInMemory([], baseMovement({
      sourceId: "order-mixed-invalid",
      idempotencyKey: "order-mixed-invalid:paid",
      paymentMethod: "mixed",
      amountCents: 1000,
      paymentBreakdownCents: { cash: 700, pix: 200 },
    })),
    /Pagamento misto deve somar exatamente/,
  );
});

test("does not allow a zero or fractional-cent movement", () => {
  assert.throws(
    () => registerFinancialMovementInMemory([], baseMovement({
      sourceId: "order-zero",
      idempotencyKey: "order-zero:paid",
      amountCents: 0,
    })),
    /amountCents inteiro maior que zero/,
  );
  assert.throws(
    () => registerFinancialMovementInMemory([], baseMovement({
      sourceId: "order-fraction",
      idempotencyKey: "order-fraction:paid",
      amountCents: 1000.5,
    })),
    /amountCents inteiro maior que zero/,
  );
});

test("does not share an idempotency key across tenants", () => {
  const collection: FinancialMovement[] = [];
  const first = registerFinancialMovementInMemory(collection, baseMovement({
    sourceId: "order-tenant-a",
    idempotencyKey: "same-event-key",
    restaurantId: "tenant-a",
  }));
  const second = registerFinancialMovementInMemory(collection, baseMovement({
    sourceId: "order-tenant-b",
    idempotencyKey: "same-event-key",
    restaurantId: "tenant-b",
  }));

  assert.notEqual(first.id, second.id);
  assert.equal(collection.filter((movement) => movement.idempotencyKey === "same-event-key").length, 2);
});
