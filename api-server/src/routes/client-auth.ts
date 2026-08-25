/**
 * client-auth.ts — Autenticação de clientes do app Miar Cliente.
 *
 * POST /auth/client/register  → { name, email, phone, password } → JWT + user
 * POST /auth/client/login     → { email, password }               → JWT + user
 * GET  /auth/client/me        → (Bearer) → dados do cliente logado
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { execute, query, queryOne } from "../lib/db.js";
import { signToken, verifyToken } from "./auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Bootstrap da tabela ─────────────────────────────────────────────────────

export async function initClientAccountsTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS client_accounts (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name         TEXT NOT NULL,
      email        TEXT NOT NULL UNIQUE,
      phone        TEXT,
      password_hash TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await execute(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS share_data_with_restaurants BOOLEAN NOT NULL DEFAULT TRUE`);
  await execute(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS allow_ai_memory BOOLEAN NOT NULL DEFAULT TRUE`);
  await execute(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`);
  // Acessibilidade (16/08/2026, Manual seção 38.2) — dado sensível, tratado
  // com o mesmo cuidado de alergias/saúde alimentar (seção 18): array de
  // strings livre (ex.: ["visual", "neurodivergencia"]), nunca exposto
  // publicamente, só usado pra personalizar atendimento.
  await execute(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS accessibility_needs TEXT[] NOT NULL DEFAULT '{}'`);
  await execute(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS discovery_preferences JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await execute(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS saved_addresses JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await execute(`ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS gender TEXT`);
  await execute(
    `CREATE INDEX IF NOT EXISTS client_accounts_email_idx ON client_accounts(email)`
  );
  await execute(
    `CREATE INDEX IF NOT EXISTS client_accounts_phone_idx ON client_accounts(phone) WHERE phone IS NOT NULL`
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function buildToken(user: { id: string; name: string; email: string; phone: string | null }) {
  return signToken({
    clientId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: "client",
    isClientUser: true,
  });
}

// ─── POST /auth/client/register ───────────────────────────────────────────────

router.post("/auth/client/register", async (req, res): Promise<void> => {
  const { name, email, phone, gender, password } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    gender?: string;
    password?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "Nome é obrigatório" });
    return;
  }
  if (!email?.trim() || !email.includes("@")) {
    res.status(400).json({ error: "E-mail inválido" });
    return;
  }
  if (!phone?.trim()) {
    res.status(400).json({ error: "Telefone é obrigatório" });
    return;
  }
  if (gender !== undefined && !["masculino", "feminino", "prefiro-nao-dizer", "outro"].includes(gender)) {
    res.status(400).json({ error: "Gênero inválido" });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone = normalizePhone(phone.trim());

  const existing = await queryOne(
    "SELECT id FROM client_accounts WHERE email = $1",
    [normalizedEmail]
  );
  if (existing) {
    res.status(409).json({ error: "E-mail já cadastrado. Faça login ou use outro e-mail." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = randomUUID();

  await execute(
    `INSERT INTO client_accounts (id, name, email, phone, gender, password_hash, share_data_with_restaurants, allow_ai_memory, onboarding_completed)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, FALSE)`,
    [id, name.trim(), normalizedEmail, normalizedPhone, gender ?? null, passwordHash]
  );

  const user = { id, name: name.trim(), email: normalizedEmail, phone: normalizedPhone, gender: gender ?? null };
  const token = buildToken(user);

  logger.info({ id, email: normalizedEmail }, "Client account created");
  res.status(201).json({ token, user });
});

// ─── POST /auth/client/login ──────────────────────────────────────────────────

router.post("/auth/client/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email?.trim() || !password?.trim()) {
    res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    return;
  }

  const user = await queryOne<{
    id: string; name: string; email: string; phone: string | null; gender: string | null; password_hash: string; share_data_with_restaurants: boolean; allow_ai_memory: boolean; onboarding_completed: boolean;
  }>(
    "SELECT id, name, email, phone, gender, password_hash, share_data_with_restaurants, allow_ai_memory, onboarding_completed FROM client_accounts WHERE email = $1",
    [email.toLowerCase().trim()]
  );

  if (!user) {
    res.status(401).json({ error: "E-mail ou senha incorretos" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "E-mail ou senha incorretos" });
    return;
  }

  const token = buildToken(user);
  res.json({ token, user: {
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    gender: user.gender,
    shareDataWithRestaurants: user.share_data_with_restaurants,
    allowAIMemory: user.allow_ai_memory,
    onboardingCompleted: user.onboarding_completed,
  } });
});

// ─── GET /auth/client/me ──────────────────────────────────────────────────────

router.get("/auth/client/me", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token necessário" });
    return;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload?.isClientUser) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  const user = await queryOne(
    "SELECT id, name, email, phone, gender, created_at, share_data_with_restaurants AS \"shareDataWithRestaurants\", allow_ai_memory AS \"allowAIMemory\", onboarding_completed AS \"onboardingCompleted\", discovery_preferences AS \"discoveryPreferences\", saved_addresses AS \"savedAddresses\" FROM client_accounts WHERE id = $1",
    [payload.clientId as string]
  );
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json(user);
});

router.patch("/auth/client/preferences", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  const payload = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Token inválido" });
    return;
  }
  const body = req.body as {
    shareDataWithRestaurants?: boolean;
    allowAIMemory?: boolean;
    onboardingCompleted?: boolean;
    discoveryPreferences?: unknown;
  };
  if (typeof body.shareDataWithRestaurants !== "boolean" || typeof body.allowAIMemory !== "boolean") {
    res.status(400).json({ error: "Preferências inválidas" });
    return;
  }
  if (body.discoveryPreferences !== undefined && (!Array.isArray(body.discoveryPreferences) || !body.discoveryPreferences.every((value) => typeof value === "string"))) {
    res.status(400).json({ error: "Preferências de descoberta inválidas" });
    return;
  }
  await execute(
    `UPDATE client_accounts SET share_data_with_restaurants = $1, allow_ai_memory = $2, onboarding_completed = COALESCE($3, onboarding_completed), discovery_preferences = COALESCE($4::jsonb, discovery_preferences), updated_at = NOW() WHERE id = $5`,
    [body.shareDataWithRestaurants, body.allowAIMemory, body.onboardingCompleted, body.discoveryPreferences === undefined ? null : JSON.stringify(body.discoveryPreferences), payload.clientId],
  );
  res.json({ shareDataWithRestaurants: body.shareDataWithRestaurants, allowAIMemory: body.allowAIMemory, onboardingCompleted: body.onboardingCompleted ?? true, discoveryPreferences: body.discoveryPreferences ?? [] });
});

type SavedAddress = {
  id: string;
  label: string;
  recipientName?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
};

function validAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Partial<SavedAddress>;
  return typeof address.id === "string" && typeof address.label === "string" && address.label.trim().length > 0
    && typeof address.street === "string" && typeof address.number === "string"
    && typeof address.neighborhood === "string" && typeof address.city === "string" && typeof address.state === "string";
}

router.get("/auth/client/addresses", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  const payload = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Token inválido" });
    return;
  }
  const row = await queryOne<{ savedAddresses: unknown }>("SELECT saved_addresses AS \"savedAddresses\" FROM client_accounts WHERE id = $1", [payload.clientId]);
  res.json(Array.isArray(row?.savedAddresses) ? row.savedAddresses : []);
});

router.put("/auth/client/addresses", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  const payload = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Token inválido" });
    return;
  }
  const addresses = (req.body as { addresses?: unknown }).addresses;
  if (!Array.isArray(addresses) || !addresses.every(validAddress)) {
    res.status(400).json({ error: "Lista de endereços inválida" });
    return;
  }
  const normalized = addresses.map((address, index) => ({ ...address, label: address.label.trim(), isDefault: address.isDefault === true || (index === 0 && !addresses.some((item) => item.isDefault === true)) }));
  await execute("UPDATE client_accounts SET saved_addresses = $1::jsonb, updated_at = NOW() WHERE id = $2", [JSON.stringify(normalized), payload.clientId]);
  res.json(normalized);
});

// Acessibilidade (16/08/2026, Manual seção 38.2). Frontend manda um array
// de strings livre (ex.: ["visual", "neurodivergencia", "outra"]) — a lista
// de opções vive só na tela, o backend não valida contra enum fixo pra não
// travar se a lista de opções crescer sem precisar de deploy sincronizado.
router.patch("/client/accessibility-preferences", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  const payload = header?.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!payload?.isClientUser || typeof payload.clientId !== "string") {
    res.status(401).json({ error: "Token inválido" });
    return;
  }
  const body = req.body as { dificuldades?: unknown };
  if (!Array.isArray(body.dificuldades) || !body.dificuldades.every((d) => typeof d === "string")) {
    res.status(400).json({ error: "dificuldades precisa ser uma lista de strings" });
    return;
  }
  await execute(
    `UPDATE client_accounts SET accessibility_needs = $1, updated_at = NOW() WHERE id = $2`,
    [body.dificuldades, payload.clientId],
  );
  res.json({ ok: true });
});

export default router;
