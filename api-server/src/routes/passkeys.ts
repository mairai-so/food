import { Router, type IRouter } from "express";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { randomUUID } from "crypto";
import { execute, query, queryOne } from "../lib/db.js";
import { requireClientAuth, requireOwnerAuth, signToken, verifyToken } from "./auth.js";
import { requireAnyAuth } from "./auth.js";
import { employees } from "../lib/data-store.js";

const router: IRouter = Router();
type PasskeyKind = "owner" | "client" | "employee";
const challenges = new Map<string, { challenge: string; userId: string; kind: PasskeyKind; expiresAt: number }>();

function config(req: { headers: { origin?: string } }) {
  const origin = process.env.WEBAUTHN_ORIGIN ?? req.headers.origin ?? "http://localhost:5173";
  const rpID = process.env.WEBAUTHN_RP_ID ?? new URL(origin).hostname;
  return { origin, rpID, rpName: process.env.WEBAUTHN_RP_NAME ?? "MIAR AI" };
}

async function initPasskeyTables(): Promise<void> {
  await execute(`CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_kind TEXT NOT NULL CHECK (user_kind IN ('owner', 'client', 'employee')),
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
  )`);
  await execute(`ALTER TABLE webauthn_credentials DROP CONSTRAINT IF EXISTS webauthn_credentials_user_kind_check`);
  await execute(`ALTER TABLE webauthn_credentials ADD CONSTRAINT webauthn_credentials_user_kind_check CHECK (user_kind IN ('owner', 'client', 'employee'))`);
  await execute(`CREATE INDEX IF NOT EXISTS webauthn_credentials_user_idx ON webauthn_credentials(user_id, user_kind)`);
}

function purgeChallenges() {
  const now = Date.now();
  for (const [id, item] of challenges) if (item.expiresAt <= now) challenges.delete(id);
}

function rememberChallenge(userId: string, kind: PasskeyKind, challenge: string) {
  purgeChallenges();
  const requestId = randomUUID();
  challenges.set(requestId, { challenge, userId, kind, expiresAt: Date.now() + 5 * 60_000 });
  return requestId;
}

function takeChallenge(requestId: string, userId: string, kind: PasskeyKind) {
  purgeChallenges();
  const item = challenges.get(requestId);
  if (!item || item.userId !== userId || item.kind !== kind) return null;
  challenges.delete(requestId);
  return item.challenge;
}

function bearerPayload(req: { headers: { authorization?: string } }) {
  const value = req.headers.authorization;
  return value?.startsWith("Bearer ") ? verifyToken(value.slice(7)) : null;
}

