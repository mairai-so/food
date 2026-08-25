import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { auditLogs, type AuditLog } from "../lib/data-store";
import { requireOwnerAuth } from "./auth";

const router: IRouter = Router();

// CORRIGIDO EM 29/07/2026: a Caixa Preta (log de auditoria) usava um
// RESTAURANT_ID = "rest-1" fixo — ou seja, TODOS os restaurantes cadastrados
// estavam vendo e escrevendo no mesmo log de auditoria. Isso é especialmente
// grave aqui porque a Caixa Preta é justamente o registro de segurança do
// documento-mestre ("quem abriu mesa, quem alterou pedido, quem acessou
// função fora do horário") — com o bug, o dono de um restaurante conseguiria
// ver as ações do dono de outro restaurante.

// GET /audit — recent activity log (newest first)
router.get("/audit", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const limit = Number((req.query as any).limit) || 100;
  const logs = auditLogs
    .filter(l => l.restaurantId === companyId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
  res.json(logs);
});

// POST /audit — record an action
router.post("/audit", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const { employeeId, employeeName, employeeRole, action, description, metadata } =
    req.body as Partial<AuditLog>;

  if (!employeeId || !employeeName || !action || !description) {
    res.status(400).json({ error: "employeeId, employeeName, action e description são obrigatórios" });
    return;
  }

  const log: AuditLog = {
    id: randomUUID(),
    restaurantId: companyId,
    employeeId: employeeId!,
    employeeName: employeeName!,
    employeeRole: employeeRole ?? "unknown",
    action: action!,
    description: description!,
    metadata: metadata ?? undefined,
    timestamp: new Date().toISOString(),
  };
  auditLogs.push(log);
  // Keep last 500
  if (auditLogs.length > 500) auditLogs.splice(0, auditLogs.length - 500);
  res.status(201).json(log);
});

export default router;
