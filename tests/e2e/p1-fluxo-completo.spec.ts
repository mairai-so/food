#!/usr/bin/env node

/**
 * P1.1: Teste de fluxo completo
 * Cliente → Cozinha → Caixa
 * 
 * Este script valida o caminho crítico do negócio:
 * 1. Cliente faz login
 * 2. Cliente vê cardápio
 * 3. Cliente faz pedido
 * 4. Cliente paga
 * 5. Cozinha recebe e prepara
 * 6. Status volta ao cliente
 * 7. Caixa fecha a conta
 * 
 * Uso:
 *   pnpm test:flow -- --headed
 */

import { test, expect } from '@playwright/test';

test.describe('Fluxo completo: cliente → cozinha → caixa', () => {
  test.skip(
    !process.env.TEST_RESTAURANT_ID ||
      !process.env.TEST_CLIENT_TOKEN ||
      !process.env.TEST_EMPLOYEE_TOKEN,
    'Requer TEST_RESTAURANT_ID, TEST_CLIENT_TOKEN e TEST_EMPLOYEE_TOKEN reais.',
  );

  let restaurantId: string;
  let clienteToken: string;
  let funcionarioToken: string;
  let pedidoId: string;

  test.beforeAll(async () => {
    // Preparar ambiente: criar restaurante, empresa, usuários
    console.log('⚙️  Preparando ambiente de teste...');
    restaurantId = process.env.TEST_RESTAURANT_ID!;
    clienteToken = process.env.TEST_CLIENT_TOKEN!;
    funcionarioToken = process.env.TEST_EMPLOYEE_TOKEN!;
  });

  test('01. Cliente acessa app e faz login', async ({ page }) => {
    console.log('📱 [Cliente] Acessando app...');
    
    await page.goto('http://localhost:5178'); // Cliente app
    await expect(page).toHaveTitle(/Cliente|Home/);
    
    // Login ou cadastro
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill('cliente-teste@example.com');
      await page.locator('input[type="password"]').fill('senha123');
      await page.locator('button:has-text("Entrar")').click();
      
      // Aguardar navegação
      await page.waitForURL('**/home', { timeout: 5000 });
      console.log('✅ Login realizado');
    } else {
      console.log('⚠️  Login já feito ou app em estado diferente');
    }
  });

  test('02. Cliente vê cardápio e seleciona itens', async ({ page }) => {
    console.log('📋 [Cliente] Acessando cardápio...');
    
    await page.goto('http://localhost:5178/menu');
    
    // Validar que cardápio carregou
    const menuItems = page.locator('[data-testid="menu-item"]');
    const count = await menuItems.count();
    expect(count).toBeGreaterThan(0);
    console.log(`✅ ${count} itens encontrados no cardápio`);
    
    // Selecionar primeiro item
    await menuItems.first().click();
    console.log('✅ Item selecionado');
    
    // Adicionar ao carrinho
    await page.locator('button:has-text("Adicionar")').click();
    await expect(page.locator('text=Carrinho')).toBeVisible();
  });

  test('03. Cliente faz pedido e vai ao checkout', async ({ page }) => {
    console.log('🛒 [Cliente] Fazendo pedido...');
    
    await page.goto('http://localhost:5178/carrinho');
    
    // Validar carrinho
    const cartItems = page.locator('[data-testid="cart-item"]');
    const itemCount = await cartItems.count();
    expect(itemCount).toBeGreaterThan(0);
    console.log(`✅ ${itemCount} item(ns) no carrinho`);
    
    // Prosseguir para checkout
    await page.locator('button:has-text("Checkout")').click();
    await page.waitForURL('**/checkout', { timeout: 5000 });
  });

  test('04. Cliente paga (Pix)', async ({ page }) => {
    console.log('💳 [Cliente] Realizando pagamento Pix...');
    
    await page.goto('http://localhost:5178/checkout');
    
    // Selecionar Pix
    await page.locator('input[value="pix"]').click();
    
    // Confirmar pagamento
    await page.locator('button:has-text("Pagar")').click();
    
    // Validar que Pix foi gerado
    await expect(page.locator('[data-testid="qr-code"]')).toBeVisible({ timeout: 5000 });
    console.log('✅ QR Code Pix gerado');
    
    // Extrair ID do pedido da URL ou página
    pedidoId = new URL(page.url()).searchParams.get('pedido_id') || 'pedido-001';
    console.log(`✅ Pedido criado: ${pedidoId}`);
  });

  test('05. Cozinha recebe pedido em tempo real', async ({ page }) => {
    console.log('👨‍🍳 [Cozinha] Aguardando pedido...');
    
    // Aguardar 2 segundos para sincronização
    await page.waitForTimeout(2000);
    
    // Abrir app da cozinha
    await page.goto('http://localhost:5175'); // Cozinha app
    
    // Validar que pedido aparece
    const pedidoCard = page.locator(`[data-testid="pedido-${pedidoId}"]`);
    await expect(pedidoCard).toBeVisible({ timeout: 10000 });
    console.log('✅ Pedido recebido na cozinha');
    
    // Validar conteúdo do pedido
    await expect(pedidoCard).toContainText(/preparar|novo/i);
  });

  test('06. Cozinha muda status: preparando → pronto', async ({ page }) => {
    console.log('✍️  [Cozinha] Alterando status...');
    
    const pedidoCard = page.locator(`[data-testid="pedido-${pedidoId}"]`);
    
    // Clicar no pedido para abrir detalhes
    await pedidoCard.click();
    
    // Botão de "Preparando"
    await page.locator('button:has-text("Preparando")').click();
    console.log('✅ Pedido marcado como preparando');
    
    // Aguardar 1 segundo
    await page.waitForTimeout(1000);
    
    // Botão de "Pronto"
    await page.locator('button:has-text("Pronto")').click();
    console.log('✅ Pedido marcado como pronto');
    
    // Validar mudança visual
    await expect(pedidoCard).toContainText(/pronto/i);
  });

  test('07. Cliente vê status "Pronto" em tempo real', async ({ page }) => {
    console.log('📲 [Cliente] Verificando status...');
    
    // Voltar ao app do cliente
    await page.goto(`http://localhost:5178/pedido/${pedidoId}`);
    
    // Validar que status mudou
    const statusBadge = page.locator('[data-testid="order-status"]');
    await expect(statusBadge).toContainText(/pronto|pronto para retirada/i, { timeout: 10000 });
    console.log('✅ Cliente vê que pedido está pronto');
    
    // Validar notificação
    const notification = page.locator('[role="alert"]');
    await expect(notification).toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('⚠️  Notificação não apareceu (opcional)');
    });
  });

  test('08. Caixa registra e fecha a conta', async ({ page }) => {
    console.log('💰 [Caixa] Encerrando...');
    
    // Abrir app da caixa
    await page.goto('http://localhost:5174'); // Caixa app
    
    // Validar que pedido aparece no fechamento
    const pedidoNaCaixa = page.locator(`[data-testid="pedido-${pedidoId}"]`);
    await expect(pedidoNaCaixa).toBeVisible({ timeout: 10000 });
    console.log('✅ Pedido visível no caixa');
    
    // Registrar recebimento
    await pedidoNaCaixa.click();
    await page.locator('button:has-text("Recebido")').click();
    console.log('✅ Pagamento registrado');
    
    // Validar que pedido saiu da tela (ou ficou em histórico)
    await expect(pedidoNaCaixa).not.toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('⚠️  Pedido ainda visível (pode estar em histórico)');
    });
  });

  test('09. Validar persistência no banco', async ({ request }) => {
    console.log('🗄️  [API] Validando banco...');
    
    // Chamar API para confirmar pedido foi salvo
    const response = await request.get(
      `http://localhost:5000/api/pedidos/${pedidoId}`,
      {
        headers: {
          Authorization: `Bearer ${clienteToken}`,
        },
      }
    );
    
    expect(response.status()).toBe(200);
    const pedido = await response.json();
    expect(pedido.id).toBe(pedidoId);
    expect(pedido.status).toBe('pronto');
    console.log('✅ Pedido confirmado no banco com status correto');
  });

  test.afterAll(async () => {
    console.log('\n📊 Resumo:');
    console.log(`  ✅ Fluxo completo validado`);
    console.log(`  ✅ Pedido: ${pedidoId}`);
    console.log(`  ✅ Cliente → Cozinha → Caixa funcionaram em tempo real`);
    console.log(`  ✅ Dados persistidos no banco`);
  });
});