async function registrationOptions(req: any, res: any, kind: PasskeyKind) {
  const payload = bearerPayload(req);
  const userId = kind === "owner" ? payload?.ownerId : kind === "client" ? payload?.clientId : payload?.employeeId;
  if (!userId) return res.status(401).json({ error: "Login necessário" });
  const account = kind === "owner"
    ? await queryOne<{ name: string; email: string }>("SELECT name, email FROM owner_accounts WHERE id = $1", [userId])
    : kind === "client" ? await queryOne<{ name: string; email: string }>("SELECT name, email FROM client_accounts WHERE id = $1", [userId])
      : employees.find((item) => item.id === userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada" });
  const existing = await query<{ credential_id: string }>("SELECT credential_id FROM webauthn_credentials WHERE user_id = $1 AND user_kind = $2", [userId, kind]);
  const options = await generateRegistrationOptions({
    rpName: config(req).rpName,
    rpID: config(req).rpID,
    userName: 'email' in account ? account.email : `${userId}@employee.miar`,
    userDisplayName: account.name,
    userID: new TextEncoder().encode(String(userId)),
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: existing.map((item) => ({ id: item.credential_id })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  return res.json({ requestId: rememberChallenge(String(userId), kind, options.challenge), options });
}

async function registrationVerify(req: any, res: any, kind: PasskeyKind) {
  const payload = bearerPayload(req);
  const userId = kind === "owner" ? payload?.ownerId : payload?.clientId;
  const requestId = String(req.body?.requestId ?? "");
  const challenge = userId ? takeChallenge(requestId, String(userId), kind) : null;
  if (!userId || !challenge) return res.status(400).json({ error: "Desafio expirado ou inválido" });
  const { origin, rpID } = config(req);
  const verification = await verifyRegistrationResponse({ response: req.body.response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: "Biometria não verificada" });
  const info = verification.registrationInfo;
  await execute("INSERT INTO webauthn_credentials (user_id, user_kind, credential_id, public_key, counter, transports) VALUES ($1,$2,$3,$4,$5,$6)", [userId, kind, info.credential.id, Buffer.from(info.credential.publicKey).toString("base64url"), info.credential.counter, info.credential.transports ?? []]);
  return res.json({ ok: true });
}

async function authenticationOptions(req: any, res: any, kind: PasskeyKind) {
  const identifier = String(req.body?.email ?? "").trim().toLowerCase();
  if (!identifier) return res.status(400).json({ error: "E-mail obrigatório" });
  const account = kind === "owner" ? await queryOne<{ id: string }>("SELECT id FROM owner_accounts WHERE email = $1", [identifier]) : kind === "client" ? await queryOne<{ id: string }>("SELECT id FROM client_accounts WHERE email = $1", [identifier]) : employees.find((item) => item.id === identifier);
  if (!account) return res.status(404).json({ error: "Conta não encontrada" });
  const credentials = await query<{ credential_id: string; transports: string[] }>("SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1 AND user_kind = $2", [account.id, kind]);
  if (!credentials.length) return res.status(404).json({ error: "Nenhuma biometria cadastrada" });
  const options = await generateAuthenticationOptions({ rpID: config(req).rpID, timeout: 60_000, userVerification: "required", allowCredentials: credentials.map((item) => ({ id: item.credential_id, transports: item.transports as any })) });
  return res.json({ requestId: rememberChallenge(account.id, kind, options.challenge), options });
}

async function authenticationVerify(req: any, res: any, kind: PasskeyKind) {
  const identifier = String(req.body?.email ?? "").trim().toLowerCase();
  const account = kind === "owner" ? await queryOne<any>("SELECT id, name, email, company_id FROM owner_accounts WHERE email = $1", [identifier]) : await queryOne<any>("SELECT id, name, email, phone FROM client_accounts WHERE email = $1", [identifier]);
  const userId = account?.id;
  const challenge = userId ? takeChallenge(String(req.body?.requestId ?? ""), userId, kind) : null;
  if (!account || !challenge) return res.status(401).json({ error: "Desafio inválido" });
  const stored = await queryOne<any>("SELECT * FROM webauthn_credentials WHERE user_id = $1 AND user_kind = $2 AND credential_id = $3", [userId, kind, req.body?.response?.id]);
  if (!stored) return res.status(401).json({ error: "Credencial não encontrada" });
  const verification = await verifyAuthenticationResponse({ response: req.body.response, expectedChallenge: challenge, expectedOrigin: config(req).origin, expectedRPID: config(req).rpID, credential: { id: stored.credential_id, publicKey: new Uint8Array(Buffer.from(stored.public_key, "base64url")), counter: Number(stored.counter), transports: stored.transports }, requireUserVerification: true });
  if (!verification.verified) return res.status(401).json({ error: "Biometria não verificada" });
  await execute("UPDATE webauthn_credentials SET counter = $1, last_used_at = NOW() WHERE id = $2", [verification.authenticationInfo.newCounter, stored.id]);
  const token = kind === "owner" ? signToken({ ownerId: account.id, companyId: account.company_id, email: account.email, role: "owner", name: account.name }) : signToken({ clientId: account.id, name: account.name, email: account.email, phone: account.phone, role: "client", isClientUser: true });
  return res.json({ token });
}

export async function initPasskeyTable(): Promise<void> { await initPasskeyTables(); }

router.post("/auth/passkeys/owner/register/options", requireOwnerAuth, (req, res) => registrationOptions(req, res, "owner"));
router.post("/auth/passkeys/owner/register/verify", requireOwnerAuth, (req, res) => registrationVerify(req, res, "owner"));
router.post("/auth/passkeys/owner/login/options", (req, res) => authenticationOptions(req, res, "owner"));
router.post("/auth/passkeys/owner/login/verify", (req, res) => authenticationVerify(req, res, "owner"));
router.post("/auth/passkeys/client/register/options", requireClientAuth, (req, res) => registrationOptions(req, res, "client"));
router.post("/auth/passkeys/client/register/verify", requireClientAuth, (req, res) => registrationVerify(req, res, "client"));
router.post("/auth/passkeys/client/login/options", (req, res) => authenticationOptions(req, res, "client"));
router.post("/auth/passkeys/client/login/verify", (req, res) => authenticationVerify(req, res, "client"));
router.post("/auth/passkeys/employee/register/options", requireAnyAuth, (req, res) => registrationOptions(req, res, "employee"));
router.post("/auth/passkeys/employee/register/verify", requireAnyAuth, (req, res) => registrationVerify(req, res, "employee"));

export default router;