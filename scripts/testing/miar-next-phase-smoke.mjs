const base = 'http://127.0.0.1:8080/api';
const stamp = Date.now();
const pinA = String(1000 + (stamp % 8000));
const pinB = String(1000 + ((stamp + 1) % 8000));
const fictitious = {
  companyName: `MIAR Smoke QA ${stamp}`,
  email: `smoke.${stamp}@example.test`,
  phone: '+5511999999999',
  cnpj: `SMOKE${String(stamp).slice(-10)}`,
  ownerName: 'Owner Smoke QA',
  password: 'SmokePass!2026',
};

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} HTTP_${response.status}: ${payload.error ?? 'erro'}`);
  return payload;
}
function auth(token) { return { Authorization: `Bearer ${token}` }; }
function jsonAuth(token) { return { ...auth(token), 'Content-Type': 'application/json' }; }

const ownerResult = await request('/auth/register/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(fictitious),
});
const ownerToken = ownerResult.token;
if (!ownerToken) throw new Error('OWNER_TOKEN_AUSENTE');

const employeeA = await request('/employees', {
  method: 'POST', headers: jsonAuth(ownerToken),
  body: JSON.stringify({ name: 'Operador Smoke A', role: 'cashier', pin: pinA }),
});
const employeeB = await request('/employees', {
  method: 'POST', headers: jsonAuth(ownerToken),
  body: JSON.stringify({ name: 'Operador Smoke B', role: 'cashier', pin: pinB }),
});
const loginA = await request('/auth/employee-login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pinA }),
});
const loginB = await request('/auth/employee-login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pinB }),
});
const tokenA = loginA.sessionToken;
const tokenB = loginB.sessionToken;
if (!tokenA || !tokenB) throw new Error('EMPLOYEE_TOKENS_AUSENTES');

const menuResult = await request('/menu-ia/confirmar', {
  method: 'POST', headers: jsonAuth(ownerToken),
  body: JSON.stringify({ itens: [{ name: 'Produto Smoke QA', description: 'Item fictício para validação', price: 10, category: 'Teste' }] }),
});
const menuItemId = menuResult.itens?.[0]?.id;
if (!menuItemId) throw new Error('MENU_ITEM_AUSENTE');

const table = await request('/tables', {
  method: 'POST', headers: jsonAuth(ownerToken),
  body: JSON.stringify({ number: 907, seats: 2 }),
});

const openTurn = await request('/cashier/session/open', {
  method: 'POST', headers: jsonAuth(tokenA),
  body: JSON.stringify({
    initialFloat: 17.5,
    operatorName: 'Operador Smoke A',
    openingDenominations: { '0.5': 1, '2': 1, '5': 1, '10': 1 },
  }),
});
const turnA = openTurn.session;
if (!turnA?.id) throw new Error('TURNO_AUSENTE');

const joined = await request(`/tables/by-token/${encodeURIComponent(table.qrToken)}/session/join`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ guestName: 'Cliente Smoke QA' }),
});
const guestId = joined.guestId;
if (!guestId) throw new Error('GUEST_AUSENTE');
const orderResult = await request(`/tables/by-token/${encodeURIComponent(table.qrToken)}/session/items`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ guestId, items: [{ menuItemId, quantity: 1, notes: 'Smoke E2E' }] }),
});
if (!orderResult.orderId || Number(orderResult.session?.subtotal) !== 10) throw new Error('PEDIDO_SESSION_INVALIDO');
const preparing = await request(`/orders/${encodeURIComponent(orderResult.orderId)}/status`, {
  method: 'PATCH', headers: jsonAuth(tokenA), body: JSON.stringify({ status: 'preparing' }),
});
const ready = await request(`/orders/${encodeURIComponent(orderResult.orderId)}/status`, {
  method: 'PATCH', headers: jsonAuth(tokenA), body: JSON.stringify({ status: 'ready' }),
});
if (preparing.status !== 'preparing' || ready.status !== 'ready') throw new Error('COZINHA_STATUS_INVALIDO');

const beforePayment = await request('/tables/with-sessions', { headers: auth(tokenA) });
const beforeTable = beforePayment.find((item) => item.id === table.id);
const fullyPaidBefore = beforeTable?.session?.fullyPaid === true;

const paid = await request(`/tables/by-token/${encodeURIComponent(table.qrToken)}/session/pay`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ guestId, method: 'cash', markedByStaff: true }),
});
if (paid.payments?.some((payment) => payment.status !== 'paid')) throw new Error('PAGAMENTO_NAO_PAID');
const afterPayment = await request('/tables/with-sessions', { headers: auth(tokenA) });
const afterTable = afterPayment.find((item) => item.id === table.id);
const fullyPaidAfter = afterTable?.session?.fullyPaid === true;
if (fullyPaidBefore || !fullyPaidAfter) throw new Error('FULLY_PAID_TRANSICAO_INVALIDA');

const handoff = await request(`/cashier/session/${encodeURIComponent(turnA.id)}/handoff`, {
  method: 'POST', headers: jsonAuth(tokenA),
  body: JSON.stringify({ mode: 'without_sangria', actualCash: 17.5, closingNotes: 'Entrega Smoke QA sem sangria', closingDenominations: { '0.5': 1, '2': 1, '5': 1, '10': 1 } }),
});
const received = await request('/cashier/session/handoff/receive', {
  method: 'POST', headers: jsonAuth(tokenB),
  body: JSON.stringify({ previousSessionId: turnA.id, initialFloat: 17.5, incomingNotes: 'Recebido e conferido Smoke QA', openingDenominations: { '0.5': 1, '2': 1, '5': 1, '10': 1 } }),
});
if (!handoff.handoff?.countedCash || !received.session?.id) throw new Error('HANDOFF_INVALIDO');
const turnB = received.session;
const closed = await request(`/cashier/session/${encodeURIComponent(turnB.id)}/close`, {
  method: 'POST', headers: jsonAuth(tokenB),
  body: JSON.stringify({ actualCash: 17.5, operatorName: 'Operador Smoke B', closingNotes: 'Fecho Smoke QA', closingDenominations: { '0.5': 1, '2': 1, '5': 1, '10': 1 } }),
});
if (closed.session?.status !== 'closed' || closed.difference !== 0) throw new Error('FECHO_TURNO_INVALIDO');
const ledger = await request('/financial-movements', { headers: auth(tokenB) });
const cashLedgerCents = ledger.summary?.byPaymentMethod?.cash ?? 0;
if (!Array.isArray(ledger.movements) || ledger.movements.length < 5 || cashLedgerCents < 1000) throw new Error('LEDGER_PERSISTENCIA_INVALIDA');

await request(`/tables/by-token/${encodeURIComponent(table.qrToken)}/session/close`, {
  method: 'POST', headers: jsonAuth(tokenB), body: JSON.stringify({}),
});
await request(`/tables/${encodeURIComponent(table.id)}/status`, {
  method: 'PATCH', headers: jsonAuth(tokenB), body: JSON.stringify({ status: 'free' }),
});
const finalTable = await request(`/tables/by-exit-token/${encodeURIComponent(table.exitQrToken)}`);
if (finalTable.table?.status !== 'free' || finalTable.session !== null) throw new Error('MESA_NAO_LIBERTADA');

const healthResults = await Promise.all(Array.from({ length: 40 }, () => fetch(`${base}/healthz`).then(async (response) => ({ http: response.status, body: await response.json().catch(() => ({})) }))));
const health200 = healthResults.filter((item) => item.http === 200 && item.body?.status === 'ok').length;
if (health200 !== healthResults.length) throw new Error(`HEALTH_SPIKE_FAIL_${health200}/${healthResults.length}`);
const persistedAfterHealth = await request(`/tables/by-exit-token/${encodeURIComponent(table.exitQrToken)}`);
if (persistedAfterHealth.table?.status !== 'free' || persistedAfterHealth.session !== null) throw new Error('PERSISTENCIA_POS_HEALTH_INVALIDA');

console.log(JSON.stringify({
  status: 'PASS',
  tenantCreated: true,
  operatorsAuthenticated: true,
  fullyPaid: { before: fullyPaidBefore, after: fullyPaidAfter },
  e2e: { qr: true, order: true, kitchenPreparing: preparing.status === 'preparing', kitchenReady: ready.status === 'ready', payment: true, sessionClosed: true, tableFreed: true },
  handoff: { withoutSangria: true, received: true, difference: closed.difference },
  ledger: { movements: ledger.movements.length, cashCentsAtLeast: cashLedgerCents >= 1000 },
  healthSpike: { requests: healthResults.length, http200Ok: health200, persistedAfter: true },
  fictitiousTableNumber: table.number,
  fictitiousEmployeeIdsPresent: Boolean(employeeA.id && employeeB.id),
}));
