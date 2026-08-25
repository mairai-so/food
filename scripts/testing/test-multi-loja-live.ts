import { chromium, Browser, Page } from 'playwright';

async function test() {
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const page: Page = await browser.newPage();
    console.log('📱 Abrindo Gestor na porta 5173...');
    await page.goto('http://localhost:5173/', { waitUntil: 'load' });

    console.log('\n⏳ Aguardando carregamento completo...');
    await page.waitForTimeout(2000);

    // Tirar screenshot da página inicial
    console.log('\n📸 Capturando tela inicial (login)...');
    await page.screenshot({ path: '/tmp/01-login.png' });
    console.log('✓ Salvo: /tmp/01-login.png');

    // Procurar por campo de email/usuario
    const emailField = await page.$('input[type="email"]') || await page.$('input[name*="email"]');
    if (emailField) {
      console.log('\n🔑 Encontrado campo de email. Testando credenciais...');
      await emailField.fill('test@restaurant.com');

      const senhaField = await page.$('input[type="password"]');
      if (senhaField) {
        await senhaField.fill('test123');

        // Procurar botão de entrar
        const btnEntrar = await page.$('button:has-text("Entrar")') ||
                         await page.$('button:has-text("Login")') ||
                         await page.locator('button').first();

        if (btnEntrar) {
          console.log('✓ Clicando em "Entrar"...');
          await btnEntrar.click();
          await page.waitForTimeout(2000);

          await page.screenshot({ path: '/tmp/02-apos-login.png' });
          console.log('✓ Salvo: /tmp/02-apos-login.png');
        }
      }
    } else {
      console.log('\n⚠️  Não encontrado campo de email. Possível que já está logado.');
      await page.screenshot({ path: '/tmp/03-dashboard.png' });
      console.log('✓ Salvo: /tmp/03-dashboard.png');
    }

    // Procurar seletor de loja
    const seletorLoja = await page.$('select') || await page.locator('[class*="loja"]').first();
    if (seletorLoja) {
      console.log('\n🏪 Encontrado seletor de loja. Trocando...');
      const options = await page.locator('option').count();
      console.log(`   Total de lojas disponíveis: ${options}`);

      if (options > 1) {
        // Selecionar segunda loja
        const option2 = page.locator('option').nth(1);
        await option2.click();
        await page.waitForTimeout(1000);
        console.log('✓ Trocado para segunda loja');

        await page.screenshot({ path: '/tmp/04-apos-trocar-loja.png' });
        console.log('✓ Salvo: /tmp/04-apos-trocar-loja.png');
      }
    }

    // Procurar botão de novo pedido ou cardápio
    const btnNovoPedido = await page.$('button:has-text("Novo")') ||
                         await page.$('button:has-text("Pedido")') ||
                         await page.locator('[class*="novo"]').first();

    if (btnNovoPedido) {
      console.log('\n📝 Clicando em novo pedido...');
      await btnNovoPedido.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: '/tmp/05-novo-pedido.png' });
      console.log('✓ Salvo: /tmp/05-novo-pedido.png');
    }

    console.log('\n✅ Teste concluído. Screenshots salvos em /tmp/');
    console.log('   - 01-login.png');
    console.log('   - 02-apos-login.png ou 03-dashboard.png');
    console.log('   - 04-apos-trocar-loja.png');
    console.log('   - 05-novo-pedido.png');

  } finally {
    await browser.close();
  }
}

test().catch(console.error);
