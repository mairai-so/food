// artifacts/api-server/src/routes/delivery-invite.ts
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { requireOwnerAuth } from "./auth";
import { query, queryOne, execute } from "../lib/db";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/delivery-invites — gestor gera um convite de entregador
// O entregador NÃO precisa estar cadastrado. Ele recebe o link, confirma o
// WhatsApp na tela /entregador e entra já vinculado à empresa.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/delivery-invites", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { label } = (req.body as { label?: string }) ?? {};

  const tokenId = randomUUID();
  // employee_id fica marcado como convite aberto de entregador
  const inviteEmployeeId = `delivery-invite-${randomUUID()}`;
  const inviteToken = `inv-${randomUUID().replace(/-/g, "")}`;

  await execute(
    `INSERT INTO employee_tokens (id, company_id, employee_id, token, role, active)
     VALUES ($1, $2, $3, $4, 'delivery', true)
     ON CONFLICT (token) DO NOTHING`,
    [tokenId, companyId, inviteEmployeeId, inviteToken],
  );

  // URL relativa que o gestor pode compartilhar. O front monta a URL absoluta.
  res.status(201).json({
    token: inviteToken,
    label: label?.trim() || null,
    accessPath: `/entregador/?token=${inviteToken}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delivery-invites — lista convites de entregador da empresa
// ─────────────────────────────────────────────────────────────────────────────
router.get("/delivery-invites", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const rows = await query<{
    id: string;
    token: string;
    employee_id: string;
    active: boolean;
    created_at: string;
  }>(
    `SELECT id, token, employee_id, active, created_at
       FROM employee_tokens
      WHERE company_id = $1 AND role = 'delivery' AND employee_id LIKE 'delivery-invite-%'
      ORDER BY created_at DESC`,
    [companyId],
  );

  res.json(
    rows.map((r) => ({
      id: r.id,
      token: r.token,
      active: r.active,
      accessPath: `/entregador/?token=${r.token}`,
      createdAt: r.created_at,
    })),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/delivery-invites/:token — revoga um convite
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/delivery-invites/:token", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { token } = req.params;

  const record = await queryOne<{ id: string }>(
    "SELECT id FROM employee_tokens WHERE token = $1 AND company_id = $2",
    [token, companyId],
  );
  if (!record) {
    res.status(404).json({ error: "Convite não encontrado." });
    return;
  }

  await execute("UPDATE employee_tokens SET active = false WHERE token = $1", [token]);
  res.json({ revoked: true, token });
});

export default router;
