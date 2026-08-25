/**
 * auth.ts — Autenticação: cadastro de empresa, login do dono, acesso de funcionários via token/QR.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query, queryOne, execute } from "../lib/db.js";
import { employees, restaurants, menuItems, getSettings, createId, deliveryGovernanceProfiles } from "../lib/data-store.js";
import { isGovernanceBlocked } from "../lib/delivery-governance.js";
import { checkPerimetro } from "../lib/perimetro.js";
import { loginLimiter, onboardingLimiter, passwordRecoveryLimiter, registrationCodeLimiter } from "../lib/rate-limiter.js";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// JWT_SECRET — Configuração de chave de assinatura de tokens JWT
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ CRÍTICO: Em produção, JWT_SECRET é validado em index.ts
//    Aqui usamos fallback APENAS em desenvolvimento (com aviso no boot).
//    Nunca, NUNCA deixar "development-only-insecure-key" em produção.

function initJwtSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;

  // Em produção, JWT_SECRET deve estar obrigatoriamente definido (validado no boot)
  if (isProduction && !secret) {
    throw new Error(
      'FATAL: JWT_SECRET não está definido em NODE_ENV=production. ' +
      'A validação em index.ts deveria ter falhado no boot. Isso não deveria acontecer.'
    );
  }

  // Em desenvolvimento, usa fallback com aviso (apenas para conveniência)
  if (!isProduction && !secret) {
    console.warn(
      '\n⚠️  AVISO DE DESENVOLVIMENTO: Usando JWT_SECRET inseguro (fallback).\n' +
      '   Em produção, isso NÃO é permitido.\n'
    );
    return 'development-only-insecure-key';
  }

  return secret ?? 'development-only-insecure-key';
}

const JWT_SECRET = initJwtSecret();
const JWT_EXPIRES = "2h";
const REGISTRATION_CODE_TTL_MS = 48 * 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlatformAdmin(email: string): boolean {
  const rawList = process.env.SUPER_ADMIN_EMAILS ?? process.env.SUPER_ADMIN_EMAIL ?? "";
  const configuredEmails = rawList.split(",").map((configuredEmail) => configuredEmail.trim().toLowerCase()).filter(Boolean);
  return configuredEmails.includes(email.trim().toLowerCase());
}

export function isValidLocalSupergestoraToken(provided: string | undefined): boolean {
  const expected = process.env.SUPERGESTORA_LOCAL_TOKEN;
  if (!expected || !provided) return false;
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

async function sendPasswordRecoveryEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend não está configurado");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Código para recuperar sua senha MIAR",
      html: `<p>Seu código de recuperação MIAR é:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>O código expira em 10 minutos.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function validPassword(password: string): boolean {
  return password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

type OwnerRegistrationData = {
  companyName: string;
  razaoSocial?: string | null;
  logoUrl?: string | null;
  cnpj?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  ownerName: string;
  passwordHash: string;
};

async function createCompanyAndOwner(data: OwnerRegistrationData) {
  const companyId = randomUUID();
  const ownerId = randomUUID();

  restaurants.push({
    id: companyId,
    name: data.companyName,
    rating: 4.8,
    distance: 0.5,
    pricePerPerson: 0,
    cuisine: "Restaurante",
    address: data.address ?? "Endereço a definir",
    preOrderEnabled: true,
    reserveMesasEnabled: true,
    qrEntranceEnabled: true,
    priorityPaymentEnabled: true,
    openNow: true,
    waitTime: 10,
  });

  await execute(
    `INSERT INTO companies (id, name, razao_social, cnpj, email, phone, address, owner_name, logo_url, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
    [
      companyId,
      data.companyName,
      data.razaoSocial ?? null,
      data.cnpj ?? null,
      data.email,
      data.phone ?? null,
      data.address ?? null,
      data.ownerName,
      data.logoUrl ?? null,
    ],
  );
  await execute(
    `INSERT INTO owner_accounts (id, company_id, email, phone, password_hash, name)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [ownerId, companyId, data.email, data.phone ?? null, data.passwordHash, data.ownerName],
  );

  return {
    token: signToken({
      ownerId,
      companyId,
      email: data.email,
      role: "owner",
      name: data.ownerName,
      isPlatformAdmin: isPlatformAdmin(data.email),
    }),
    owner: { id: ownerId, name: data.ownerName, email: data.email },
    company: { id: companyId, name: data.companyName },
  };
}

// ─── Middleware: proteger rotas do gestor ─────────────────────────────────────

export function requireOwnerAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação necessário" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload || payload.role !== "owner") {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }
  if (getSettings(payload.companyId as string).perimetro?.aplicarNoGestor) {
    const perimetro = checkPerimetro(req, true, payload.companyId as string);
    if (!perimetro.permitido) {
      res.status(403).json({ error: perimetro.motivo });
      return;
    }
  }
  (req as any).owner = payload;
  next();
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.SUPERGESTORA_LOCAL === "true" &&
    isValidLocalSupergestoraToken(req.headers["x-supergestora-local-token"] as string | undefined)
  ) {
    (req as any).owner = { ownerId: "supergestora-local", companyId: "platform", email: "local@supergestora" };
    next();
    return;
  }
  requireOwnerAuth(req, res, () => {
    const owner = (req as any).owner as { email?: string };
    if (!owner.email || !isPlatformAdmin(owner.email)) {
      res.status(403).json({ error: "Acesso restrito ao administrador da plataforma" });
      return;
    }
    next();
  });
}

export function requireAnyAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação necessário" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }
  // Trava de segurança: um token de funcionário só continua valendo se o
  // funcionário ainda estiver ativo AGORA — não só no momento em que fez
  // login. Isso fecha o buraco do celular perdido/roubado: assim que o
  // dono desativa o funcionário no gestor, o acesso morre na próxima
  // chamada, mesmo que o token em si só vencesse dias depois.
  if (payload.isEmployee) {
    const employee = employees.find((e) => e.id === payload.employeeId);
    if (!employee || !employee.active) {
      res.status(401).json({ error: "Acesso deste funcionário foi encerrado" });
      return;
    }
    const perimetro = checkPerimetro(req, false, payload.companyId as string);
    if (!perimetro.permitido) {
      res.status(403).json({ error: perimetro.motivo });
      return;
    }
  }
  (req as any).auth = payload;
  next();
}

// Protege rotas que pertencem a um cliente logado (não funcionário/dono).
// Além de exigir o token, guarda o clientId em req para a rota conferir
// que o cliente só está acessando os PRÓPRIOS dados.
export function requireClientAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Login necessário" });
    return;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload?.isClientUser) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }
  (req as any).clientId = payload.clientId as string;
  next();
}

// ─── GET /auth/status ────────────────────────────────────────────────────────
// CORRIGIDO EM 29/07/2026: antes verificava "SELECT ... LIMIT 1" — ou seja,
// bastava QUALQUER empresa se cadastrar em qualquer lugar pra travar o sistema
// inteiro em modo login, impedindo novos restaurantes de se cadastrarem.
// Isso vinha de um comentário no register/start que dizia "cadastro único com
// SMS" — o sistema foi feito, de propósito, pra aceitar só 1 cadastro no total.
// Decisão tomada em 29/07/2026: o MIAR é multi-tenant (SaaS), então "registered"
// não faz sentido como pergunta global. Sempre respondemos como "não travado",
// e o /auth/register/start abaixo é quem decide se aquele e-mail específico
// já existe ou não.
router.get("/auth/status", async (_req, res): Promise<void> => {
  res.json({ registered: false, companyName: null });
});

// ─── POST /auth/register — cadastrar empresa + conta do dono ─────────────────

router.post("/auth/register", onboardingLimiter, async (req, res): Promise<void> => {
  res.status(410).json({
    error: "O cadastro precisa ser confirmado por código. Use o novo fluxo de cadastro.",
  });
  return;

  const { companyName, cnpj, email, phone, address, ownerName, password } = req.body as {
    companyName: string; cnpj?: string; email: string; phone?: string;
    address?: string; ownerName: string; password: string;
  };

  if (!companyName?.trim() || !email?.trim() || !ownerName?.trim() || !password?.trim()) {
    res.status(400).json({ error: "Nome da empresa, email, nome do responsável e senha são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    return;
  }

  const existing = await queryOne("SELECT id FROM companies LIMIT 1");
  if (existing) {
    res.status(409).json({ error: "Empresa já cadastrada. Faça login para acessar." });
    return;
  }

  const emailExists = await queryOne("SELECT id FROM owner_accounts WHERE email = $1", [email.toLowerCase()]);
  if (emailExists) {
    res.status(409).json({ error: "Email já cadastrado" });
    return;
  }

  const companyId = randomUUID();
  const ownerId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  restaurants.push({
    id: companyId,
    name: companyName.trim(),
    rating: 4.8,
    distance: 0.5,
    pricePerPerson: 0,
    cuisine: "Restaurante",
    address: address?.trim() ?? "Endereço a definir",
    preOrderEnabled: true,
    reserveMesasEnabled: true,
    qrEntranceEnabled: true,
    priorityPaymentEnabled: true,
    openNow: true,
    waitTime: 10,
  });

  await execute(
    `INSERT INTO companies (id, name, cnpj, email, phone, address, owner_name, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
    [companyId, companyName.trim(), cnpj ?? null, email.toLowerCase(), phone ?? null, address ?? null, ownerName.trim()]
  );

  await execute(
    `INSERT INTO owner_accounts (id, company_id, email, password_hash, name)
     VALUES ($1,$2,$3,$4,$5)`,
    [ownerId, companyId, email.toLowerCase(), passwordHash, ownerName.trim()]
  );

  const token = signToken({ ownerId, companyId, email: email.toLowerCase(), role: "owner", name: ownerName });

  res.status(201).json({
    token,
    owner: { id: ownerId, name: ownerName, email: email.toLowerCase() },
    company: { id: companyId, name: companyName },
  });
});

// ─── POST /auth/register/start — iniciar cadastro de um novo restaurante ─────

router.post("/auth/register/start", onboardingLimiter, async (req, res): Promise<void> => {
  const { companyName, razaoSocial, logoUrl, cnpj, email, phone, address, ownerName, password } = req.body as {
    companyName?: string;
    razaoSocial?: string;
    logoUrl?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    address?: string;
    ownerName?: string;
    password?: string;
  };

  if (!companyName?.trim() || !email?.trim() || !ownerName?.trim() || !password?.trim()) {
    res.status(400).json({
      error: "Empresa, responsável, e-mail e senha são obrigatórios",
    });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    return;
  }

  // REMOVIDO EM 29/07/2026: aqui existia um bloqueio "SELECT ... LIMIT 1" que
  // impedia QUALQUER segundo cadastro no sistema inteiro, de qualquer restaurante,
  // com qualquer e-mail. A checagem certa é a de baixo (e-mail duplicado), que
  // já existia mas nunca era alcançada porque este bloqueio vinha antes e sempre
  // barrava primeiro depois do primeiro cadastro.

  const emailExists = await queryOne(
    "SELECT id FROM owner_accounts WHERE email = $1",
    [email.toLowerCase()],
  );
  if (emailExists) {
    res.status(409).json({ error: "E-mail já cadastrado" });
    return;
  }

  // CORRIGIDO 08/08/2026: não existia NENHUMA checagem de CPF/CNPJ duplicado
  // aqui — o mesmo CPF podia cadastrar quantas empresas quisesse. O campo
  // "cnpj" já recebe o CPF como fallback quando não há CNPJ (ver frontend:
  // cnpj: form.cnpj || form.cpf), então checar duplicidade nesse campo cobre
  // os dois casos.
  const documentTrimmed = cnpj?.trim();
  if (documentTrimmed) {
    const documentExists = await queryOne(
      "SELECT id FROM companies WHERE cnpj = $1",
      [documentTrimmed],
    );
    if (documentExists) {
      res.status(409).json({ error: "CPF/CNPJ já cadastrado" });
      return;
    }
  }

  const normalizedPhone = phone?.trim() ? normalizePhone(phone) : null;

  // Bypass do código de aprovação para e-mails já confiáveis
  // (SUPER_ADMIN_EMAIL/EMAILS). Sem isso, ninguém consegue virar admin
  // da plataforma num banco novo/vazio, porque não existiria nenhum
  // admin ainda para aprovar o próprio código — impasse de
  // ovo-e-galinha. O e-mail já é a prova de confiança aqui.
  if (isPlatformAdmin(email.trim())) {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await createCompanyAndOwner({
      companyName: companyName.trim(),
      cnpj: cnpj?.trim() || null,
      email: email.toLowerCase().trim(),
      phone: normalizedPhone,
      address: address?.trim() || null,
      ownerName: ownerName.trim(),
      passwordHash,
    });
    res.status(201).json({ ...result, platformAdmin: true });
    return;
  }

  if (!normalizedPhone || !/^\+55\d{10,11}$/.test(normalizedPhone)) {
    res.status(400).json({ error: "Informe um telefone celular válido para receber o código." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + REGISTRATION_CODE_TTL_MS).toISOString();
  await execute(
    "UPDATE pending_owner_registrations SET used = TRUE WHERE phone = $1 AND used = FALSE",
    [normalizedPhone],
  );
  await execute(
    `INSERT INTO pending_owner_registrations
      (id, phone, code, company_name, cnpj, email, address, owner_name, password_hash, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      randomUUID(),
      normalizedPhone,
      code,
      companyName.trim(),
      cnpj?.trim() || null,
      email.toLowerCase().trim(),
      address?.trim() || null,
      ownerName.trim(),
      passwordHash,
      expiresAt,
    ],
  );

  res.json({
    success: true,
    phone: normalizedPhone,
    message: "Cadastro pendente. A Gestora recebeu a solicitação e enviará o código de aprovação.",
  });
});

// Cadastro direto da Supergestora local: esta tela já é o administrador, então
// não deve enviar a própria conta para a fila de aprovação que ela administra.
router.post("/auth/register/platform-admin", onboardingLimiter, async (req, res): Promise<void> => {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.SUPERGESTORA_LOCAL !== "true" ||
    !isValidLocalSupergestoraToken(req.headers["x-supergestora-local-token"] as string | undefined)
  ) {
    res.status(403).json({ error: "Cadastro administrativo disponível apenas na Supergestora local." });
    return;
  }

  const { companyName, email, phone, ownerName, password } = req.body as {
    companyName?: string; email?: string; phone?: string; ownerName?: string; password?: string;
  };
  if (!companyName?.trim() || !email?.trim() || !ownerName?.trim() || !password?.trim()) {
    res.status(400).json({ error: "Empresa, responsável, e-mail e senha são obrigatórios" });
    return;
  }
  if (!validPassword(password)) {
    res.status(400).json({ error: "A senha deve ter ao menos 10 caracteres, letras maiúsculas e minúsculas, número e símbolo." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await queryOne("SELECT id FROM owner_accounts WHERE email = $1", [normalizedEmail])) {
    res.status(409).json({ error: "E-mail já cadastrado" });
    return;
  }

  const result = await createCompanyAndOwner({
    companyName: companyName.trim(),
    email: normalizedEmail,
    phone: phone?.trim() || null,
    ownerName: ownerName.trim(),
    passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json({ ...result, platformAdmin: true });
});

router.get("/admin/pending-owner-registrations", requirePlatformAdmin, async (_req, res): Promise<void> => {
  const registrations = await query<{
    id: string; owner_name: string; phone: string; code: string;
    company_name: string; email: string; expires_at: string; created_at: string;
  }>(
    `SELECT id, owner_name, phone, code, company_name, email, expires_at, created_at
     FROM pending_owner_registrations
     WHERE used = FALSE
     ORDER BY created_at DESC`,
  );
  res.json(registrations);
});

router.delete("/admin/pending-owner-registrations/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const deleted = await execute(
    "UPDATE pending_owner_registrations SET used = TRUE, used_at = NOW() WHERE id = $1 AND used = FALSE",
    [req.params.id],
  );
  if (deleted !== 1) {
    res.status(404).json({ error: "Código pendente não encontrado." });
    return;
  }
  res.json({ success: true });
});

// ─── POST /auth/register/verify — concluir cadastro após confirmação ──────────

router.post("/auth/register/verify", registrationCodeLimiter, async (req, res): Promise<void> => {
  const { phone, code } = req.body as { phone?: string; code?: string };

  if (!phone?.trim() || !code?.trim()) {
    res.status(400).json({ error: "Telefone e código são obrigatórios" });
    return;
  }

  const normalizedPhone = normalizePhone(phone);
  const pending = await queryOne<{
    id: string;
    phone: string;
    code: string;
    company_name: string;
    cnpj: string | null;
    email: string;
    address: string | null;
    owner_name: string;
    password_hash: string;
    expires_at: string;
    used: boolean;
  }>(
    `SELECT * FROM pending_owner_registrations
     WHERE phone = $1 AND used = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedPhone],
  );

  if (!pending) {
    res.status(401).json({ error: "Código inválido ou expirado. Solicite um novo." });
    return;
  }
  if (new Date(pending.expires_at) < new Date()) {
    await execute("UPDATE pending_owner_registrations SET used = TRUE WHERE id = $1", [pending.id]);
    res.status(401).json({ error: "Código expirado. Solicite um novo." });
    return;
  }
  if (pending.code !== code.trim()) {
    res.status(401).json({ error: "Código incorreto." });
    return;
  }

  // CORRIGIDO EM 29/07/2026: removido SELECT ... LIMIT 1 que bloqueava qualquer
  // segundo cadastro no sistema inteiro. O único bloqueio válido é e-mail duplicado.
  const emailExists = await queryOne(
    "SELECT id FROM owner_accounts WHERE email = $1",
    [pending.email],
  );
  if (emailExists) {
    await execute("UPDATE pending_owner_registrations SET used = TRUE WHERE id = $1", [pending.id]);
    res.status(409).json({ error: "E-mail já cadastrado" });
    return;
  }

  const consumed = await execute(
    "UPDATE pending_owner_registrations SET used = TRUE, used_at = NOW() WHERE id = $1 AND used = FALSE",
    [pending.id],
  );
  if (consumed !== 1) {
    res.status(401).json({ error: "Código inválido ou já utilizado." });
    return;
  }
  const result = await createCompanyAndOwner({
    companyName: pending.company_name,
    cnpj: pending.cnpj,
    email: pending.email,
    phone: normalizedPhone,
    address: pending.address,
    ownerName: pending.owner_name,
    passwordHash: pending.password_hash,
  });
  res.status(201).json(result);
});

// ─── POST /auth/register/resend — reenviar código do cadastro pendente ──────

router.post("/auth/register/resend", onboardingLimiter, async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!phone?.trim()) {
    res.status(400).json({ error: "Telefone é obrigatório" });
    return;
  }

  const normalizedPhone = normalizePhone(phone);
  const pending = await queryOne<{ id: string }>(
    `SELECT id FROM pending_owner_registrations
     WHERE phone = $1 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedPhone],
  );
  if (!pending) {
    res.status(404).json({ error: "Cadastro não encontrado ou código expirado. Volte e revise os dados." });
    return;
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + REGISTRATION_CODE_TTL_MS).toISOString();
  await execute(
    "UPDATE pending_owner_registrations SET code = $1, expires_at = $2 WHERE id = $3",
    [code, expiresAt, pending.id],
  );
  res.json({
    success: true,
    phone: normalizedPhone,
    message: "Novo código gerado. Solicite o código à Gestora.",
  });
});

// ─── Recuperação segura de senha ────────────────────────────────────────────

router.post("/auth/password/start", passwordRecoveryLimiter, async (req, res): Promise<void> => {
  const { contact } = req.body as { contact?: string };
  if (!contact?.trim()) {
    res.status(400).json({ error: "Informe seu e-mail cadastrado." });
    return;
  }
  const rawContact = contact.trim();
  if (!rawContact.includes("@")) {
    res.status(400).json({ error: "A recuperação está disponível somente por e-mail." });
    return;
  }
  const value = rawContact.toLowerCase();
  const owner = await queryOne<{ id: string; email: string }>(
    `SELECT oa.id, oa.email
     FROM owner_accounts oa JOIN companies c ON c.id = oa.company_id
     WHERE oa.email = $1 OR oa.phone = $1
     LIMIT 1`,
    [value],
  );
  // A resposta permanece genérica para não revelar se o contato está cadastrado.
  if (!owner) {
    if (process.env.NODE_ENV !== "production") {
      res.status(404).json({ error: "Este e-mail não está cadastrado." });
      return;
    }
    res.json({ success: true, message: "Se o cadastro existir, enviaremos um código." });
    return;
  }
  const code = String(randomInt(100000, 1000000));
  const recoveryId = randomUUID();
  await execute("UPDATE password_recovery_codes SET used = TRUE, used_at = NOW() WHERE owner_id = $1 AND used = FALSE", [owner.id]);
  await execute(
    `INSERT INTO password_recovery_codes (id, owner_id, code_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [recoveryId, owner.id, hashRecoveryCode(code)],
  );
  if (process.env.NODE_ENV === "production" || process.env.RESEND_API_KEY) {
    try {
      await sendPasswordRecoveryEmail(owner.email, code);
    } catch (error) {
      console.error("Password recovery email failed", error);
      res.status(502).json({ error: "Não foi possível enviar o código por e-mail. Configure o serviço de e-mail." });
      return;
    }
  }
  res.json({
    success: true,
    contact: owner.email,
    message: process.env.NODE_ENV === "production" || process.env.RESEND_API_KEY ? "Código enviado por e-mail." : "Código gerado no modo local.",
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  });
});

router.post("/auth/password/verify", passwordRecoveryLimiter, async (req, res): Promise<void> => {
  const { contact, code } = req.body as { contact?: string; code?: string };
  if (!contact?.trim() || !code?.trim()) {
    res.status(400).json({ error: "E-mail e código são obrigatórios." });
    return;
  }
  const rawContact = contact.trim();
  const lookup = rawContact.includes("@") ? rawContact.toLowerCase() : normalizePhone(rawContact);
  const recovery = await queryOne<{ id: string; owner_id: string; code_hash: string; expires_at: string }>(
    `SELECT pr.id, pr.owner_id, pr.code_hash, pr.expires_at
     FROM password_recovery_codes pr JOIN owner_accounts oa ON oa.id = pr.owner_id
     WHERE oa.email = $1 AND pr.used = FALSE ORDER BY pr.created_at DESC LIMIT 1`,
    [lookup],
  );
  if (!recovery || new Date(recovery.expires_at) < new Date() || hashRecoveryCode(code.trim()) !== recovery.code_hash) {
    res.status(401).json({ error: "Código inválido ou expirado." });
    return;
  }
  const consumed = await execute("UPDATE password_recovery_codes SET used = TRUE, used_at = NOW() WHERE id = $1 AND used = FALSE", [recovery.id]);
  if (consumed !== 1) {
    res.status(401).json({ error: "Código inválido ou já utilizado." });
    return;
  }
  const token = signToken({ purpose: "password-recovery", ownerId: recovery.owner_id, recoveryId: recovery.id });
  res.json({ token });
});

router.post("/auth/password/reset", passwordRecoveryLimiter, async (req, res): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password || !validPassword(password)) {
    res.status(400).json({ error: "A senha deve ter 10 caracteres, maiúscula, minúscula, número e símbolo." });
    return;
  }
  const payload = verifyToken(token);
  if (!payload || payload.purpose !== "password-recovery" || typeof payload.ownerId !== "string" || typeof payload.recoveryId !== "string") {
    res.status(401).json({ error: "Token de recuperação inválido ou expirado." });
    return;
  }
  const recovery = await queryOne<{ id: string; used: boolean; reset_at: string | null }>("SELECT id, used, reset_at FROM password_recovery_codes WHERE id = $1 AND owner_id = $2", [payload.recoveryId, payload.ownerId]);
  if (!recovery || !recovery.used || recovery.reset_at) {
    res.status(401).json({ error: "Recuperação não autorizada." });
    return;
  }
  const updated = await execute(
    `UPDATE password_recovery_codes SET reset_at = NOW()
     WHERE id = $1 AND owner_id = $2 AND used = TRUE AND reset_at IS NULL`,
    [payload.recoveryId, payload.ownerId],
  );
  if (updated !== 1) {
    res.status(401).json({ error: "Recuperação já utilizada." });
    return;
  }
  await execute("UPDATE owner_accounts SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(password, 12), payload.ownerId]);
  res.json({ ok: true });
});

// ─── POST /auth/signup — cadastro por telefone indisponível sem provedor SMS ─

router.post("/auth/signup", onboardingLimiter, async (req, res): Promise<void> => {
  res.status(503).json({
    error: "Cadastro por telefone temporariamente indisponível. Use e-mail e senha.",
  });
});

// ─── POST /auth/login — login do dono ────────────────────────────────────────

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const { email: identifier, password, deviceId, deviceLabel } = req.body as {
    email: string; password: string; deviceId?: string; deviceLabel?: string;
  };

  if (!identifier?.trim() || !password?.trim()) {
    res.status(400).json({ error: "E-mail ou telefone e senha são obrigatórios" });
    return;
  }

  const normalizedIdentifier = identifier.trim();
  const isEmail = normalizedIdentifier.includes("@");
  const lookupValue = isEmail ? normalizedIdentifier.toLowerCase() : normalizePhone(normalizedIdentifier);

  const owner = await queryOne<{
    id: string; company_id: string; email: string; phone: string | null;
    password_hash: string; name: string;
  }>("SELECT * FROM owner_accounts WHERE email = $1 OR phone = $1", [lookupValue]);

  if (!owner) {
    res.status(401).json({ error: "Email ou senha incorretos" });
    return;
  }

  const valid = await bcrypt.compare(password, owner.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Email ou senha incorretos" });
    return;
  }

  const company = await queryOne<{ id: string; name: string; owner_name: string }>(
    "SELECT id, name, owner_name FROM companies WHERE id = $1", [owner.company_id]
  );

  const token = signToken({
    ownerId: owner.id, companyId: owner.company_id,
    email: owner.email, role: "owner", name: owner.name,
    isPlatformAdmin: isPlatformAdmin(owner.email),
  });

  // Verificação de Segurança (15/08/2026): registra o dispositivo do login
  // e sinaliza se é a primeira vez que esse device_id acessa essa conta —
  // não bloqueia (o dono pode estar num celular novo de verdade), só avisa.
  let isNewDevice = false;
  if (deviceId?.trim()) {
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM login_devices WHERE owner_id = $1 AND device_id = $2",
      [owner.id, deviceId.trim()]
    );
    isNewDevice = !existing;
    await execute(
      `INSERT INTO login_devices (id, owner_id, device_id, user_agent, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (owner_id, device_id) DO UPDATE SET last_seen_at = NOW()`,
      [randomUUID(), owner.id, deviceId.trim(), (deviceLabel || req.headers["user-agent"] || "").slice(0, 200)]
    );
  }

  res.json({
    token,
    owner: { id: owner.id, name: owner.name, email: owner.email },
    company,
    isNewDevice,
  });
});

// ─── GET /auth/me — dados do dono logado ─────────────────────────────────────

// ─── GET /auth/devices — dispositivos que já acessaram esta conta ───────────
// Parte da Verificação de Segurança: o dono consegue ver de quantos
// aparelhos diferentes a conta foi acessada, e quando foi a última vez.
router.get("/auth/devices", requireOwnerAuth, async (req, res): Promise<void> => {
  const { ownerId } = (req as any).owner;
  const devices = await query<{
    device_id: string; user_agent: string | null;
    first_seen_at: string; last_seen_at: string;
  }>(
    "SELECT device_id, user_agent, first_seen_at, last_seen_at FROM login_devices WHERE owner_id = $1 ORDER BY last_seen_at DESC",
    [ownerId]
  );
  res.json(devices.map((d) => ({
    deviceId: d.device_id,
    label: d.user_agent,
    firstSeenAt: d.first_seen_at,
    lastSeenAt: d.last_seen_at,
  })));
});

router.get("/auth/me", requireOwnerAuth, async (req, res): Promise<void> => {
  const { ownerId, companyId, email } = (req as any).owner;
  const [owner, company] = await Promise.all([
    queryOne<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM owner_accounts WHERE id = $1", [ownerId]
    ),
    queryOne<{ id: string; name: string; razao_social: string; cnpj: string; phone: string; address: string; logo_url: string }>(
      "SELECT id, name, razao_social, cnpj, phone, address, email, owner_name, logo_url FROM companies WHERE id = $1", [companyId]
    ),
  ]);
  res.json({
    isPlatformAdmin: isPlatformAdmin(email),
    owner,
    company: company ? {
      ...company,
      razaoSocial: (company as any).razao_social ?? null,
      logoUrl: (company as any).logo_url ?? null,
    } : null,
  });
});

// ─── PATCH /auth/company — atualizar dados da empresa ────────────────────────

router.patch("/auth/company", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { name, phone, address, cnpj } = req.body as {
    name?: string; phone?: string; address?: string; cnpj?: string;
  };
  await execute(
    `UPDATE companies SET
       name = COALESCE($1, name),
       phone = COALESCE($2, phone),
       address = COALESCE($3, address),
       cnpj = COALESCE($4, cnpj)
     WHERE id = $5`,
    [name ?? null, phone ?? null, address ?? null, cnpj ?? null, companyId]
  );
  const updated = await queryOne("SELECT * FROM companies WHERE id = $1", [companyId]);
  res.json(updated);
});

// ─── POST /auth/employee-login — funcionário acessa via token QR/link ────────

router.post("/auth/employee-login", async (req, res): Promise<void> => {
  const { token: rawToken } = req.body as { token: string };
  const token = rawToken?.trim();
  if (!token) {
    res.status(400).json({ error: "Token de acesso é obrigatório" });
    return;
  }

  if (/^\d{4,6}$/.test(token)) {
    const matches: typeof employees = [];
    for (const employee of employees.filter((item) => item.active)) {
      if (await bcrypt.compare(token, employee.pin)) matches.push(employee);
    }
    if (matches.length !== 1) {
      res.status(401).json({ error: "PIN inválido ou ambíguo" });
      return;
    }

    const employee = matches[0];
    const governanceProfile = deliveryGovernanceProfiles.find((profile) => profile.employeeId === employee.id);
    if (isGovernanceBlocked(governanceProfile)) {
      res.status(403).json({ error: "Funcionário suspenso ou banido para esta operação" });
      return;
    }

    const { pin: _pin, ...safeEmp } = employee;
    const sessionToken = signToken({
      employeeId: employee.id,
      role: employee.role,
      name: employee.name,
      companyId: employee.restaurantId,
      isEmployee: true,
    });
    res.json({ employee: safeEmp, sessionToken, role: employee.role });
    return;
  }

  const tokenRecord = await queryOne<{
    id: string; company_id: string; employee_id: string;
    token: string; role: string; active: boolean;
  }>("SELECT * FROM employee_tokens WHERE token = $1", [token]);

  if (!tokenRecord || !tokenRecord.active) {
    // Token não encontrado no banco ou inativo — rejeitar sempre.
    // Nunca inventar um companyId ("default") para tokens QR legados sem
    // registro: isso juntaria funcionários de restaurantes distintos sob
    // um tenant fictício e poderia vazar dados de demonstração.
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  const employee = employees.find((e) => e.id === tokenRecord.employee_id && e.restaurantId === tokenRecord.company_id && e.active);
  if (!employee) {
    res.status(404).json({ error: "Funcionário não encontrado ou inativo" });
    return;
  }

  const governanceProfile = deliveryGovernanceProfiles.find((profile) => profile.employeeId === employee.id);
  if (isGovernanceBlocked(governanceProfile)) {
    res.status(403).json({ error: "Funcionário suspenso ou banido para esta operação" });
    return;
  }

  const { pin: _pin, ...safeEmp } = employee;
  const sessionToken = signToken({
    employeeId: employee.id, role: employee.role,
    name: employee.name, companyId: tokenRecord.company_id, isEmployee: true,
  });

  res.json({ employee: safeEmp, sessionToken, role: employee.role });
});

// ─── POST /auth/employee-tokens — criar token de acesso para funcionário ──────

router.post("/auth/employee-tokens", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { employeeId } = req.body as { employeeId: string };

  const employee = employees.find((e) => e.id === employeeId && e.restaurantId === companyId);
  if (!employee) {
    res.status(404).json({ error: "Funcionário não encontrado" });
    return;
  }

  await execute("UPDATE employee_tokens SET active = false WHERE employee_id = $1", [employeeId]);

  const tokenId = randomUUID();
  const accessToken = `emp-${randomUUID().replace(/-/g, "")}`;

  await execute(
    `INSERT INTO employee_tokens (id, company_id, employee_id, token, role, active)
     VALUES ($1,$2,$3,$4,$5,true)
     ON CONFLICT (token) DO NOTHING`,
    [tokenId, companyId, employeeId, accessToken, employee.role]
  );

  employee.qrToken = accessToken;

  const rolePathMap: Record<string, string> = {
    owner: "/gestor",
    manager: "/gestor",
    cashier: "/caixa",
    waiter: "/garcom",
    cook: "/cozinha",
    delivery: "/entregador",
    custom: "/gestor",
  };

  res.json({
    token: accessToken,
    employeeId,
    role: employee.role,
    accessUrl: `${rolePathMap[employee.role] ?? "/gestor"}?token=${accessToken}`,
    qrData: accessToken,
  });
});

// ─── GET /auth/employee-tokens — listar tokens gerados ────────────────────────

router.get("/auth/employee-tokens", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const tokens = await query(
    "SELECT * FROM employee_tokens WHERE company_id = $1 ORDER BY created_at DESC",
    [companyId]
  );
  res.json(tokens);
});

// ─── POST /auth/refresh — renova token sem pedir senha de novo ────────────────
// Aceita qualquer token válido (owner OU employee) e devolve um novo token
// com expiry renovado. O frontend pode chamar isso ao montar a app se o
// token tiver mais de metade da vida consumida.
router.post("/auth/refresh", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  if (payload.isEmployee) {
    const employee = employees.find((candidate) =>
      candidate.id === payload.employeeId &&
      candidate.restaurantId === payload.companyId,
    );
    if (!employee || !employee.active) {
      res.status(401).json({ error: "Acesso deste funcionário foi encerrado" });
      return;
    }
  }

  // Remove campos de controle do JWT antes de reemitir
  const { iat, exp, ...claims } = payload as Record<string, unknown>;
  void iat; void exp;

  const newToken = signToken(claims);
  res.json({ token: newToken });
});

export default router;