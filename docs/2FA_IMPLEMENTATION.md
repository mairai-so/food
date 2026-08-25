# 🔐 IMPLEMENTAÇÃO DE 2FA (Two-Factor Authentication)

**Status**: 📋 Planejado para Fase 2
**Prioridade**: 🔴 CRÍTICA (segurança)
**Estimativa**: 8-10 horas de desenvolvimento

---

## 📌 VISÃO GERAL

Implementar 2FA (autenticação de dois fatores) para proprietários de restaurante via SMS OTP (One-Time Password).

**Benefício**: Mesmo que senha seja descoberta, atacante não consegue acessar sem o código SMS.

---

## 🏗️ ARQUITETURA

### Fluxo de Login com 2FA

```
┌──────────────────────────────────────────────────────┐
│ 1. Cliente entra email + senha (POST /api/auth/login)│
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ 2. Backend valida email + senha                      │
│    - Se inválido → 401 Unauthorized                  │
│    - Se válido → gera OTP e envia SMS                │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ 3. Cliente recebe SMS com código (ex: 123456)        │
│    Abre tela "Digite o código recebido"              │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ 4. Cliente envia código (POST /api/auth/verify-otp)  │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ 5. Backend valida:                                   │
│    - OTP correto?                                    │
│    - OTP ainda válido? (< 10 min)                    │
│    - Tentativas < 3?                                │
└───────────────┬──────────────────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
    VÁLIDO          INVÁLIDO
        │               │
        ▼               ▼
    Retorna JWT     401 Unauthorized
```

---

## 📊 BANCO DE DADOS

### Tabela: `otp_tokens`

```sql
CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owner_accounts(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  attempts INT DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_owner_id (owner_id),
  INDEX idx_expires_at (expires_at)
);
```

**Campos**:
- `owner_id` — Proprietário recebendo o código
- `phone` — Telefone para confirmar
- `code` — Código aleatório (6 dígitos)
- `attempts` — Quantas vezes tentou (bloqueia após 3)
- `expires_at` — Quando expira (10 minutos)

---

## 🔧 ENDPOINTS

### 1. POST /api/auth/login (Modificado)

**Request**:
```json
{
  "email": "joao@restaurante.com",
  "password": "Senha@12345"
}
```

**Response (Sucesso)**: HTTP 200
```json
{
  "requiresOtp": true,
  "sessionId": "temp-session-uuid",
  "message": "Código OTP enviado para +55 11 9999-9999"
}
```

**Response (Email/Senha inválida)**: HTTP 401
```json
{
  "error": "Email ou senha inválida"
}
```

---

### 2. POST /api/auth/verify-otp (Novo)

**Request**:
```json
{
  "sessionId": "temp-session-uuid",
  "code": "123456"
}
```

**Response (Sucesso)**: HTTP 200
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 7200,
  "user": {
    "id": "owner-uuid",
    "email": "joao@restaurante.com",
    "name": "João"
  }
}
```

**Response (Código inválido)**: HTTP 401
```json
{
  "error": "Código OTP inválido",
  "attemptsRemaining": 2
}
```

**Response (Código expirado)**: HTTP 410
```json
{
  "error": "Código expirado. Faça login novamente"
}
```

---

## 💻 IMPLEMENTAÇÃO

### Arquivo 1: `src/lib/otp-service.ts`

```typescript
import crypto from "crypto";
import { executeQuery } from "./db";

/**
 * Gera OTP aleatório (6 dígitos)
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Cria registro de OTP no banco
 */
export async function createOtpToken(
  ownerId: string,
  phone: string,
): Promise<string> {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await executeQuery(
    `INSERT INTO otp_tokens (owner_id, phone, code, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [ownerId, phone, code, expiresAt.toISOString()],
  );

  return code;
}

/**
 * Envio por SMS requer um provedor externo configurado.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  throw new Error("Envio de OTP por SMS não está configurado");
}

/**
 * Valida OTP (verifica se correto, válido e tentativas)
 */
export async function validateOtp(
  ownerId: string,
  code: string,
): Promise<boolean> {
  const result = await executeQuery(
    `SELECT * FROM otp_tokens
     WHERE owner_id = $1
     AND code = $2
     AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [ownerId, code],
  );

  if (result.rows.length === 0) {
    // Código não existe, expirou ou é inválido
    return false;
  }

  const token = result.rows[0];

  // Verificar tentativas
  if (token.attempts >= 3) {
    return false;
  }

  // Incrementar tentativas
  await executeQuery(
    `UPDATE otp_tokens SET attempts = attempts + 1
     WHERE id = $1`,
    [token.id],
  );

  return true;
}

/**
 * Limpa OTPs expirados (chamar periodicamente)
 */
export async function cleanupExpiredOtps(): Promise<void> {
  await executeQuery(
    `DELETE FROM otp_tokens WHERE expires_at < NOW()`,
    [],
  );
}
```

---

### Arquivo 2: `src/routes/auth-2fa.ts` (Nova rota)

```typescript
import { Router, type Request, type Response } from "express";
import { owner_accounts } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createOtpToken, sendOtpSms, validateOtp } from "../lib/otp-service";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/auth/login
 * Modificado: valida email/senha, envia OTP
 */
