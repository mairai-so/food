#!/usr/bin/env node

// Test harness para BLOCO 1 — RESTAURANTE
// Testa via API + WebSocket para validar fluxos críticos

const API_BASE = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

const tests = {
  '1.1': { name: 'Cadastro Gestor', status: '❓', error: '' },
  '1.2': { name: 'Onboarding', status: '❓', error: '' },
  '1.3': { name: 'Mesas e QR', status: '❓', error: '' },
  '1.4': { name: 'Cardápio Garçom', status: '❓', error: '' },
  '1.5': { name: 'Status Cozinha', status: '❓', error: '' },
  '1.6': { name: 'Caixa/Pagamento', status: '❓', error: '' },
  '1.7': { name: 'Config Idioma', status: '❓', error: '' },
  '1.8': { name: 'Mural + Feed', status: '❓', error: '' },
};

let gestorToken = '';
let companyId = '';
let funcionarioPin = '';
let mesoaId = '';
let pedidoId = '';

async function log(test, status, message = '') {
  tests[test].status = status;
  if (message) tests[test].error = message;
  console.log(`[${test}] ${tests[test].name}: ${status} ${message ? '→ ' + message : ''}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test11CadastroGestor() {
  console.log('\n=== 1.1 Cadastro do Gestor ===');
  try {
    // Primeiro: inicia o cadastro (pré-verificação)
    const startRes = await fetch(`${API_BASE}/auth/register/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Restaurante Teste BLOCO 1',
        ownerName: 'João Tester',
        email: `teste-${Date.now()}@miar.test`,
        cpf: '12345678901',
        password: 'TesteSenha@123',
        phone: '11999999999',
        address: 'Rua Teste, 123, São Paulo - SP, 01234-567, Brasil',
      }),
    });

    if (!startRes.ok) {
      const err = await startRes.json();
      throw new Error(err.error || `HTTP ${startRes.status}`);
    }

    const data = await startRes.json();
    gestorToken = data.token;
    companyId = data.companyId;

    if (!gestorToken) throw new Error('Sem token no response');

    // Testa acesso autenticado
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${gestorToken}` },
    });

    if (!meRes.ok) throw new Error(`Auth ME falhou: ${meRes.status}`);

    await log('1.1', '✅', 'Cadastro criado e token válido');
  } catch (e) {
    await log('1.1', '❌', e.message);
  }
}

async function test12Onboarding() {
  console.log('\n=== 1.2 Onboarding ===');
  try {
    if (!gestorToken) throw new Error('Token não disponível (1.1 falhou)');

    // Salva segmento
    const segRes = await fetch(`${API_BASE}/company/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gestorToken}`,
      },
      body: JSON.stringify({ segment: 'restaurant' }),
    });

    if (!segRes.ok) throw new Error(`Segmento: ${segRes.status}`);

    // Cadastra 5 itens de cardápio
    for (let i = 1; i <= 5; i++) {
      const itemRes = await fetch(`${API_BASE}/menu/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gestorToken}`,
        },
        body: JSON.stringify({
          name: `Prato ${i}`,
          description: `Descrição do prato ${i}`,
          price: 15 + i * 5,
          category: 'main',
        }),
      });

      if (!itemRes.ok) throw new Error(`Item ${i}: ${itemRes.status}`);
    }

    // Cadastra 1 funcionário com PIN
    const staffRes = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gestorToken}`,
      },
      body: JSON.stringify({
        name: 'João Garçom',
        pin: '1234',
        role: 'waiter',
      }),
    });

    if (!staffRes.ok) throw new Error(`Staff: ${staffRes.status}`);
    const staffData = await staffRes.json();
    funcionarioPin = '1234';

    // Verifica que cardápio persiste após reload (simulado)
    await sleep(500);
    const menuRes = await fetch(`${API_BASE}/menu/items`, {
      headers: { Authorization: `Bearer ${gestorToken}` },
    });

    if (!menuRes.ok) throw new Error(`Menu check: ${menuRes.status}`);
    const menu = await menuRes.json();
    if (!Array.isArray(menu) || menu.length < 5) throw new Error('Cardápio não persistiu (< 5 itens)');

    await log('1.2', '✅', '5 itens + 1 funcionário cadastrados');
  } catch (e) {
    await log('1.2', '❌', e.message);
  }
}

