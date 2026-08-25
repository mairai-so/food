// api-server/src/routes/setup.ts
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { requireOwnerAuth } from "./auth";
import {
  employees,
  DEFAULT_PERMISSIONS,
  estabelecimentoConfigs,
  setEstabelecimentoConfig,
  type Employee,
  type EmployeeRole,
  type EmployeePermissions,
} from "../lib/data-store";
import { buildInitialSetupBlueprint } from "../lib/onboarding-setup";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Permissões granulares vindas da tela de cadastro de usuários
// ─────────────────────────────────────────────────────────────────────────────

// Mapa: recurso granular da UI -> flags do EmployeePermissions existente
const RECURSO_PARA_FLAGS: Record<string, Array<keyof EmployeePermissions>> = {
  orders: ["viewTables"],
  tables: ["viewTables"],
  "waiter-calls": ["viewTables"],
  "order-history": ["viewTables"],
  complaints: ["viewTables"],
  kitchen: ["viewKitchen"],
  "operational-workflow": ["viewKitchen"],
  "food-analysis": ["viewKitchen"],
  nutri: ["viewKitchen"],
  "cashier-session": ["viewCashier", "closeCashier"],
  analytics: ["viewReports"],
  dashboard: ["viewReports"],
  stock: ["viewStock", "editStock"],
  barcode: ["viewStock", "editStock"],
  vision: ["viewCameras"],
  "delivery-governance": ["viewTables"],
  "delivery-observations": ["viewTables"],
  employees: ["viewEmployees", "manageEmployees"],
  marketing: ["viewReports"],
  audit: ["viewReports"],
  settings: ["viewSettings", "manageSettings"],
  restaurants: ["viewSettings"],
  backup: ["viewSettings", "manageSettings"],
  lgpd: ["viewSettings"],
  chat: ["useMiaChat"], // CORRIGIDO 29/07/2026: antes era [] (não fazia nada de verdade)
  "miar-edita": ["useMiarEdita"],
  "chat-history": [],
  onboarding: ["viewSettings"],
};

const PERFIL_PARA_ROLE: Record<string, EmployeeRole> = {
  garcom: "waiter",
  cozinha: "cook",
  caixa: "cashier",
  entregador: "delivery",
  gerente: "manager",
  total: "owner",
  personalizado: "custom",
};

function montarPermissoes(recursos: string[]): EmployeePermissions {
  const base: EmployeePermissions = { ...DEFAULT_PERMISSIONS.custom };
  for (const recurso of recursos) {
    for (const flag of RECURSO_PARA_FLAGS[recurso] ?? []) {
      base[flag] = true;
    }
  }
  return base;
}

// Guarda a lista granular sem perder informação, indexada por employeeId
export const granularPermissions = new Map<string, string[]>();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employees/bulk — cria a equipe inteira de uma vez
// ─────────────────────────────────────────────────────────────────────────────
router.post("/employees/bulk", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const lista = (req.body as any)?.employees;

  if (!Array.isArray(lista) || lista.length === 0) {
    res.status(400).json({ error: "Envie ao menos um usuário." });
    return;
  }

  const criados: Employee[] = [];
  const erros: Array<{ index: number; error: string }> = [];

  for (let index = 0; index < lista.length; index++) {
    const entrada = lista[index];
    const nome = String(entrada?.name ?? "").trim();
    if (!nome) {
      erros.push({ index, error: "Nome é obrigatório." });
      continue;
    }

    const pinInformado = String(entrada?.pin ?? "").trim();
    const pin = pinInformado || `${Math.floor(1000 + Math.random() * 9000)}`;
    if (!/^\d{4,6}$/.test(pin)) {
      erros.push({ index, error: "PIN deve ter 4 a 6 dígitos." });
      continue;
    }

    // CORRIGIDO 30/07/2026: PIN agora é hash — não dá pra comparar direto
    // (e.pin === pin). Checa duplicata comparando contra cada hash existente.
    const existentesDaEmpresa = employees.filter((e) => e.restaurantId === companyId);
    let duplicado = false;
    for (const existente of existentesDaEmpresa) {
      if (await bcrypt.compare(pin, existente.pin)) { duplicado = true; break; }
    }
    if (duplicado) {
      erros.push({ index, error: `PIN ${pin} já está em uso.` });
      continue;
    }

    const recursos: string[] = Array.isArray(entrada?.permissions)
      ? entrada.permissions
      : [];
    const role = PERFIL_PARA_ROLE[String(entrada?.role ?? "")] ?? "custom";

    const hashedPin = await bcrypt.hash(pin, 12);
    const emp: Employee = {
      id: randomUUID(),
      restaurantId: companyId,
      name: nome,
      role,
      pin: hashedPin,
      qrToken: `punch-qr-${randomUUID()}`,
      permissions: montarPermissoes(recursos),
      active: true,
      phone: entrada?.phone ?? undefined,
      createdAt: new Date().toISOString(),
    };

    employees.push(emp);
    granularPermissions.set(emp.id, recursos);
    criados.push(emp);
  }

  if (criados.length === 0) {
    res.status(400).json({ error: erros[0]?.error ?? "Nada foi criado.", erros });
    return;
  }

  res.status(201).json({ created: criados.length, employees: criados, erros });
});

// ─────────────────────────────────────────────────────────────────────────────
// Configuração do estabelecimento
// ─────────────────────────────────────────────────────────────────────────────
// Tipos locais removidos para evitar conflito com as importações de data-store.

// POST /api/onboarding/estabelecimento
router.post("/onboarding/estabelecimento", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const { segmentId, businessModel, modules, features, items } = (req.body as any) ?? {};

  if (!segmentId) {
    res.status(400).json({ error: "segmentId é obrigatório." });
    return;
  }

  const blueprint = buildInitialSetupBlueprint({
    segmentId: String(segmentId),
    businessModel: businessModel ? String(businessModel) : undefined,
    modules: Array.isArray(modules) ? modules : undefined,
    features: Array.isArray(features) ? features : undefined,
  });

  const config = {
    restaurantId: companyId,
    segmentId: blueprint.segmentId,
    features: blueprint.features,
    items: Array.isArray(items)
      ? items.map((i: any) => ({
          category: String(i?.category ?? "Geral"),
          name: String(i?.name ?? ""),
          price:
            i?.price === undefined || i?.price === null || Number.isNaN(Number(i.price))
              ? null
              : Number(i.price),
        }))
      : [],
    updatedAt: new Date().toISOString(),
  };

  setEstabelecimentoConfig(companyId, config);

  res.status(201).json({
    saved: true,
    segmentId: config.segmentId,
    businessModel: blueprint.businessModel,
    modules: blueprint.modules,
    summary: blueprint.summary,
    features: config.features.length,
    items: config.items.length,
  });
});

// GET /api/onboarding/estabelecimento
router.get("/onboarding/estabelecimento", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const config = estabelecimentoConfigs.get(companyId);
  if (!config) {
    res.json({ configured: false });
    return;
  }
  res.json({ configured: true, ...config });
});

export default router;
