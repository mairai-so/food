import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { query, queryOne, execute } from "../lib/db";
import { userChats, restaurantSharedChat } from "../lib/data-store";
import { ensureSelf as ensureSelfGuard } from "../lib/lgpd-guard.ts";
import { requireClientAuth } from "./auth.js";

const router: IRouter = Router();

// CORRIGIDO — vulnerabilidade LGPD crítica: nenhuma destas rotas exigia
// autenticação. Qualquer pessoa podia ler, sobrescrever ou apagar os
// dados de QUALQUER usuário só trocando o :userId na URL. Agora todas
// exigem token de cliente válido (requireClientAuth) e conferem que o
// :userId da rota é exatamente o dono do token — ninguém acessa ou
// apaga dados de outra pessoa, nem o próprio dono do restaurante.
function ensureSelf(req: any, res: any): boolean {
  return ensureSelfGuard(req, res);
}

// ── GET /api/lgpd/consent/:userId — busca consentimento atual
router.get("/lgpd/consent/:userId", requireClientAuth, async (req, res): Promise<void> => {
  if (!ensureSelf(req, res)) return;
  const { userId } = req.params;
  const row = await queryOne<{
    habits_collection: boolean;
    marketing: boolean;
    analytics_ok: boolean;
    consented_at: string | null;
  }>("SELECT * FROM user_consent WHERE user_id = $1", [userId]);

  if (!row) {
    res.json({ exists: false, habitsCollection: false, marketing: false, analyticsOk: false });
    return;
  }
  res.json({
    exists: true,
    habitsCollection: row.habits_collection,
    marketing: row.marketing,
    analyticsOk: row.analytics_ok,
    consentedAt: row.consented_at,
  });
});

// ── POST /api/lgpd/consent/:userId — salva/atualiza consentimento
router.post("/lgpd/consent/:userId", requireClientAuth, async (req, res): Promise<void> => {
  if (!ensureSelf(req, res)) return;
  const { userId } = req.params;
  const { habitsCollection = false, marketing = false, analyticsOk = false } = req.body as {
    habitsCollection?: boolean;
    marketing?: boolean;
    analyticsOk?: boolean;
  };

  await execute(
    `INSERT INTO user_consent (user_id, habits_collection, marketing, analytics_ok, consented_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET habits_collection = $2, marketing = $3, analytics_ok = $4, updated_at = NOW()`,
    [userId, habitsCollection, marketing, analyticsOk]
  );

  // Auditoria
  await execute(
    `INSERT INTO access_audit (id, action, actor_id, actor_type, target_type, target_id, data_accessed)
     VALUES ($1, 'lgpd_consent_updated', $2, 'user', 'consent', $2, $3)`,
    [randomUUID(), userId, JSON.stringify({ habitsCollection, marketing, analyticsOk })]
  );

  res.json({ ok: true });
});

// ── DELETE /api/lgpd/forget/:userId — direito ao esquecimento
router.delete("/lgpd/forget/:userId", requireClientAuth, async (req, res): Promise<void> => {
  if (!ensureSelf(req, res)) return;
  const { userId } = req.params as { userId: string };

  // Apaga tudo do usuário
  await execute("DELETE FROM user_consent WHERE user_id = $1", [userId]);
  await execute("DELETE FROM user_profiles WHERE user_id = $1", [userId]);
  await execute("DELETE FROM order_history WHERE user_id = $1", [userId]);
  await execute("DELETE FROM complaints WHERE user_id = $1", [userId]);
  await execute("DELETE FROM chat_history WHERE user_id = $1", [userId]);
  await execute("DELETE FROM search_events WHERE user_id = $1", [userId]);
  await execute("DELETE FROM recommendation_events WHERE user_id = $1", [userId]);

  // Limpa chat em memória também
  userChats.delete(userId);

  // Auditoria — mantida por obrigação legal
  await execute(
    `INSERT INTO access_audit (id, action, actor_id, actor_type, target_type, target_id, data_accessed)
     VALUES ($1, 'lgpd_forget_me', $2, 'user', 'all_user_data', $2, '{"action":"data_erased"}')`,
    [randomUUID(), userId]
  );

  res.json({ ok: true, message: "Todos os seus dados foram apagados da plataforma." });
});

// ── GET /api/lgpd/export/:userId — exportar meus dados (portabilidade)
router.get("/lgpd/export/:userId", requireClientAuth, async (req, res): Promise<void> => {
  if (!ensureSelf(req, res)) return;
  const { userId } = req.params;

  const [consent, profile, orders, complaints_rows, chatRows] = await Promise.all([
    queryOne("SELECT * FROM user_consent WHERE user_id = $1", [userId]),
    queryOne("SELECT * FROM user_profiles WHERE user_id = $1", [userId]),
    query("SELECT * FROM order_history WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
    query("SELECT * FROM complaints WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
    query("SELECT role, content, created_at FROM chat_history WHERE user_id = $1 ORDER BY created_at ASC", [userId]),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId,
    perfil: profile,
    consentimento: consent,
    historicoPedidos: orders,
    reclamacoes: complaints_rows,
    historicoChat: chatRows,
  };

  // Auditoria
  await execute(
    `INSERT INTO access_audit (id, action, actor_id, actor_type, target_type, target_id, data_accessed)
     VALUES ($1, 'lgpd_data_export', $2, 'user', 'all_user_data', $2, '{"action":"exported"}')`,
    [randomUUID(), userId]
  );

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="miar-meus-dados-${userId.slice(0, 8)}.json"`);
  res.json(exportData);
});

export default router;