router.post("/login-2fa", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }

  try {
    const ownerResult = await executeQuery(
      `SELECT * FROM owner_accounts WHERE email = $1`,
      [email],
    );

    if (ownerResult.rows.length === 0) {
      return res.status(401).json({ error: "Email ou senha inválida" });
    }

    const owner = ownerResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, owner.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Email ou senha inválida" });
    }

    // Gerar e enviar OTP
    const code = await createOtpToken(owner.id, owner.phone);
    await sendOtpSms(owner.phone, code);

    // Criar session temporária (não é JWT real, apenas ID)
    const sessionId = crypto.randomUUID();

    // Armazenar sessionId em cache (Redis ou in-memory) por 5 min
    // Para simplicidade, vamos usar sessão curta
    await executeQuery(
      `INSERT INTO auth_sessions (session_id, owner_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
      [sessionId, owner.id],
    );

    res.json({
      requiresOtp: true,
      sessionId,
      message: `Código OTP enviado para +55 ${owner.phone.substring(0, 2)} ***-****`,
    });
  } catch (err) {
    logger.error({ err }, "Login 2FA error");
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

/**
 * POST /api/auth/verify-otp
 * Valida OTP e retorna JWT
 */
router.post("/verify-otp", async (req: Request, res: Response) => {
  const { sessionId, code } = req.body as { sessionId?: string; code?: string };

  if (!sessionId || !code) {
    return res.status(400).json({ error: "sessionId e code são obrigatórios" });
  }

  try {
    // Validar sessionId
    const sessionResult = await executeQuery(
      `SELECT * FROM auth_sessions
       WHERE session_id = $1
       AND expires_at > NOW()`,
      [sessionId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente" });
    }

    const session = sessionResult.rows[0];
    const ownerId = session.owner_id;

    // Validar OTP
    const isValidOtp = await validateOtp(ownerId, code);
    if (!isValidOtp) {
      const attemptsResult = await executeQuery(
        `SELECT (3 - attempts) as remaining FROM otp_tokens
         WHERE owner_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [ownerId],
      );
      const remaining = attemptsResult.rows[0]?.remaining || 0;

      return res.status(401).json({
        error: remaining > 0 ? "Código inválido" : "Muitas tentativas. Faça login novamente",
        attemptsRemaining: Math.max(0, remaining - 1),
      });
    }

    // Gerar JWT
    const owner = await executeQuery(
      `SELECT id, email, name, company_id FROM owner_accounts WHERE id = $1`,
      [ownerId],
    );

    const jwtToken = jwt.sign(
      {
        ownerId: owner.rows[0].id,
        companyId: owner.rows[0].company_id,
        email: owner.rows[0].email,
        role: "owner",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "2h" },
    );

    // Limpar session
    await executeQuery(
      `DELETE FROM auth_sessions WHERE session_id = $1`,
      [sessionId],
    );

    res.json({
      token: jwtToken,
      expiresIn: 7200,
      user: owner.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "OTP verification error");
    res.status(500).json({ error: "Erro ao verificar código" });
  }
});

export default router;
```

---

## 🧪 TESTES

### Teste 1: Gerar OTP

```bash
curl -X POST http://localhost:5000/api/auth/login-2fa \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@restaurante.com","password":"Senha@12345"}'

# Resposta esperada:
# {
#   "requiresOtp": true,
#   "sessionId": "abc123",
#   "message": "Código OTP enviado para +55 11 ****-****"
# }
```

### Teste 2: Verificar OTP

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123","code":"123456"}'

# Resposta esperada:
# {
#   "token": "eyJhbGc...",
#   "expiresIn": 7200,
#   "user": {...}
# }
```

---

## 🎨 MUDANÇAS NO FRONTEND

### Gestor App — Tela de Login

```tsx
// artifacts/gestor/src/pages/Login.tsx

const [step, setStep] = useState<"credentials" | "otp">("credentials");
const [sessionId, setSessionId] = useState("");

if (step === "credentials") {
  return (
    <LoginForm
      onSubmit={async (email, password) => {
        const res = await fetch("/api/auth/login-2fa", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        setSessionId(data.sessionId);
        setStep("otp");
      }}
    />
  );
}

if (step === "otp") {
  return (
    <OtpForm
      message="Código enviado para seu telefone"
      onSubmit={async (code) => {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          body: JSON.stringify({ sessionId, code }),
        });
        const data = await res.json();
        localStorage.setItem("token", data.token);
        window.location.href = "/dashboard";
      }}
    />
  );
}
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar tabela `otp_tokens` no banco
- [ ] Criar tabela `auth_sessions` no banco
- [ ] Implementar `src/lib/otp-service.ts`
- [ ] Criar rota `src/routes/auth-2fa.ts`
- [ ] Integrar rota no `app.ts`
- [ ] Modificar frontend do Gestor (tela de login)
- [ ] Testes unitários para OTP generation
- [ ] Testes de integração (login → OTP → JWT)
- [ ] E2E test para fluxo completo
- [ ] Documentação de usuário ("Como fazer login com 2FA")
- [ ] Deploy em staging

---

## 📈 PRÓXIMAS FASES

1. **Fase 1** (Agora): Implementar 2FA básico com SMS
2. **Fase 2** (Later): Adicionar Authenticator App (Google Authenticator, Authy)
3. **Fase 3** (Later): Adicionar Recovery Codes (backup codes para acesso sem SMS)
4. **Fase 4** (Later): 2FA obrigatório para ALL users (não apenas owner)

---

**Estimativa de Esforço**: 8-10 horas
**Prioridade**: 🔴 CRÍTICA
**Recomendação**: Começar assim que Bloco 1 estiver em produção
