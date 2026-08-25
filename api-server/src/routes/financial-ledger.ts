import { Router, type IRouter } from "express";
import { requireAnyAuth } from "./auth";
import { listFinancialMovements, resolverLojaId } from "../lib/data-store";

const router: IRouter = Router();

function parseDate(value: unknown): number | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

router.get("/financial-movements", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const requestedLojaId = (req.headers["x-loja-id"] as string) || undefined;
  const lojaId = resolverLojaId(companyId, requestedLojaId);
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (req.query.from && from == null) {
    res.status(400).json({ error: "from inválido; use uma data ISO" });
    return;
  }
  if (req.query.to && to == null) {
    res.status(400).json({ error: "to inválido; use uma data ISO" });
    return;
  }
  if (from != null && to != null && from > to) {
    res.status(400).json({ error: "from não pode ser posterior a to" });
    return;
  }

  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const direction = typeof req.query.direction === "string" ? req.query.direction : undefined;
  const paymentMethod = typeof req.query.paymentMethod === "string" ? req.query.paymentMethod : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const movements = listFinancialMovements(companyId, lojaId).filter((movement) => {
    const occurredAt = Date.parse(movement.occurredAt);
    return (from == null || occurredAt >= from)
      && (to == null || occurredAt <= to)
      && (!kind || movement.kind === kind)
      && (!direction || movement.direction === direction)
      && (!paymentMethod || movement.paymentMethod === paymentMethod)
      && (!status || movement.status === status);
  });

  const summary = movements.reduce((acc, movement) => {
    if (movement.direction === "inflow") acc.inflowsCents += movement.amountCents;
    if (movement.direction === "outflow") acc.outflowsCents += movement.amountCents;
    if (movement.direction === "memo") acc.memoCents += movement.amountCents;
    acc.byPaymentMethod[movement.paymentMethod] = (acc.byPaymentMethod[movement.paymentMethod] ?? 0) + movement.amountCents;
    return acc;
  }, {
    inflowsCents: 0,
    outflowsCents: 0,
    memoCents: 0,
    byPaymentMethod: {} as Record<string, number>,
  });

  res.json({
    movements,
    summary: {
      ...summary,
      netCents: summary.inflowsCents - summary.outflowsCents,
    },
    filters: { from: req.query.from ?? null, to: req.query.to ?? null, lojaId, kind: kind ?? null, direction: direction ?? null, paymentMethod: paymentMethod ?? null, status: status ?? null },
  });
});

export default router;
