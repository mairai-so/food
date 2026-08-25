import app, { databaseReady } from "./app";
import { logger } from "./lib/logger";
import { getSecurityWarnings } from "./lib/security-config.js";
import { startRelatorioScheduler } from "./lib/relatorio-scheduler.js";
import { flushPendingSaves } from "./lib/persistence.js";
import { validateBoot, printBootValidationResult } from "./lib/boot-validation.js";

const nodeEnv = process.env.NODE_ENV ?? "development";
const rawPort = process.env["PORT"];
const jwtSecret = process.env.JWT_SECRET;

// ─── Boot Validation (Etapa 2) ──────────────────────────────────────────────
// Executar validação ao iniciar o servidor
async function runBootValidation(): Promise<void> {
  const result = await validateBoot(process.env);
  printBootValidationResult(result);
  if (!result.success) {
    process.exit(1);
  }
}

// Executar validação antes de tudo
await runBootValidation();

// ─── Validations ────────────────────────────────────────────────────────────
if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT_SECRET: OBRIGATÓRIO em produção. NUNCA usar fallback em produção.
// ─────────────────────────────────────────────────────────────────────────────
function validateJwtSecret(): void {
  const isProduction = nodeEnv === 'production';

  if (isProduction && !jwtSecret) {
    const msg = `
╔════════════════════════════════════════════════════════════════════════════╗
║ 🚨 ERRO CRÍTICO DE SEGURANÇA — JWT_SECRET NÃO CONFIGURADO                 ║
║                                                                            ║
║ Em produção, JWT_SECRET é OBRIGATÓRIO e não pode ter fallback.            ║
║ Tokens JWT não assinados corretamente = segurança completamente            ║
║ comprometida. Qualquer pessoa pode falsificar tokens e acessar como        ║
║ qualquer usuário.                                                          ║
║                                                                            ║
║ ❌ AÇÃO IMEDIATA NECESSÁRIA:                                              ║
║   1. Gere uma chave segura (mín 32 caracteres aleatórios)                  ║
║   2. Configure JWT_SECRET no .env de produção                              ║
║   3. Reinicie o servidor                                                   ║
║                                                                            ║
║ Exemplo de geração segura:                                                 ║
║   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" ║
║                                                                            ║
║ ⚠️ NÃO use a mesma chave de desenvolvimento em produção.                   ║
╚════════════════════════════════════════════════════════════════════════════╝
    `;
    throw new Error(msg);
  }

  if (isProduction && jwtSecret && jwtSecret.length < 16) {
    const msg = `
╔════════════════════════════════════════════════════════════════════════════╗
║ ⚠️ AVISO: JWT_SECRET muito fraco em produção                              ║
║                                                                            ║
║ JWT_SECRET em produção deve ter no mínimo 16 caracteres.                   ║
║ Chave actual: ${jwtSecret.length} caracteres                                       ║
║                                                                            ║
║ Recomendação: use no mínimo 32 caracteres aleatórios.                       ║
╚════════════════════════════════════════════════════════════════════════════╝
    `;
    logger.warn(msg);
  }
}

validateJwtSecret();

const securityWarnings = getSecurityWarnings(process.env);
if (securityWarnings.length > 0) {
  logger.warn({ warnings: securityWarnings }, "Security warnings active");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await databaseReady;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startRelatorioScheduler();
});

// Desligamento gracioso: um redeploy, restart de plataforma (Replit/Render)
// ou "docker stop" manda SIGTERM antes de matar o processo. Sem isso, uma
// escrita que ainda estava dentro da janela de 300ms do debounce (ver
// persistence.ts) se perdia — o dado nunca chegava a ser gravado no banco.
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Encerrando: salvando dados pendentes antes de sair");
  try {
    await flushPendingSaves();
    logger.info("Dados pendentes salvos com sucesso");
  } catch (err) {
    logger.error({ err }, "Falha ao salvar dados pendentes no encerramento");
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
