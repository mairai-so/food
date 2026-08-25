/**
 * otp.ts — Verificação por telefone para Cliente e Entregador.
 *
 * POST /auth/otp/send   → { phone }              → indisponível sem provedor externo
 * POST /auth/otp/verify → { phone, code, role?, name?, inviteToken? } → retorna JWT
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { execute, queryOne, query } from "../lib/db.js";
import { signToken } from "./auth.js";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normaliza telefone brasileiro para E.164 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
  return `+${digits}`;
}

// ─── POST /auth/otp/send ──────────────────────────────────────────────────────

router.post("/auth/otp/send", async (req, res): Promise<void> => {
  res.status(503).json({
    error: "Verificação por telefone temporariamente indisponível.",
  });
});

// ─── POST /auth/otp/verify ────────────────────────────────────────────────────

router.post("/auth/otp/verify", async (req, res): Promise<void> => {
  const { phone, code, role, name, inviteToken } = req.body as {
    phone?: string;
    code?: string;
    role?: "client" | "delivery";
    name?: string;
    inviteToken?: string;
  };

  if (!phone?.trim() || !code?.trim()) {
    res.status(400).json({ error: "Telefone e código são obrigatórios" });
    return;
  }

  const normalized = normalizePhone(phone.trim());

  const record = await queryOne<{
    id: string; phone: string; code: string;
    expires_at: string; used: boolean;
  }>(
    `SELECT * FROM phone_otp_codes
     WHERE phone = $1 AND used = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [normalized]
  );

  if (!record) {
    res.status(401).json({ error: "Código inválido ou expirado. Solicite um novo." });
    return;
  }

  if (new Date(record.expires_at) < new Date()) {
    await execute("UPDATE phone_otp_codes SET used = TRUE WHERE id = $1", [record.id]);
    res.status(401).json({ error: "Código expirado. Solicite um novo." });
    return;
  }

  if (record.code !== code.trim()) {
    res.status(401).json({ error: "Código incorreto." });
    return;
  }

  // Marcar como usado
  await execute("UPDATE phone_otp_codes SET used = TRUE WHERE id = $1", [record.id]);

  // Resolver companyId via invite token (para entregador)
  let companyId: string | null = null;
  if (inviteToken) {
    const tokenRecord = await queryOne<{ company_id: string }>(
      "SELECT company_id FROM employee_tokens WHERE token = $1 AND active = TRUE",
      [inviteToken]
    );
    companyId = tokenRecord?.company_id ?? null;
  }

  // Buscar ou criar phone_user
  let user = await queryOne<{ id: string; phone: string; name: string; role: string; company_id: string | null }>(
    "SELECT * FROM phone_users WHERE phone = $1",
    [normalized]
  );

  if (!user) {
    const userId = randomUUID();
    const userRole = role ?? "client";
    const userName = name?.trim() || normalized;
    await execute(
      `INSERT INTO phone_users (id, phone, name, role, company_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, normalized, userName, userRole, companyId]
    );
    user = { id: userId, phone: normalized, name: userName, role: userRole, company_id: companyId };
  } else if (companyId && !user.company_id) {
    // Vincular entregador à empresa se ainda não estava vinculado
    await execute(
      "UPDATE phone_users SET company_id = $1 WHERE id = $2",
      [companyId, user.id]
    );
    user.company_id = companyId;
  }

  const token = signToken({
    userId: user.id,
    phone: normalized,
    role: user.role,
    name: user.name,
    companyId: user.company_id,
    isPhoneUser: true,
  });

  res.json({ token, user: { id: user.id, phone: normalized, name: user.name, role: user.role } });
});

// ─── GET /auth/otp/me ─────────────────────────────────────────────────────────

router.get("/auth/otp/me", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token necessário" });
    return;
  }
  const { verifyToken } = await import("./auth.js");
  const payload = verifyToken(header.slice(7));
  if (!payload?.isPhoneUser) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }
  const user = await queryOne(
    "SELECT id, phone, name, role, company_id, created_at FROM phone_users WHERE id = $1",
    [payload.userId as string]
  );
  res.json(user);
});

export default router;
