import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { query, queryOne, execute } from "../lib/db";
import { requireOwnerAuth } from "./auth.js";
import { onboardingLimiter } from "../lib/rate-limiter.js";

const router: IRouter = Router();

// ── POST /api/onboarding/register — cadastro de novo restaurante
router.post("/onboarding/register", onboardingLimiter, async (req, res): Promise<void> => {
  const {
    name,
    cnpj,
    email,
    phone,
    address,
    cuisine,
    ownerName,
    declaredPrepTime = 20,
  } = req.body as {
    name: string;
    cnpj?: string;
    email: string;
    phone?: string;
    address?: string;
    cuisine?: string;
    ownerName?: string;
    declaredPrepTime?: number;
  };

  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: "Nome e e-mail são obrigatórios" });
    return;
  }

  // Verifica CNPJ duplicado
  if (cnpj) {
    const existing = await queryOne("SELECT id FROM restaurant_registrations WHERE cnpj = $1", [cnpj]);
    if (existing) {
      res.status(409).json({ error: "CNPJ já cadastrado na plataforma" });
      return;
    }
  }

  const id = randomUUID();
  await execute(
    `INSERT INTO restaurant_registrations
       (id, name, cnpj, email, phone, address, cuisine, owner_name, declared_prep_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, name, cnpj ?? null, email, phone ?? null, address ?? null, cuisine ?? null, ownerName ?? null, declaredPrepTime]
  );

  res.status(201).json({
    id,
    status: "pendente",
    message: "Cadastro recebido e pendente de análise.",
  });
});

// ── GET /api/onboarding/registrations — listar cadastros (admin MIAR)
router.get("/onboarding/registrations", requireOwnerAuth, async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  let sql = "SELECT * FROM restaurant_registrations WHERE 1=1";
  const params: unknown[] = [];
  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  sql += " ORDER BY created_at DESC";
  const rows = await query(sql, params);
  res.json(rows);
});

// ── PATCH /api/onboarding/registrations/:id/approve — aprovar cadastro
router.patch("/onboarding/registrations/:id/approve", requireOwnerAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  await execute(
    "UPDATE restaurant_registrations SET status = 'aprovado', updated_at = NOW() WHERE id = $1",
    [id]
  );
  res.json({ ok: true, status: "aprovado" });
});

// ── PATCH /api/onboarding/registrations/:id/reject — rejeitar cadastro
router.patch("/onboarding/registrations/:id/reject", requireOwnerAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { reason } = req.body as { reason: string };
  await execute(
    "UPDATE restaurant_registrations SET status = 'rejeitado', rejection_reason = $1, updated_at = NOW() WHERE id = $2",
    [reason ?? "Não informado", id]
  );
  res.json({ ok: true, status: "rejeitado" });
});

// ── PATCH /api/onboarding/registrations/:id/suspend — suspender por desempenho
router.patch("/onboarding/registrations/:id/suspend", requireOwnerAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };
  await execute(
    "UPDATE restaurant_registrations SET status = 'suspenso', rejection_reason = $1, updated_at = NOW() WHERE id = $2",
    [reason ?? "Desempenho abaixo do mínimo exigido", id]
  );
  res.json({ ok: true, status: "suspenso" });
});

// ── POST /api/onboarding/performance — registrar tempo real de preparo
router.post("/onboarding/performance", async (req, res): Promise<void> => {
  const { restaurantId, actualPrepTime } = req.body as {
    restaurantId: string;
    actualPrepTime: number;
  };

  // Atualiza média e conta falhas consecutivas (tolerância: 2x o tempo declarado)
  const reg = await queryOne<{
    declared_prep_time: number;
    consecutive_failures: number;
    performance_score: string;
  }>(
    "SELECT declared_prep_time, consecutive_failures, performance_score FROM restaurant_registrations WHERE id = $1",
    [restaurantId]
  );

  if (!reg) { res.status(404).json({ error: "Restaurante não encontrado" }); return; }

  const isFailing = actualPrepTime > reg.declared_prep_time * 2;
  const newFailures = isFailing ? reg.consecutive_failures + 1 : 0;
  const newScore = Math.max(1, Math.min(5, parseFloat(reg.performance_score) - (isFailing ? 0.2 : -0.1)));
  const newStatus = newFailures >= 5 ? "suspenso" : undefined;

  await execute(
    `UPDATE restaurant_registrations
     SET avg_actual_prep_time = (COALESCE(avg_actual_prep_time, declared_prep_time) * 0.8 + $1 * 0.2),
         consecutive_failures = $2,
         performance_score = $3,
         ${newStatus ? "status = 'suspenso'," : ""}
         updated_at = NOW()
     WHERE id = $4`,
    [actualPrepTime, newFailures, newScore.toFixed(1), restaurantId]
  );

  res.json({
    ok: true,
    performanceScore: newScore.toFixed(1),
    consecutiveFailures: newFailures,
    autoSuspended: newStatus === "suspenso",
  });
});

export default router;