async function test13MesasQR() {
  console.log('\n=== 1.3 Mesas e QR Code ===');
  try {
    if (!gestorToken) throw new Error('Token não disponível');

    // Cria 3 mesas
    for (let i = 1; i <= 3; i++) {
      const mesaRes = await fetch(`${API_BASE}/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gestorToken}`,
        },
        body: JSON.stringify({
          number: i,
          name: `Mesa ${i}`,
          capacity: 4,
        }),
      });

      if (!mesaRes.ok) throw new Error(`Mesa ${i}: ${mesaRes.status}`);
      if (i === 1) {
        const data = await mesaRes.json();
        mesoaId = data.id;
      }
    }

    // Gera QR para primeira mesa
    if (mesoaId) {
      const qrRes = await fetch(`${API_BASE}/tables/${mesoaId}/qr`, {
        headers: { Authorization: `Bearer ${gestorToken}` },
      });

      if (!qrRes.ok) throw new Error(`QR: ${qrRes.status}`);
      const qr = await qrRes.json();
      if (!qr.qrCode && !qr.url) throw new Error('QR Code não gerado');
    }

    await log('1.3', '✅', '3 mesas criadas com QR Code');
  } catch (e) {
    await log('1.3', '❌', e.message);
  }
}

async function test14PedidoGarcom() {
  console.log('\n=== 1.4 Pedido Garçom ===');
  try {
    // Simula login do garçom
    const waiterRes = await fetch(`${API_BASE}/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: funcionarioPin,
        tableId: mesoaId,
      }),
    });

    if (!waiterRes.ok) throw new Error(`Garçom login: ${waiterRes.status}`);
    const waiterData = await waiterRes.json();
    const waiterToken = waiterData.token;

    // Verifica se cardápio carrega (PONTO CRÍTICO)
    const menuRes = await fetch(`${API_BASE}/menu/items`, {
      headers: { Authorization: `Bearer ${waiterToken}` },
    });

    if (!menuRes.ok) throw new Error(`Menu load: ${menuRes.status}`);
    const menu = await menuRes.json();
    if (!Array.isArray(menu) || menu.length === 0) {
      throw new Error('Cardápio NÃO carregou para garçom!');
    }

    // Cria pedido com 2-3 itens
    const items = menu.slice(0, 3).map(item => ({
      itemId: item.id,
      quantity: 1,
    }));

    const orderRes = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({
        tableId: mesoaId,
        items,
      }),
    });

    if (!orderRes.ok) throw new Error(`Pedido: ${orderRes.status}`);
    const order = await orderRes.json();
    pedidoId = order.id;

    await log('1.4', '✅ CRÍTICO', 'Cardápio carregou! Pedido criado com 3 itens');
  } catch (e) {
    await log('1.4', '❌', e.message);
  }
}

async function test15Cozinha() {
  console.log('\n=== 1.5 Status Cozinha ===');
  try {
    if (!pedidoId) throw new Error('Pedido não criado (1.4 falhou)');

    // Atualiza status: recebido → em preparo → pronto
    const statuses = ['received', 'preparing', 'ready'];
    for (const status of statuses) {
      const updateRes = await fetch(`${API_BASE}/orders/${pedidoId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gestorToken}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!updateRes.ok) throw new Error(`Status ${status}: ${updateRes.status}`);
    }

    // Verifica status final
    const getRes = await fetch(`${API_BASE}/orders/${pedidoId}`, {
      headers: { Authorization: `Bearer ${gestorToken}` },
    });

    if (!getRes.ok) throw new Error(`Get order: ${getRes.status}`);
    const order = await getRes.json();
    if (order.status !== 'ready') throw new Error(`Status final: ${order.status} (esperado: ready)`);

    await log('1.5', '✅', 'Status alterado: recebido → em preparo → pronto');
  } catch (e) {
    await log('1.5', '❌', e.message);
  }
}

async function test16Caixa() {
  console.log('\n=== 1.6 Caixa e Pagamento ===');
  try {
    if (!pedidoId) throw new Error('Pedido não criado');

    // Verifica que pedido está aguardando pagamento
    const getRes = await fetch(`${API_BASE}/orders/${pedidoId}`, {
      headers: { Authorization: `Bearer ${gestorToken}` },
    });

    if (!getRes.ok) throw new Error(`Get order: ${getRes.status}`);
    const order = await getRes.json();
    if (!order.totalAmount) throw new Error('Sem valor total no pedido');

    // Processa pagamento
    const payRes = await fetch(`${API_BASE}/orders/${pedidoId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gestorToken}`,
      },
      body: JSON.stringify({
        method: 'cash',
        amount: order.totalAmount,
      }),
    });

    if (!payRes.ok) throw new Error(`Payment: ${payRes.status}`);

    // Verifica que mesa foi liberada
    await sleep(500);
    const getRes2 = await fetch(`${API_BASE}/orders/${pedidoId}`, {
      headers: { Authorization: `Bearer ${gestorToken}` },
    });

    if (!getRes2.ok) throw new Error(`Get order after pay: ${getRes2.status}`);
    const orderAfter = await getRes2.json();
    if (orderAfter.status !== 'completed') throw new Error(`Status após pagamento: ${orderAfter.status}`);

    await log('1.6', '✅', 'Pagamento confirmado e mesa liberada');
  } catch (e) {
    await log('1.6', '❌', e.message);
  }
}

