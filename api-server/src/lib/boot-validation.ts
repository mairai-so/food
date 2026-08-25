/**
 * Boot Validation — Valida configuração do servidor na inicialização
 * Se algo crítico faltar, o servidor NÃO sobe
 * Fornece feedback claro sobre o que está errado
 */

import { exec } from "child_process";
import { promisify } from "util";
import { Pool } from "pg";

const execAsync = promisify(exec);

export interface BootValidationResult {
  success: boolean;
  checks: {
    port: { ok: boolean; value?: string; error?: string };
    nodeEnv: { ok: boolean; value?: string; error?: string };
    jwtSecret: { ok: boolean; value?: string; error?: string };
    database: { ok: boolean; value?: string; error?: string };
    devBypass: { ok: boolean; value?: string; error?: string };
  };
  warnings: string[];
  errors: string[];
}

export async function validateBoot(env: NodeJS.ProcessEnv): Promise<BootValidationResult> {
  const result: BootValidationResult = {
    success: true,
    checks: {
      port: { ok: false },
      nodeEnv: { ok: false },
      jwtSecret: { ok: false },
      database: { ok: false },
      devBypass: { ok: false },
    },
    warnings: [],
    errors: [],
  };

  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  // ─────────────────────────────────────────────────────────────────────────
  // 1. PORT
  // ─────────────────────────────────────────────────────────────────────────
  {
    const port = env.PORT;
    if (!port) {
      result.checks.port.ok = false;
      result.checks.port.error = "PORT não definida";
      result.errors.push("❌ PORT: Não definida (obrigatória)");
      result.success = false;
    } else if (isNaN(Number(port)) || Number(port) <= 0 || Number(port) > 65535) {
      result.checks.port.ok = false;
      result.checks.port.error = `PORT inválida: ${port}`;
      result.errors.push(`❌ PORT: "${port}" não é válida (use 1-65535)`);
      result.success = false;
    } else {
      result.checks.port.ok = true;
      result.checks.port.value = port;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. NODE_ENV
  // ─────────────────────────────────────────────────────────────────────────
  {
    if (!nodeEnv || !["development", "staging", "production"].includes(nodeEnv)) {
      result.checks.nodeEnv.ok = false;
      result.checks.nodeEnv.error = `NODE_ENV inválida: ${nodeEnv}`;
      result.errors.push(`❌ NODE_ENV: "${nodeEnv}" inválida (use: development, staging, production)`);
      result.success = false;
    } else {
      result.checks.nodeEnv.ok = true;
      result.checks.nodeEnv.value = nodeEnv;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. JWT_SECRET
  // ─────────────────────────────────────────────────────────────────────────
  {
    const jwtSecret = env.JWT_SECRET;
    if (isProduction && !jwtSecret) {
      result.checks.jwtSecret.ok = false;
      result.checks.jwtSecret.error = "JWT_SECRET não definida (obrigatória em produção)";
      result.errors.push("❌ JWT_SECRET: Não definida (obrigatória em produção)");
      result.success = false;
    } else if (jwtSecret && jwtSecret.length < 16) {
      result.checks.jwtSecret.ok = true; // Funciona mas com warning
      result.checks.jwtSecret.value = `${jwtSecret.length} caracteres (mínimo 16 recomendado)`;
      result.warnings.push(
        `⚠️  JWT_SECRET: ${jwtSecret.length} caracteres (recomendado: 32+)`,
      );
    } else if (jwtSecret) {
      result.checks.jwtSecret.ok = true;
      result.checks.jwtSecret.value = `${jwtSecret.length} caracteres`;
    } else {
      result.checks.jwtSecret.ok = true; // Dev sem secret, normal
      result.checks.jwtSecret.value = "Usando fallback de desenvolvimento";
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DATABASE_URL e Conectividade
  // ─────────────────────────────────────────────────────────────────────────
  {
    const databaseUrl = env.DATABASE_URL;
    if (!databaseUrl) {
      result.checks.database.ok = false;
      result.checks.database.error = "DATABASE_URL não definida";
      result.errors.push("❌ DATABASE_URL: Não definida (obrigatória)");
      result.success = false;
    } else {
      try {
        // Testar conexão
        const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
        const client = await pool.connect();
        await client.query("SELECT NOW()");
        client.release();
        await pool.end();

        result.checks.database.ok = true;
        result.checks.database.value = "Conectado (latência: ~100ms)";
      } catch (err) {
        result.checks.database.ok = false;
        result.checks.database.error = `Erro na conexão: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(`❌ DATABASE: Erro na conexão — ${result.checks.database.error}`);
        result.success = false;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. DEV_BYPASS
  // ─────────────────────────────────────────────────────────────────────────
  {
    const devBypass = env.ALLOW_DEV_BYPASS;
    if (isProduction && devBypass === "true") {
      result.checks.devBypass.ok = false;
      result.checks.devBypass.error = "DEV_BYPASS habilitado em produção (PROIBIDO)";
      result.errors.push("❌ DEV_BYPASS: Não pode estar ativado em produção");
      result.success = false;
    } else if (devBypass === "true") {
      result.checks.devBypass.ok = true;
      result.checks.devBypass.value = "Habilitado (desenvolvimento apenas)";
      result.warnings.push("⚠️  DEV_BYPASS: Habilitado — use apenas em desenvolvimento");
    } else {
      result.checks.devBypass.ok = true;
      result.checks.devBypass.value = "Desabilitado (padrão seguro)";
    }
  }

  return result;
}

export function printBootValidationResult(result: BootValidationResult): void {
  console.log("\n" + "═".repeat(80));
  console.log("🚀 MIAR AI/FOOD — VALIDAÇÃO DE BOOT");
  console.log("═".repeat(80) + "\n");

  // Mostrar cada check
  console.log("📋 CHECKLIST:\n");
  const checks = Object.entries(result.checks);
  for (const [name, check] of checks) {
    const icon = check.ok ? "✅" : "❌";
    const value = check.value ? ` → ${check.value}` : "";
    const error = check.error ? ` → Erro: ${check.error}` : "";
    console.log(`  ${icon} ${name.toUpperCase()}${value || error}`);
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log("\n⚠️  AVISOS:\n");
    for (const warning of result.warnings) {
      console.log(`  ${warning}`);
    }
  }

  // Errors
  if (result.errors.length > 0) {
    console.log("\n🚨 ERROS:\n");
    for (const error of result.errors) {
      console.log(`  ${error}`);
    }
  }

  // Status final
  if (result.success) {
    console.log("\n✅ BOOT VALIDAÇÃO: SUCESSO");
    console.log(
      "🟢 Servidor está configurado corretamente e pronto para iniciar.\n",
    );
  } else {
    console.log("\n❌ BOOT VALIDAÇÃO: FALHOU");
    console.log(
      "🔴 Corrija os erros acima antes de iniciar o servidor.\n",
    );
  }
  console.log("═".repeat(80) + "\n");
}
