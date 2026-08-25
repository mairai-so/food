/**
 * fiado.ts — Crédito do cliente com o estabelecimento ("pagar depois").
 *
 * POST  /api/fiado                        → gestor/caixa registra venda fiada
 * GET   /api/fiado                        → gestor lista fiados do restaurante
 * POST  /api/fiado/:id/pagamento          → registra pagamento parcial/total
 * GET   /api/fiado/cliente/mine           → cliente vê o próprio saldo
 * GET   /api/fiado/cliente/lembrete       → lembrete diário discreto (ou null)
 *
 * Regra do lembrete: sem tom de cobrança agressiva. Mensagem fixa,
 * neutra, mostrada no máximo 1x por dia por cliente, a partir do
 * horário configurado em Settings (fiadoLembreteHora, padrão 8h).
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { requireAnyAuth, requireClientAuth } from "./auth";
import {
  fiadoRecords,
  saldoFiadoEmAberto,
  getSettings,
  registerFinancialMovement,
  financialMovements,
  type FiadoRecord,
} from "../lib/data-store";
import { scheduleSave } from "../lib/persistence.js";

const router: IRouter = Router();

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function diasEmAberto(criadoEm: string): number {
  const diffMs = Date.now() - new Date(criadoEm).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

// ── POST /fiado — gestor/caixa registra venda fiada ─────────────────────────
router.post("/fiado", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const { clientAccountId, clientName, valorTotal, orderId } = req.body as {
    clientAccountId?: string;
    clientName?: string;
    valorTotal?: number;
    orderId?: string;
  };

  if (!clientAccountId?.trim() || !clientName?.trim()) {
    res.status(400).json({ error: "clientAccountId e clientName são obrigatórios" });
    return;
  }
  if (typeof valorTotal !== "number" || valorTotal <= 0) {
    res.status(400).json({ error: "valorTotal deve ser maior que zero" });
    return;
  }

  if (orderId) {
    const existing = fiadoRecords.find((record) => record.restaurantId === companyId && record.orderId === orderId);
    if (existing) {
      res.status(200).json(existing);
      return;
    }
  }
  const registro: FiadoRecord = {
    id: randomUUID(),
    restaurantId: companyId,
    clientAccountId: clientAccountId.trim(),
    clientName: clientName.trim(),
    valorTotal,
    valorPago: 0,
    orderId,
    criadoEm: new Date().toISOString(),
  };
  fiadoRecords.push(registro);
  scheduleSave("fiadoRecords", fiadoRecords);
  registerFinancialMovement({
    restaurantId: companyId,
    kind: "receivable_created",
    direction: "memo",
    amountCents: Math.round(valorTotal * 100),
    currency: "BRL",
    paymentMethod: "fiado",
    occurredAt: registro.criadoEm,
    sourceType: "fiado",
    sourceId: registro.id,
    idempotencyKey: `fiado-created:${companyId}:${registro.id}`,
    fiadoId: registro.id,
    orderId,
    description: `Fiado criado para ${registro.clientName}`,
  });
  res.status(201).json(registro);
});

// ── GET /fiado — gestor lista todos os fiados do restaurante ────────────────
router.get("/fiado", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const registros = fiadoRecords
    .filter((f) => f.restaurantId === companyId)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .map((f) => ({ ...f, saldoAberto: f.valorTotal - f.valorPago, diasEmAberto: diasEmAberto(f.criadoEm) }));
  res.json(registros);
});

// ── POST /fiado/:id/pagamento — registra pagamento parcial ou total ─────────
router.post("/fiado/:id/pagamento", requireAnyAuth, (req, res): void => {
  const companyId: string = (req as any).auth.companyId;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const registro = fiadoRecords.find((f) => f.id === id && f.restaurantId === companyId);
  if (!registro) {
    res.status(404).json({ error: "Registro de fiado não encontrado" });
    return;
  }

  const { valor, method = "cash", paymentId } = req.body as {
    valor?: number;
    method?: "pix" | "card" | "cash" | "debit" | "credit" | "voucher";
    paymentId?: string;
  };
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    res.status(400).json({ error: "valor deve ser maior que zero" });
    return;
  }
  if (!("cash pix card debit credit voucher".split(" ") as string[]).includes(method)) {
    res.status(400).json({ error: "method inválido" });
    return;
  }
  const saldoAtual = registro.valorTotal - registro.valorPago;
  if (valor > saldoAtual) {
    res.status(400).json({ error: "valor não pode ser maior que o saldo em aberto" });
    return;
  }
  const valorCents = Math.round(valor * 100);
  const pagamentoKey = paymentId
    ? `fiado-payment:${companyId}:${registro.id}:${paymentId}`
    : `fiado-payment:${companyId}:${registro.id}:${registro.valorPago.toFixed(2)}:${valor.toFixed(2)}`;
  const pagamentoExistente = financialMovements.find((movement) => movement.idempotencyKey === pagamentoKey);
  if (pagamentoExistente) {
    res.json({ ...registro, saldoAberto: registro.valorTotal - registro.valorPago });
    return;
  }
  registerFinancialMovement({
    restaurantId: companyId,
    kind: "receivable_payment",
    direction: method === "cash" ? "inflow" : "memo",
    amountCents: valorCents,
    currency: "BRL",
    paymentMethod: method,
    occurredAt: new Date().toISOString(),
    sourceType: "fiado",
    sourceId: registro.id,
    idempotencyKey: pagamentoKey,
    fiadoId: registro.id,
    orderId: registro.orderId,
    description: `Pagamento de fiado — ${registro.clientName}`,
    metadata: method === "cash" ? undefined : { settlementStatus: "unverified_non_cash" },
  });
  registro.valorPago = Math.min(registro.valorTotal, registro.valorPago + valor);
  if (registro.valorPago >= registro.valorTotal) {
    registro.quitadoEm = new Date().toISOString();
  }
  scheduleSave("fiadoRecords", fiadoRecords);

  res.json({ ...registro, saldoAberto: registro.valorTotal - registro.valorPago });
});

// ── GET /fiado/cliente/mine — cliente vê o próprio saldo ────────────────────
router.get("/fiado/cliente/mine", requireClientAuth, (req, res): void => {
  const clientId: string = (req as any).clientId;
  const { restaurantId } = req.query as { restaurantId?: string };

  const meus = fiadoRecords.filter(
    (f) => f.clientAccountId === clientId && (!restaurantId || f.restaurantId === restaurantId) && !f.quitadoEm,
  );
  const saldoTotal = meus.reduce((acc, f) => acc + (f.valorTotal - f.valorPago), 0);

  res.json({
    saldoAberto: saldoTotal,
    registros: meus.map((f) => ({
      id: f.id,
      restaurantId: f.restaurantId,
      saldoAberto: f.valorTotal - f.valorPago,
      diasEmAberto: diasEmAberto(f.criadoEm),
    })),
  });
});

// ── GET /fiado/cliente/lembrete — lembrete diário discreto (ou null) ────────
// O app Cliente chama isso ao abrir. Retorna a mensagem no máximo 1x por dia,
// só a partir do horário configurado pelo restaurante, e só se ainda houver
// saldo em aberto. Nunca soa como cobrança agressiva.
router.get("/fiado/cliente/lembrete", requireClientAuth, (req, res): void => {
  const clientId: string = (req as any).clientId;
  const hoje = hojeISO();
  const horaAtual = new Date().getHours();

  const pendentes = fiadoRecords.filter(
    (f) => f.clientAccountId === clientId && !f.quitadoEm && f.valorTotal - f.valorPago > 0,
  );

  for (const registro of pendentes) {
    const settings = getSettings(registro.restaurantId);
    const horaConfigurada = settings.fiadoLembreteHora ?? 8;
    const jaMostradoHoje = registro.ultimoLembreteData === hoje;

    if (!jaMostradoHoje && horaAtual >= horaConfigurada) {
      registro.ultimoLembreteData = hoje;
      const saldo = registro.valorTotal - registro.valorPago;
      const dias = diasEmAberto(registro.criadoEm);
      res.json({
        lembrete: true,
        mensagem: `Bom dia! Hoje seu débito é R$ ${saldo.toFixed(2)}. ${dias} dia${dias === 1 ? "" : "s"} em aberto.`,
        restaurantId: registro.restaurantId,
        saldoAberto: saldo,
        diasEmAberto: dias,
      });
      return;
    }
  }

  res.json({ lembrete: false });
});

export default router;
