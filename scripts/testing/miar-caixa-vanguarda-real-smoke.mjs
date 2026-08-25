import { chromium } from 'playwright';
import fs from 'node:fs';

const statePath = '/tmp/miar-smoke-state.json';
const pin = String(380000 + Math.floor(Math.random() * 9999)).slice(0, 6);
const browser = await chromium.launch({ headless: true });
const ownerContext = await browser.newContext({ storageState: statePath });
const ownerPage = await ownerContext.newPage();
await ownerPage.goto('http://127.0.0.1:5173/gestor/onboarding/usuarios', { waitUntil: 'domcontentloaded' });
const create = await ownerPage.evaluate(async (pinValue) => {
  const token = localStorage.getItem('miar-owner-token') ?? '';
  const response = await fetch('/api/employees/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ employees: [{ name: 'Caixa Smoke Vanguarda', email: null, phone: null, pin: pinValue, role: 'caixa', permissions: [] }] }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, error: body?.error ?? null, count: Array.isArray(body?.employees) ? body.employees.length : undefined };
}, pin);
if (create.status !== 201 && create.status !== 200) {
  console.log(JSON.stringify({ step: 'create-cashier', ...create }));
  await browser.close();
  process.exit(1);
}
const login = await ownerPage.evaluate(async (pinValue) => {
  const response = await fetch('/api/auth/employee-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pinValue }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, token: body?.token ?? '', role: body?.employee?.role ?? body?.user?.role ?? null, name: body?.employee?.name ?? body?.user?.name ?? null };
}, pin);
if (login.status !== 200 || !login.token) {
  console.log(JSON.stringify({ step: 'employee-login', status: login.status, role: login.role, name: login.name }));
  await browser.close();
  process.exit(1);
}
const cashierContext = await browser.newContext();
const cashierPage = await cashierContext.newPage();
await cashierPage.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
await cashierPage.evaluate((token) => localStorage.setItem('miar-caixa-token', token), login.token);
await cashierPage.reload({ waitUntil: 'networkidle' });
await cashierPage.waitForTimeout(1000);
const realText = (await cashierPage.locator('body').innerText()).slice(0, 5000);
const hasRealMode = realText.includes('Dados reais');
const current = await cashierPage.evaluate(async () => {
  const token = localStorage.getItem('miar-caixa-token') ?? '';
  const response = await fetch('/api/cashier/session/current', { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, sessionStatus: body?.session?.status ?? null, summaryKeys: body?.summary ? Object.keys(body.summary) : [] };
});
let opened = null;
const openButton = cashierPage.getByRole('button', { name: 'ABRIR', exact: true });
if (await openButton.count()) {
  await openButton.click();
  const amount = cashierPage.locator('input[inputmode="decimal"]');
  await amount.fill('100');
  await cashierPage.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
  await cashierPage.waitForTimeout(800);
  opened = await cashierPage.evaluate(async () => {
    const token = localStorage.getItem('miar-caixa-token') ?? '';
    const response = await fetch('/api/cashier/session/current', { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, sessionStatus: body?.session?.status ?? null, movementCount: body?.summary?.movementCount ?? null };
  });
}
console.log(JSON.stringify({ create: { status: create.status, count: create.count }, login: { status: login.status, role: login.role, name: login.name }, hasRealMode, current, opened }));
await browser.close();
