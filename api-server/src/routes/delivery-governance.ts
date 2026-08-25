import { Router, type IRouter } from "express";
import { createDeliveryGovernanceIncident, getDeliveryGovernanceConfig, updateDeliveryGovernanceConfig, listDeliveryGovernanceProfiles, upsertDeliveryGovernanceProfile, employees } from "../lib/data-store.js";
import { requireOwnerAuth, requireAnyAuth } from "./auth.js";

const router: IRouter = Router();

// POST /delivery-governance/reputacao-externa — o próprio entregador informa
// que já tem histórico em outro app de entrega. AUTODECLARADO, não verificado
// pelo MIAR (não existe integração real com plataformas externas) — serve só
// como contexto pro gestor, nunca é somado ao penaltyStatus real do sistema.
router.post("/delivery-governance/reputacao-externa", requireAnyAuth, (req, res): void => {
  const auth = (req as any).auth as { companyId: string; employeeId?: string; isEmployee?: boolean };
  if (!auth.isEmployee || !auth.employeeId) {
    res.status(403).json({ error: "Só entregadores cadastrados podem informar isso" });
    return;
  }
  const employee = employees.find((e) => e.id === auth.employeeId && e.restaurantId === auth.companyId);
  if (!employee) {
    res.status(404).json({ error: "Funcionário não encontrado" });
    return;
  }
  if (employee.role !== "delivery") {
    res.status(400).json({ error: "Essa informação é só pro cargo de entregador" });
    return;
  }

  const { plataforma, notaAutoDeclarada, observacao } = req.body as {
    plataforma?: string;
    notaAutoDeclarada?: number;
    observacao?: string;
  };
  if (!plataforma?.trim()) {
    res.status(400).json({ error: "plataforma é obrigatória (ex: iFood, Rappi, 99Food)" });
    return;
  }

  employee.reputacaoExterna = {
    plataforma: plataforma.trim().slice(0, 60),
    notaAutoDeclarada:
      typeof notaAutoDeclarada === "number" && notaAutoDeclarada >= 0 && notaAutoDeclarada <= 5
        ? notaAutoDeclarada
        : undefined,
    observacao: observacao?.trim().slice(0, 300),
    autoDeclarado: true,
    declaradoEm: new Date().toISOString(),
  };

  res.status(201).json({
    ok: true,
    reputacaoExterna: employee.reputacaoExterna,
    aviso: "Informação autodeclarada pelo entregador — o MIAR não verifica isso com a plataforma de origem.",
  });
});

router.post("/delivery-governance/incidents", requireOwnerAuth, (req, res) => {
  const { companyId } = (req as any).owner;
  const body = req.body as {
    employeeId: string;
    employeeName?: string;
    reason: string;
    notes?: string;
    severity?: "info" | "warning" | "critical";
  };

  if (!body?.employeeId?.trim() || !body?.reason?.trim()) {
    res.status(400).json({ error: "employeeId e reason são obrigatórios" });
    return;
  }

  // CORRIGIDO (15/08/2026): não checava se o employeeId pertencia ao
  // restaurante de quem estava criando o incidente — qualquer dono podia
  // abrir ocorrência (e derrubar penalidade/suspensão) contra um
  // entregador de OUTRO restaurante, só sabendo o ID dele.
  const employee = employees.find((e) => e.id === body.employeeId.trim() && e.restaurantId === companyId);
  if (!employee) {
    res.status(404).json({ error: "Funcionário não encontrado no seu restaurante" });
    return;
  }

  const incident = createDeliveryGovernanceIncident({
    employeeId: employee.id,
    employeeName: body.employeeName?.trim() ?? employee.name ?? "Entregador",
    reason: body.reason.trim(),
    notes: body.notes?.trim(),
    severity: body.severity ?? "warning",
    createdBy: companyId,
    status: "warning",
    penaltyLevel: 1,
  });

  const profile = upsertDeliveryGovernanceProfile(companyId, incident.employeeId, incident.employeeName, incident);
  res.status(201).json({ incident, profile, config: getDeliveryGovernanceConfig(companyId) });
});

router.get("/delivery-governance/profiles", requireOwnerAuth, (req, res) => {
  const { companyId } = (req as any).owner;
  res.json(listDeliveryGovernanceProfiles(companyId));
});

router.get("/delivery-governance/config", requireOwnerAuth, (req, res) => {
  const { companyId } = (req as any).owner;
  res.json(getDeliveryGovernanceConfig(companyId));
});

router.patch("/delivery-governance/config", requireOwnerAuth, (req, res) => {
  const { companyId } = (req as any).owner;
  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "Configuração inválida" });
    return;
  }

  const configAtual = getDeliveryGovernanceConfig(companyId);
  const updates: Partial<typeof configAtual> = {};
  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      res.status(400).json({ error: "active deve ser booleano" });
      return;
    }
    updates.active = body.active;
  }
  for (const field of ["warningThreshold", "suspensionThreshold", "banThreshold", "suspensionDays"] as const) {
    if (!(field in body)) continue;
    const value = body[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      res.status(400).json({ error: `${field} deve ser um número não negativo` });
      return;
    }
    updates[field] = value;
  }
  if ("requireAudit" in body) {
    if (typeof body.requireAudit !== "boolean") {
      res.status(400).json({ error: "requireAudit deve ser booleano" });
      return;
    }
    updates.requireAudit = body.requireAudit;
  }

  const warningThreshold = updates.warningThreshold ?? configAtual.warningThreshold;
  const suspensionThreshold = updates.suspensionThreshold ?? configAtual.suspensionThreshold;
  const banThreshold = updates.banThreshold ?? configAtual.banThreshold;
  if (warningThreshold > suspensionThreshold) {
    res.status(400).json({ error: "warningThreshold não pode superar suspensionThreshold" });
    return;
  }
  if (suspensionThreshold > banThreshold) {
    res.status(400).json({ error: "suspensionThreshold não pode superar banThreshold" });
    return;
  }

  const novo = updateDeliveryGovernanceConfig(companyId, updates);
  res.json(novo);
});

export default router;
