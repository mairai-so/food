# 📱 DEVICE TRACKING & ALERTS

**Status**: 📋 Estrutura pronta, alertas precisam implementar
**Prioridade**: 🟡 MÉDIA (segurança complementar)
**Estimativa**: 6-8 horas de desenvolvimento

---

## 📌 VISÃO GERAL

Rastrear dispositivos que fazem login na conta e alertar o proprietário quando um novo dispositivo acessa.

**Benefício**: Detectar acessos não autorizados, ex: "Alguém fez login na minha conta desde outro IP/dispositivo?"

---

## 🏗️ ARQUITETURA

### Fluxo de Rastreamento

```
┌─────────────────────────────────────────┐
│ 1. Usuário faz login (POST /api/auth)   │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│ 2. Backend extrai:                      │
│    - IP address: 192.168.1.1            │
│    - User-Agent: "Chrome/120 macOS"     │
│    - Device fingerprint (hash)          │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│ 3. Busca no banco: este device já       │
│    fez login antes?                     │
└─────────────────────┬───────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
     NOVO                         EXISTENTE
        │                            │
        ▼                            ▼
   Enviar alerta             Atualizar último
   por email/SMS             acesso + continuar
```

---

## 📊 BANCO DE DADOS

### Tabela: `login_devices` (JÁ EXISTE)

```sql
CREATE TABLE login_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owner_accounts(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255), -- "iPhone de João", "Computador do escritório"
  user_agent TEXT,
  ip_address VARCHAR(45),
  fingerprint VARCHAR(255),
  last_login_at TIMESTAMP,
  first_login_at TIMESTAMP DEFAULT NOW(),
  trust_level VARCHAR(20) DEFAULT 'unknown', -- 'trusted', 'unknown', 'suspicious'
  alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(owner_id, device_id),
  INDEX idx_owner_id (owner_id),
  INDEX idx_device_id (device_id)
);
```

**Campos**:
- `device_id` — Hash único do dispositivo (User-Agent + IP)
- `device_name` — Nome amigável (definido pelo usuário)
- `user_agent` — Browser/SO (ex: "Chrome 120 macOS")
- `ip_address` — IP de origem
- `fingerprint` — Hash do User-Agent + timezone + idioma
- `trust_level` — Se é confiável ("trusted" = não enviar alerta mais)
- `alert_sent` — Se já foi enviado alerta de novo dispositivo
- `last_login_at` — Último acesso deste dispositivo

---

## 🔧 ENDPOINTS

### 1. GET /api/auth/devices (Novo)

**Descrição**: Lista todos os dispositivos que já fizeram login

**Response**: HTTP 200
```json
{
  "devices": [
    {
      "id": "device-uuid-1",
      "name": "iPhone de João",
      "userAgent": "iPhone Safari 17",
      "ipAddress": "192.168.1.100",
      "lastLoginAt": "2026-08-16T10:30:00Z",
      "trustLevel": "trusted",
      "isCurrentDevice": true
    },
    {
      "id": "device-uuid-2",
      "name": "Computador escritório",
      "userAgent": "Chrome 120 macOS",
      "ipAddress": "192.168.1.50",
      "lastLoginAt": "2026-08-15T14:20:00Z",
      "trustLevel": "unknown"
    }
  ]
}
```

---

### 2. PUT /api/auth/devices/:id/trust (Novo)

**Descrição**: Marcar dispositivo como confiável (parar de enviar alertas)

**Request**:
```json
{
  "trustLevel": "trusted",
  "deviceName": "iPhone de João"
}
```

**Response**: HTTP 200
```json
{
  "id": "device-uuid",
  "trustLevel": "trusted",
  "message": "Dispositivo marcado como confiável"
}
```

---

### 3. DELETE /api/auth/devices/:id (Novo)

**Descrição**: Revogar um dispositivo (desautenticar)

**Response**: HTTP 200
```json
{
  "message": "Dispositivo revogado. Você será desconectado se estiver usando este dispositivo."
}
```

