import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { requireOwnerAuth } from "./auth";
import {
  employees, punchRecords, DEFAULT_PERMISSIONS,
  verifyEmployeePin, recordPunch,
  resolverLojaId, pertenceALoja,
  type Employee, type EmployeeRole,
} from "../lib/data-store";

const router: IRouter = Router();
// CORRIGIDO EM 29/07/2026: havia aqui um RESTAURANT_ID = "rest-1" fixo, mas
// sem uso — todas as rotas abaixo já pegavam o companyId certo do token
// (req.owner.companyId). Só sobrou a constante morta, removida.

// MULTI-LOJA (14/08/2026): loja opcional via header x-loja-id.
function getLojaId(req: any, companyId: string): string {
  const solicitado = (req.headers["x-loja-id"] as string) || undefined;
  return resolverLojaId(companyId, solicitado);
}

// GET /employees — funcionários da loja ativa
router.get("/employees", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const lojaId = getLojaId(req, companyId);
  res.json(employees.filter(e => e.restaurantId === companyId && pertenceALoja(e.lojaId, lojaId, companyId)));
});

// POST /employees — create
router.post("/employees", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const lojaId = getLojaId(req, companyId);
  const { name, role, pin, phone, permissions } = req.body as any;
  if (!name || !role) {
    res.status(400).json({ error: "name e role são obrigatórios" });
    return;
  }

  const normalizedPin = String(pin ?? "").trim();
  const finalPin = normalizedPin || `${Math.floor(1000 + Math.random() * 9000)}`;
  if (!/^\d{4,6}$/.test(finalPin)) {
    res.status(400).json({ error: "PIN deve ter 4 a 6 dígitos numéricos" });
    return;
  }
  // CORRIGIDO 30/07/2026: PIN salvo com hash bcrypt, nunca texto puro.
  const hashedPin = await bcrypt.hash(finalPin, 12);

  const emp: Employee = {
    id: randomUUID(),
    restaurantId: companyId,
    lojaId,
    name,
    role: role as EmployeeRole,
    pin: hashedPin,
    qrToken: `punch-qr-${randomUUID()}`,
    permissions: permissions ?? { ...DEFAULT_PERMISSIONS[role as EmployeeRole] ?? DEFAULT_PERMISSIONS.custom },
    active: true,
    phone: phone ?? undefined,
    createdAt: new Date().toISOString(),
  };
  employees.push(emp);
  res.status(201).json(emp);
});

// PATCH /employees/:id
router.patch("/employees/:id", requireOwnerAuth, async (req, res): Promise<void> => {
  const { companyId } = (req as any).owner;
  const { id } = req.params as { id: string };
  const idx = employees.findIndex(e => e.id === id && e.restaurantId === companyId);
  if (idx === -1) { res.status(404).json({ error: "Funcionário não encontrado" }); return; }
  const updates = req.body as Partial<Employee>;
  // CORRIGIDO 30/07/2026: se um novo PIN vier no corpo, salva com hash bcrypt.
  if (updates.pin) {
    if (!/^\d{4,6}$/.test(String(updates.pin))) {
      res.status(400).json({ error: "PIN deve ter 4 a 6 dígitos numéricos" });
      return;
    }
    updates.pin = await bcrypt.hash(String(updates.pin), 12);
  }
  employees[idx] = { ...employees[idx], ...updates };
  res.json(employees[idx]);
});

// DELETE /employees/:id
router.delete("/employees/:id", requireOwnerAuth, (req, res): void => {
  const { companyId } = (req as any).owner;
  const { id } = req.params as { id: string };
  const idx = employees.findIndex(e => e.id === id && e.restaurantId === companyId);
  if (idx === -1) { res.status(404).json({ error: "Funcionário não encontrado" }); return; }
  employees.splice(idx, 1);
  res.status(204).send();
});

// POST /employees/verify-pin — verify PIN and return employee (no sensitive data)
router.post("/employees/verify-pin", async (req, res): Promise<void> => {
  const { employeeId, pin } = req.body as { employeeId: string; pin: string };
  if (!employeeId || !pin) {
    res.status(400).json({ error: "employeeId e pin são obrigatórios" });
    return;
  }
  const emp = await verifyEmployeePin(employeeId, pin);
  if (!emp) {
    res.status(401).json({ error: "PIN incorreto" });
    return;
  }
  // Return without PIN
  const { pin: _pin, ...safe } = emp;
  res.json({ valid: true, employee: safe });
});

// POST /employees/punch — QR punch clock (body: { qrToken })
router.post("/employees/punch", (req, res): void => {
  const { qrToken } = req.body as { qrToken: string };
  if (!qrToken) { res.status(400).json({ error: "qrToken é obrigatório" }); return; }
  const result = recordPunch(qrToken);
  if (!result) { res.status(404).json({ error: "QR não reconhecido ou funcionário inativo" }); return; }
  const { pin: _pin, ...safeEmp } = result.employee;
  res.json({ record: result.record, employee: safeEmp });
});

// GET /employees/punch?token=xxx — QR link scan from phone camera
// Returns a simple HTML page so the employee can scan with any camera app.
router.get("/employees/punch", (req, res): void => {
  const token = (req.query as any).token as string | undefined;
  if (!token) {
    res.status(400).send('<h2>Token inválido</h2>');
    return;
  }
  const result = recordPunch(token);
  const html = result
    ? `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ponto MIAR</title><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff;text-align:center;gap:1rem}.badge{font-size:4rem}.name{font-size:1.5rem;font-weight:bold}.type{font-size:1rem;padding:.4rem 1.2rem;border-radius:999px;font-weight:bold;margin-top:.5rem}.in{background:#16a34a;color:#fff}.out{background:#6b7280;color:#fff}.time{font-size:.9rem;color:#aaa;margin-top:.25rem}</style></head><body><div class="badge">${result.record.type === 'in' ? '✅' : '🔚'}</div><div class="name">${result.employee.name}</div><div class="type ${result.record.type}">${result.record.type === 'in' ? 'Entrada registrada' : 'Saída registrada'}</div><div class="time">${new Date(result.record.timestamp).toLocaleString('pt-BR')}</div></body></html>`
    : `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ponto MIAR</title><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff;text-align:center;gap:1rem}.badge{font-size:4rem}</style></head><body><div class="badge">❌</div><h2>QR não reconhecido</h2><p style="color:#aaa">Verifique se o cartão está ativo.</p></body></html>`;
  res.send(html);
});

// GET /employees/:id/punches — punch history
router.get("/employees/:id/punches", (req, res): void => {
  const { id } = req.params as { id: string };
  const records = punchRecords
    .filter(p => p.employeeId === id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 50);
  res.json(records);
});

// GET /employees/punches/today — all punches today
router.get("/employees/punches/today", (_req, res): void => {
  const today = new Date().toDateString();
  const records = punchRecords
    .filter(p => new Date(p.timestamp).toDateString() === today)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json(records);
});

export default router;
