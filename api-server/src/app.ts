import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import nutriRouter from "./routes/nutri";
import { logger } from "./lib/logger";
import { startAutoBackup } from "./routes/backup";
import { generalLimiter } from "./lib/rate-limiter";
import { enforceSecureTransport } from "./lib/security-config";
import { registerClient } from "./lib/sse";
import { saveAllStoreData, loadStoreData } from "./lib/data-store";
import { execute } from "./lib/db";
import { initializeRegistroProtegido } from "./routes/registro-protegido";
import { initPasskeyTable } from "./routes/passkeys";

const app: Express = express();

// Proxy reverso — necessário para o rate-limiter funcionar corretamente
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req: Request, res: Response, next: NextFunction) => {
  enforceSecureTransport(req, res, next, process.env);
});
app.use(generalLimiter);

// Intercept every response: after a mutating method, schedule a persistence save.
app.use((_req: Request, res: Response, next: NextFunction) => {
  const original = res.json.bind(res);
  res.json = (body) => {
    const method = _req.method?.toUpperCase();
    if (method && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      saveAllStoreData().catch((err) =>
        logger.error({ err }, "post-request persist failed"),
      );
    }
    return original(body);
  };
  next();
});

// SSE endpoint — clients subscribe here for real-time push events
app.get("/api/events", (req: Request, res: Response) => {
  registerClient(req, res);
});

app.use("/api", router);
app.use("/api", nutriRouter);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  logger.error({ err, method: req.method, url: req.url }, "Unhandled API error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Erro interno do servidor. Tente novamente." });
});

startAutoBackup();

// ─── Inicializar tabelas de autenticação ────────────────────────────────────

async function initAuthTables(): Promise<void> {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        cnpj         TEXT,
        email        TEXT NOT NULL UNIQUE,
        phone        TEXT,
        address      TEXT,
        owner_name   TEXT NOT NULL,
        logo_url     TEXT,
        active       BOOLEAN DEFAULT TRUE NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Compatibilidade com bancos criados antes dos campos opcionais da
    // empresa. CREATE TABLE IF NOT EXISTS não altera uma tabela existente.
    await execute(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS razao_social TEXT,
        ADD COLUMN IF NOT EXISTS logo_url TEXT
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS owner_accounts (
        id            TEXT PRIMARY KEY,
        company_id    TEXT NOT NULL REFERENCES companies(id),
        email         TEXT NOT NULL UNIQUE,
        phone         TEXT,
        password_hash TEXT NOT NULL,
        name          TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await execute("ALTER TABLE owner_accounts ADD COLUMN IF NOT EXISTS phone TEXT");

    await execute(`
      CREATE TABLE IF NOT EXISTS password_recovery_codes (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL REFERENCES owner_accounts(id),
        code_hash   TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        used        BOOLEAN DEFAULT FALSE NOT NULL,
        used_at     TIMESTAMPTZ,
        reset_at    TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await execute("ALTER TABLE password_recovery_codes ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ");

    // Dispositivos conhecidos por conta de dono (15/08/2026) — parte da
    // "Verificação de Segurança": quando o login acontece de um device_id
    // que nunca foi visto pra essa conta, é sinalizado como acesso novo
    // (não bloqueia, apenas registra e permite avisar o dono depois).
    await execute(`
      CREATE TABLE IF NOT EXISTS login_devices (
        id            TEXT PRIMARY KEY,
        owner_id      TEXT NOT NULL REFERENCES owner_accounts(id),
        device_id     TEXT NOT NULL,
        user_agent    TEXT,
        first_seen_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(owner_id, device_id)
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS employee_tokens (
        id           TEXT PRIMARY KEY,
        company_id   TEXT NOT NULL REFERENCES companies(id),
        employee_id  TEXT NOT NULL,
        token        TEXT NOT NULL UNIQUE,
        role         TEXT NOT NULL,
        active       BOOLEAN DEFAULT TRUE NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS store_snapshots (
        key        TEXT PRIMARY KEY,
        data       JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS restaurant_registrations (
        id                   TEXT PRIMARY KEY,
        name                 TEXT NOT NULL,
        cnpj                 TEXT,
        email                TEXT NOT NULL,
        phone                TEXT,
        address              TEXT,
        cuisine              TEXT,
        owner_name           TEXT,
        declared_prep_time   INTEGER DEFAULT 20,
        avg_actual_prep_time NUMERIC,
        consecutive_failures INTEGER DEFAULT 0,
        performance_score    NUMERIC DEFAULT 5.0,
        status               TEXT DEFAULT 'pendente',
        rejection_reason     TEXT,
        created_at           TIMESTAMPTZ DEFAULT NOW(),
        updated_at           TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS phone_otp_codes (
        id          TEXT PRIMARY KEY,
        phone       TEXT NOT NULL,
        code        TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        used        BOOLEAN DEFAULT FALSE NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS phone_users (
        id          TEXT PRIMARY KEY,
        phone       TEXT NOT NULL UNIQUE,
        name        TEXT,
        role        TEXT NOT NULL DEFAULT 'client',
        company_id  TEXT,
        active      BOOLEAN DEFAULT TRUE NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS pending_owner_registrations (
        id            TEXT PRIMARY KEY,
        phone         TEXT NOT NULL,
        code          TEXT NOT NULL,
        company_name  TEXT NOT NULL,
        cnpj          TEXT,
        email         TEXT NOT NULL,
        address       TEXT,
        owner_name    TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        expires_at    TIMESTAMPTZ NOT NULL,
        used          BOOLEAN DEFAULT FALSE NOT NULL,
        used_at       TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await execute(`
      ALTER TABLE pending_owner_registrations
      ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ
    `);

    logger.info("Auth tables initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize auth tables");
    throw err;
  }
}

async function initFeedTables(): Promise<void> {
  try {
    const { initFeedModerationTables } = await import("./routes/restaurants.js");
    await initFeedModerationTables();
    logger.info("Feed moderation tables initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize feed moderation tables");
  }
}

async function initClientTables(): Promise<void> {
  try {
    const { initClientAccountsTable } = await import("./routes/client-auth.js");
    await initClientAccountsTable();
    logger.info("Client accounts table initialized");
  } catch (err) {
    logger.error({ err }, "Failed to initialize client accounts table");
  }
}

async function initializeDatabase(): Promise<void> {
  // As tabelas de autenticação também incluem store_snapshots. Aguarde a
  // criação delas antes de restaurar o estado, evitando consultas em uma
  // tabela que ainda não existe durante o boot.
  await initAuthTables();
  await initClientTables();
  await initPasskeyTable();
  await initFeedTables();
  await initializeRegistroProtegido();

  // Recarrega os dados salvos no banco para a memória ao iniciar o servidor.
  // Sem isso, os dados eram salvos a cada alteração mas nunca recuperados —
  // um reinício do servidor voltava tudo para o estado inicial vazio.
  await loadStoreData();
  logger.info("Dados restaurados do banco de dados");
}

export const databaseReady = initializeDatabase().catch((err) => {
  logger.error({ err }, "Falha ao inicializar banco de dados");
  throw err;
});

export default app;