---

## 💻 IMPLEMENTAÇÃO

### Arquivo 1: `src/lib/device-tracking.ts`

```typescript
import crypto from "crypto";
import { Request } from "express";
import { executeQuery } from "./db";

/**
 * Gera fingerprint único do dispositivo
 * Baseado em User-Agent, timezone e idioma
 */
export function generateDeviceFingerprint(req: Request): string {
  const userAgent = req.headers["user-agent"] || "unknown";
  const acceptLanguage = req.headers["accept-language"] || "unknown";

  const data = `${userAgent}|${acceptLanguage}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Gera device_id (combinação de IP + fingerprint)
 */
export function generateDeviceId(req: Request): string {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const fingerprint = generateDeviceFingerprint(req);

  const data = `${ip}|${fingerprint}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 50);
}

/**
 * Registra ou atualiza dispositivo de login
 * Retorna true se é novo dispositivo
 */
export async function trackLoginDevice(
  ownerId: string,
  req: Request,
): Promise<{ isNewDevice: boolean; deviceId: string }> {
  const deviceId = generateDeviceId(req);
  const userAgent = (req.headers["user-agent"] || "unknown").substring(0, 255);
  const ipAddress = (req.ip || req.headers["x-forwarded-for"] || "unknown") as string;
  const fingerprint = generateDeviceFingerprint(req);

  // Verificar se dispositivo já existe
  const existingResult = await executeQuery(
    `SELECT id, trust_level FROM login_devices
     WHERE owner_id = $1 AND device_id = $2`,
    [ownerId, deviceId],
  );

  const isNewDevice = existingResult.rows.length === 0;

  if (isNewDevice) {
    // Inserir novo dispositivo
    await executeQuery(
      `INSERT INTO login_devices
       (owner_id, device_id, user_agent, ip_address, fingerprint, last_login_at, alert_sent)
       VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)`,
      [ownerId, deviceId, userAgent, ipAddress, fingerprint],
    );
  } else {
    // Atualizar último login
    await executeQuery(
      `UPDATE login_devices
       SET last_login_at = NOW(), ip_address = $3
       WHERE owner_id = $1 AND device_id = $2`,
      [ownerId, deviceId, ipAddress],
    );
  }

  return { isNewDevice, deviceId };
}

/**
 * Verifica se deve enviar alerta (novo device + trust_level = 'unknown')
 */
export async function shouldSendDeviceAlert(
  ownerId: string,
  deviceId: string,
): Promise<boolean> {
  const result = await executeQuery(
    `SELECT trust_level, alert_sent FROM login_devices
     WHERE owner_id = $1 AND device_id = $2`,
    [ownerId, deviceId],
  );

  if (result.rows.length === 0) return false;

  const device = result.rows[0];
  return device.trust_level === "unknown" && !device.alert_sent;
}

/**
 * Marca alerta como enviado
 */
export async function markAlertSent(ownerId: string, deviceId: string): Promise<void> {
  await executeQuery(
    `UPDATE login_devices SET alert_sent = TRUE
     WHERE owner_id = $1 AND device_id = $2`,
    [ownerId, deviceId],
  );
}

/**
 * Lista todos os dispositivos do proprietário
 */
export async function getOwnerDevices(ownerId: string) {
  const result = await executeQuery(
    `SELECT id, device_name, user_agent, ip_address, last_login_at, trust_level
     FROM login_devices
     WHERE owner_id = $1
     ORDER BY last_login_at DESC`,
    [ownerId],
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.device_name || "Dispositivo desconhecido",
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
    lastLoginAt: row.last_login_at,
    trustLevel: row.trust_level,
  }));
}

/**
 * Marca dispositivo como confiável
 */
export async function trustDevice(
  ownerId: string,
  deviceId: string,
  deviceName?: string,
): Promise<void> {
  await executeQuery(
    `UPDATE login_devices
     SET trust_level = 'trusted', device_name = COALESCE($3, device_name), alert_sent = TRUE
     WHERE owner_id = $1 AND id = $2`,
    [ownerId, deviceId, deviceName],
  );
}

/**
 * Revoga um dispositivo (desautentica)
 */
export async function revokeDevice(ownerId: string, deviceId: string): Promise<void> {
  await executeQuery(
    `DELETE FROM login_devices
     WHERE owner_id = $1 AND id = $2`,
    [ownerId, deviceId],
  );
}
```

