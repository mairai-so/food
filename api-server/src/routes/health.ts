import { Router, type IRouter } from "express";
import { getHeapStatistics } from "node:v8";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /api/health — Health Check Completo (Etapa 3)
 * Retorna status da API, database, memory, etc
 * Usado por monitoring, load balancers, Kubernetes
 */
router.get("/healthz", async (_req, res) => {
  const startTime = Date.now();
  let overallStatus: "ok" | "degraded" | "error" = "ok";
  const issues: string[] = [];

  // 1. Database Check
  let dbStatus: "ok" | "slow" | "error" = "ok";
  let dbTime = 0;
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    dbTime = Date.now() - dbStart;
    if (dbTime > 500) {
      dbStatus = "slow";
      overallStatus = "degraded";
      issues.push(`Database slow (${dbTime}ms)`);
    }
  } catch (err) {
    dbStatus = "error";
    overallStatus = "error";
    issues.push(
      `Database error: ${err instanceof Error ? err.message : String(err)}`,
    );
    logger.error({ err }, "Health check database error");
  }

  // 2. Memory Check
  const memUsage = process.memoryUsage();
  const heapLimit = getHeapStatistics().heap_size_limit;
  const heapPercent = heapLimit > 0 ? (memUsage.heapUsed / heapLimit) * 100 : 0;
  if (heapPercent > 90) {
    overallStatus = "degraded";
    issues.push(`Memory high (${Math.round(heapPercent)}% of V8 limit)`);
  }

  // 3. JWT_SECRET Check
  const jwtOk = process.env.NODE_ENV !== "production" || !!process.env.JWT_SECRET;
  if (!jwtOk) {
    overallStatus = "error";
    issues.push("JWT_SECRET not configured in production");
  }

  // 4. Response Time
  const responseTime = Date.now() - startTime;
  if (responseTime > 1000) {
    overallStatus = "degraded";
    issues.push(`Health check slow (${responseTime}ms)`);
  }

  const data = {
    status: overallStatus,
    database: dbStatus,
    memoryPercent: Math.round(heapPercent),
    responseTimeMs: responseTime,
    uptime: Math.floor(process.uptime()),
    issues: issues.length > 0 ? issues : undefined,
  };

  const httpStatus = overallStatus === "ok" ? 200 : 503;
  res.status(httpStatus).json(data);
});

export default router;