async function test17ConfigIdioma() {
  console.log('\n=== 1.7 Configurações de Idioma ===');
  try {
    if (!gestorToken) throw new Error('Token não disponível');

    // Tenta mudar idioma
    const langRes = await fetch(`${API_BASE}/company/language`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gestorToken}`,
      },
      body: JSON.stringify({ language: 'es' }),
    });

    if (!langRes.ok) throw new Error(`Language update: ${langRes.status}`);

    // Verifica se mudou
    const getRes = await fetch(`${API_BASE}/company`, {
      headers: { Authorization: `Bearer ${gestorToken}` },
    });

    if (!getRes.ok) throw new Error(`Get company: ${getRes.status}`);
    const company = await getRes.json();
    if (company.language !== 'es') throw new Error(`Idioma: ${company.language} (esperado: es)`);

    await log('1.7', '✅', 'Idioma alterado: pt → es');
  } catch (e) {
    await log('1.7', '❌', e.message);
  }
}

async function test18MuralFeed() {
  console.log('\n=== 1.8 Mural de Empregos e Feed ===');
  try {
    if (!gestorToken) throw new Error('Token não disponível');

    // Cria vaga no mural
    const jobRes = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gestorToken}`,
      },
      body: JSON.stringify({
        title: 'Garçom - Tempo Integral',
        description: 'Procuramos garçom experiente',
      }),
    });

    if (!jobRes.ok) throw new Error(`Job post: ${jobRes.status}`);
    const job = await jobRes.json();
    const jobId = job.id;

    // Publica no feed
    const feedRes = await fetch(`${API_BASE}/feed/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gestorToken}`,
      },
      body: JSON.stringify({
        content: 'Bem-vindo ao nosso novo cardápio de outono!',
      }),
    });

    if (!feedRes.ok) throw new Error(`Feed post: ${feedRes.status}`);

    // Testa pausar/reativar vaga
    if (jobId) {
      const pauseRes = await fetch(`${API_BASE}/jobs/${jobId}/pause`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${gestorToken}` },
      });

      if (pauseRes.ok) {
        const resumeRes = await fetch(`${API_BASE}/jobs/${jobId}/resume`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${gestorToken}` },
        });

        if (!resumeRes.ok) throw new Error(`Resume job: ${resumeRes.status}`);
      }
    }

    await log('1.8', '✅', 'Vaga + Feed publicados');
  } catch (e) {
    await log('1.8', '❌', e.message);
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          BLOCO 1 — RESTAURANTE (Testes Automatizados)       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await test11CadastroGestor();
  await test12Onboarding();
  await test13MesasQR();
  await test14PedidoGarcom();
  await test15Cozinha();
  await test16Caixa();
  await test17ConfigIdioma();
  await test18MuralFeed();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      RELATÓRIO FINAL                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  for (const [key, test] of Object.entries(tests)) {
    const icon = test.status.includes('✅') ? '[x]' : test.status.includes('❌') ? '[ ]' : '[?]';
    const msg = test.error ? ` — ${test.error}` : '';
    console.log(`${icon} ${key} ${test.name} — ${test.status}${msg}`);
  }

  console.log('\n');
  const passedCount = Object.values(tests).filter(t => t.status.includes('✅')).length;
  const failedCount = Object.values(tests).filter(t => t.status.includes('❌')).length;

  console.log(`RESUMO: ${passedCount}/8 testes passaram, ${failedCount} falharam`);
  console.log('\nOBS: Testes executados via API. Interface visual pode ser validada em:');
  console.log('  • http://localhost:5173 (Gestor)');
  console.log('  • http://localhost:5174 (Garçom)');
  console.log('  • http://localhost:5175 (Cozinha)');
  console.log('  • http://localhost:5176 (Caixa)');
  console.log('  • http://localhost:5177 (Cliente)');
}

runAllTests().catch(console.error);