---

### Arquivo 2: `src/lib/device-alerts.ts`

```typescript
import { sendEmail } from "./email-service"; // seu serviço de email

/**
 * Envia alerta de novo dispositivo
 */
export async function sendNewDeviceAlert(
  ownerEmail: string,
  ownerName: string,
  deviceUserAgent: string,
  deviceIp: string,
): Promise<void> {
  const subject = "🔐 Novo dispositivo acessou sua conta MIAR";

  const htmlBody = `
    <h2>Olá ${ownerName},</h2>
    <p>Detectamos um novo dispositivo acessando sua conta MIAR.</p>

    <h3>Detalhes:</h3>
    <ul>
      <li><strong>Dispositivo:</strong> ${deviceUserAgent}</li>
      <li><strong>IP:</strong> ${deviceIp}</li>
      <li><strong>Hora:</strong> ${new Date().toLocaleString("pt-BR")}</li>
    </ul>

    <p>Se foi você, clique em "Confiar neste dispositivo" no painel de segurança.</p>
    <p>Se não foi você, altere sua senha imediatamente!</p>

    <a href="https://miar.com/settings/devices">Ver dispositivos</a>
  `;

  await sendEmail({
    to: ownerEmail,
    subject,
    html: htmlBody,
  });
}

/**
 * Envia alerta de revogação de dispositivo
 */
export async function sendDeviceRevokedAlert(
  ownerEmail: string,
  ownerName: string,
  deviceUserAgent: string,
): Promise<void> {
  const subject = "⚠️ Dispositivo removido da sua conta";

  const htmlBody = `
    <h2>Olá ${ownerName},</h2>
    <p>Um dispositivo foi removido da sua conta.</p>
    <p><strong>Dispositivo:</strong> ${deviceUserAgent}</p>
    <p>Se foi você, ignore este email.</p>
  `;

  await sendEmail({
    to: ownerEmail,
    subject,
    html: htmlBody,
  });
}
```

---

### Arquivo 3: `src/routes/devices.ts` (Novas rotas)

```typescript
import { Router, type Request, type Response } from "express";
import {
  trackLoginDevice,
  shouldSendDeviceAlert,
  markAlertSent,
  getOwnerDevices,
  trustDevice,
  revokeDevice,
} from "../lib/device-tracking";
import { sendNewDeviceAlert } from "../lib/device-alerts";
import { requireOwnerAuth } from "../middlewares/porteiro";
import { logger } from "../lib/logger";

const router = Router();

/**
 * GET /api/auth/devices
 * Listar todos os dispositivos do proprietário
 */
router.get("/devices", requireOwnerAuth(), async (req: Request, res: Response) => {
  try {
    const devices = await getOwnerDevices(req.owner.ownerId);
    res.json({ devices });
  } catch (err) {
    logger.error({ err }, "Error fetching devices");
    res.status(500).json({ error: "Erro ao buscar dispositivos" });
  }
});

/**
 * PUT /api/auth/devices/:id/trust
 * Marcar dispositivo como confiável
 */
router.put("/devices/:id/trust", requireOwnerAuth(), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { deviceName } = req.body as { deviceName?: string };

  try {
    await trustDevice(req.owner.ownerId, id, deviceName);
    res.json({ message: "Dispositivo marcado como confiável" });
  } catch (err) {
    logger.error({ err }, "Error trusting device");
    res.status(500).json({ error: "Erro ao confiar no dispositivo" });
  }
});

/**
 * DELETE /api/auth/devices/:id
 * Revogar dispositivo
 */
router.delete("/devices/:id", requireOwnerAuth(), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await revokeDevice(req.owner.ownerId, id);
    res.json({ message: "Dispositivo revogado com sucesso" });
  } catch (err) {
    logger.error({ err }, "Error revoking device");
    res.status(500).json({ error: "Erro ao revogar dispositivo" });
  }
});

export default router;
```

---

### Integração no `src/routes/auth.ts`

```typescript
// Na função de login, após validar senha:

const { isNewDevice, deviceId } = await trackLoginDevice(owner.id, req);

if (isNewDevice) {
  const shouldAlert = await shouldSendDeviceAlert(owner.id, deviceId);

  if (shouldAlert) {
    await sendNewDeviceAlert(
      owner.email,
      owner.name,
      req.headers["user-agent"] || "unknown",
      req.ip || "unknown",
    );
    await markAlertSent(owner.id, deviceId);
  }
}

// Continuar com JWT normal...
```

---

## 🎨 MUDANÇAS NO FRONTEND

### Gestor App — Painel de Segurança

```tsx
// artifacts/gestor/src/pages/Security.tsx

import { useEffect, useState } from "react";

export function SecurityPanel() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    fetch("/api/auth/devices")
      .then(r => r.json())
      .then(d => setDevices(d.devices));
  }, []);

  return (
    <div>
      <h1>Segurança</h1>
      <section>
        <h2>Dispositivos Autorizados</h2>
        <div>
          {devices.map(device => (
            <div key={device.id} style={{ border: "1px solid #ccc", padding: "10px" }}>
              <p><strong>{device.name}</strong></p>
              <p>{device.userAgent}</p>
              <p>IP: {device.ipAddress}</p>
              <p>Último acesso: {new Date(device.lastLoginAt).toLocaleString("pt-BR")}</p>

              <button onClick={() => trustDevice(device.id)}>
                {device.trustLevel === "trusted" ? "✓ Confiável" : "Confiar"}
              </button>

              <button onClick={() => revokeDevice(device.id)}>
                Remover
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Tabela `login_devices` já existe
- [ ] Implementar `src/lib/device-tracking.ts`
- [ ] Implementar `src/lib/device-alerts.ts`
- [ ] Criar rotas em `src/routes/devices.ts`
- [ ] Integrar tracking no login (auth.ts)
- [ ] Integrar alertas no login
- [ ] Criar painel de segurança no frontend
- [ ] Testes unitários
- [ ] E2E test para novo device → alerta
- [ ] Documentação de usuário
- [ ] Deploy em staging

---

## 🚀 FLUXO COMPLETO DE TESTE

```bash
# 1. Fazer login de um IP/dispositivo novo
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@restaurante.com","password":"Senha@12345"}'

# 2. Verificar que alerta foi enviado
# (Checar email ou logs)

# 3. Listar dispositivos
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/auth/devices

# 4. Marcar dispositivo como confiável
curl -X PUT -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/auth/devices/DEVICE_ID/trust \
  -H "Content-Type: application/json" \
  -d '{"deviceName":"iPhone de João"}'

# 5. Fazer login do mesmo dispositivo novamente
# (Nenhum alerta deve ser enviado desta vez)
```

---

## 📈 PRÓXIMAS FASES

1. **Fase 1** (Agora): Rastreamento básico + alertas por email
2. **Fase 2** (Later): Alertas via SMS também
3. **Fase 3** (Later): Notificação em push no app (Web Push)
4. **Fase 4** (Later): Geolocalização (alertar se IP está em país diferente)
5. **Fase 5** (Later): Machine Learning para detecção de anomalias

---

**Estimativa de Esforço**: 6-8 horas
**Prioridade**: 🟡 MÉDIA
**Recomendação**: Implementar após 2FA
