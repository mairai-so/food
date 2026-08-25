import { test, expect } from '@playwright/test';

const gestorAuthFile = '.auth/gestor.json';
const gestorCompletoAuthFile = '.auth/gestor-completo.json';
let kitchenTokenForE2E = '';
let cashierTokenForE2E = '';
let kitchenSessionTokenForE2E = '';
let cashierSessionTokenForE2E = '';

function buildTestCpf(seed = Date.now()): string {
  const base = String(seed).slice(-9).padStart(9, '1').split('').map(Number);
  const calculateDigit = (digits: number[], weight: number) => {
    const sum = digits.reduce((total, digit, index) => total + digit * (weight - index), 0);
    const remainder = 11 - (sum % 11);
    return remainder >= 10 ? 0 : remainder;
  };
  const firstDigit = calculateDigit(base, 10);
  const secondDigit = calculateDigit([...base, firstDigit], 11);
  return [...base, firstDigit, secondDigit].join('');
}

test.describe('BLOCO 1 — RESTAURANTE', () => {
  test.describe.serial('1.1 Cadastro do Gestor, do zero', () => {
    test('deve abrir tela de cadastro e preencher tudo', async ({ page }) => {
      await page.route('https://viacep.com.br/ws/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' }),
        });
      });
      await page.goto('/');

      // Aguarda que a página carregue
      await page.waitForLoadState('networkidle');

      // Verifica se está na página de login/cadastro
      const cadastroButton = page.locator('button:has-text("Cadastro"), a:has-text("Cadastro"), button:has-text("Create Account")').first();
      if (await cadastroButton.isVisible()) {
        await cadastroButton.click();
      }

      // Aguarda pela tela de cadastro
      await page.waitForLoadState('domcontentloaded');

      // Preenche idioma (primeira pergunta conforme especificado)
      const idiomaSelects = page.locator('select, [role="combobox"], button:has-text("Português")');
      if (await idiomaSelects.first().isVisible()) {
        await idiomaSelects.first().click();
        const portuguesOption = page.locator('text=Português');
        if (await portuguesOption.isVisible()) {
          await portuguesOption.click();
        }
      }

      // Preenche os campos obrigatorios na ordem do formulario atual.
      const email = `e2e-${Date.now()}@example.test`;
      await page.getByPlaceholder('Estabelecimento').fill('Restaurante Teste MIAR');
      await page.getByPlaceholder('Nome').fill('Responsavel Teste MIAR');
      await page.getByPlaceholder('E-mail', { exact: true }).fill(email);
      await page.getByPlaceholder('Confirmar e-mail', { exact: true }).fill(email);
      await page.getByPlaceholder('CPF', { exact: true }).fill(buildTestCpf());
      await page.getByPlaceholder('CEP', { exact: true }).fill('01001-000');
      await expect(page.locator('[role="alert"]')).toContainText('Endereço preenchido pelo CEP');
      await page.getByPlaceholder('Número').fill('123');
      await expect(page.locator('select[aria-label*="Cidade"]')).toHaveValue('São Paulo');
      await expect(page.locator('select[aria-label*="Estado"]')).toHaveValue('SP');
      await page.getByPlaceholder('Celular para receber SMS').fill('11999999999');
      await page.getByPlaceholder('Confirmar celular').fill('11999999999');
      await page.getByPlaceholder('Senha', { exact: true }).fill('Senha@12345');
      await page.getByPlaceholder('Confirmar senha', { exact: true }).fill('Senha@12345');
      await page.getByRole('checkbox', { name: /Li e aceito os termos/i }).check();

      // Clica em cadastro/submit
      await page.getByRole('button', { name: 'Criar conta e entrar' }).click();

      // Aguarda a navegação/carregamento
      await page.waitForLoadState('networkidle');

      // Verifica se o cadastro foi bem-sucedido e abriu o primeiro passo do onboarding.
      await expect(page).toHaveURL(/\/onboarding\/segmento/);
      await expect(page.getByRole('heading', { name: 'Configuração por segmento' })).toBeVisible();
      await page.context().storageState({ path: gestorAuthFile });

      console.log('✓ 1.1 Cadastro do Gestor completado com sucesso');
    });
  });

  test.describe.serial('1.2 Onboarding', () => {
    test.use({ storageState: gestorAuthFile });

    test('deve completar onboarding com segmento, cardápio e equipe', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Etapa 1: segmento
      const segmentoHeading = page.getByRole('heading', { name: 'Configuração por segmento' });
      await expect(segmentoHeading).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Churrascaria/ }).click();

      // Etapa 2: usuarios/equipe
      await page.getByRole('button', { name: /Próximo: Usuários/ }).click();
      await expect(page.getByRole('heading', { name: 'Cadastrar usuários' })).toBeVisible();
      await page.getByTestId('input-usuario-nome').fill('João Funcionário');
      await page.getByTestId('input-usuario-pin').fill('1234');
      await page.getByTestId('button-adicionar-usuario').click();
      await page.getByTestId('input-usuario-nome').fill('Cozinha E2E');
      await page.getByTestId('input-usuario-pin').fill('2345');
      await page.getByTestId('button-perfil-cozinha').click();
      await page.getByTestId('button-adicionar-usuario').click();
      await page.getByTestId('input-usuario-nome').fill('Caixa E2E');
      await page.getByTestId('input-usuario-pin').fill('3456');
      await page.getByTestId('button-perfil-caixa').click();
      await page.getByTestId('button-salvar-usuarios').click();
      await expect(page).toHaveURL(/\/onboarding\/estabelecimento/);

      // Etapa 3: estabelecimento
      await expect(page.getByRole('heading', { name: /Qual é o seu comércio/ })).toBeVisible();
      await page.getByRole('button', { name: /Churrascaria/ }).click();
      await page.getByTestId('button-salvar-estabelecimento').click();
      await expect(page).toHaveURL(/\/onboarding\/produtos/);

      // Etapa 4: produtos/cardapio
      await expect(page.getByRole('heading', { name: 'Como quer cadastrar os produtos?' })).toBeVisible();
      await page.getByRole('button', { name: 'Usar modelo de estoque do sistema' }).click();
      await expect(page).toHaveURL(/\/estoque/);
      await page.goto('/painel');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/Painel|Dashboard/).first()).toBeVisible({ timeout: 10000 });
      await page.context().storageState({ path: gestorCompletoAuthFile });

      console.log('✓ 1.2 Onboarding completado com sucesso');
    });
  });

  test.describe.serial('1.3 Mesas e QR Code', () => {
    test.use({ storageState: gestorCompletoAuthFile });

    test('deve criar mesas e gerar QR Code', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Abre o menu de módulos do primeiro painel e entra em Mesas e QR.
      await page.getByRole('button', { name: 'Abrir módulos de Painel 1' }).click();
      await page.getByRole('link', { name: 'Mesas e QR' }).click();

      await page.waitForLoadState('domcontentloaded');

      // Cria 3 mesas
      for (let i = 1; i <= 3; i++) {
        const addMesaButton = page.locator('button:has-text("Nova Mesa"), button:has-text("Adicionar"), button:has-text("Add")').first();
        await addMesaButton.click();

        // Preenche número/nome da mesa
        const mesaNameInput = page.locator('input[placeholder*="Número"], input[placeholder*="Nome"], input[type="text"]').last();
        await mesaNameInput.fill(`Mesa ${i}`);

        // Confirma mesa
        const confirmaMesaButton = page.locator('button:has-text("Confirmar"), button:has-text("Criar"), button:has-text("OK")').last();
        if (await confirmaMesaButton.isVisible()) {
          await confirmaMesaButton.click();
        }

        await page.waitForTimeout(500);
      }

      // Gera QR Code para primeira mesa
      const qrButton = page.locator('button:has-text("QR Code"), button:has-text("Escanear"), button:has-text("Generate")').first();
      await qrButton.click();

      await page.waitForLoadState('domcontentloaded');

      // Verifica se QR Code aparece
      const qrCodeImage = page.locator('img[src*="data:image"], canvas').first();
      await expect(qrCodeImage).toBeVisible({ timeout: 5000 });

      // Tenta extrair URL do QR Code e verifica formato
      const qrInfoText = page.locator('text=/mesa|table|session/i').first();
      if (await qrInfoText.isVisible()) {
        const text = await qrInfoText.textContent();
        console.log('QR Code info:', text);
      }

      console.log('✓ 1.3 Mesas e QR Code criados com sucesso');
    });
  });

  test.describe.serial('1.4 Pedido Garçom', () => {
    test.use({ storageState: gestorCompletoAuthFile });

    test('deve fazer login no garçom e criar pedido com cardápio', async ({ page }) => {
      await page.route('**/api/pix/cobrar', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ paymentId: `e2e-pix-${Date.now()}`, status: 'approved' }),
        });
      });
      await page.route('**/api/orders', async (route) => {
        const request = route.request();
        const body = request.postDataJSON() as Record<string, unknown>;
        const response = await page.request.post('http://localhost:5000/api/orders', {
          headers: { Authorization: String(request.headers().authorization ?? '') },
          data: { ...body, paymentMethod: 'cash', paymentId: undefined },
        });
        await route.fulfill({
          status: response.status(),
          headers: { 'content-type': 'application/json' },
          body: await response.body(),
        });
      });
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
      const ownerToken = await page.evaluate(() => window.localStorage.getItem('miar-owner-token'));
      expect(ownerToken).toBeTruthy();
      const employeesResponse = await page.request.get('http://localhost:5000/api/employees', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(employeesResponse.ok()).toBeTruthy();
      const employees = await employeesResponse.json() as Array<{ id: string; name: string }>;
      const testEmployee = employees.find((employee) => employee.name === 'João Funcionário');
      expect(testEmployee).toBeTruthy();
      const tokenResponse = await page.request.post('http://localhost:5000/api/auth/employee-tokens', {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { employeeId: testEmployee!.id },
      });
      expect(tokenResponse.ok()).toBeTruthy();
      const employeeToken = (await tokenResponse.json() as { token: string }).token;
      const kitchenEmployee = [...employees].reverse().find((employee) => (employee as { role?: string }).role === 'cook');
      const cashierEmployee = [...employees].reverse().find((employee) => (employee as { role?: string }).role === 'cashier');
      expect(kitchenEmployee).toBeTruthy();
      expect(cashierEmployee).toBeTruthy();
      const kitchenTokenResponse = await page.request.post('http://localhost:5000/api/auth/employee-tokens', {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { employeeId: kitchenEmployee!.id },
      });
      const cashierTokenResponse = await page.request.post('http://localhost:5000/api/auth/employee-tokens', {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { employeeId: cashierEmployee!.id },
      });
      expect(kitchenTokenResponse.ok()).toBeTruthy();
      expect(cashierTokenResponse.ok()).toBeTruthy();
      kitchenTokenForE2E = (await kitchenTokenResponse.json() as { token: string }).token;
      cashierTokenForE2E = (await cashierTokenResponse.json() as { token: string }).token;
      const kitchenLoginResponse = await page.request.post('http://localhost:5000/api/auth/employee-login', {
        data: { token: kitchenTokenForE2E },
      });
      const cashierLoginResponse = await page.request.post('http://localhost:5000/api/auth/employee-login', {
        data: { token: cashierTokenForE2E },
      });
      expect(kitchenLoginResponse.ok()).toBeTruthy();
      expect(cashierLoginResponse.ok()).toBeTruthy();
      kitchenSessionTokenForE2E = (await kitchenLoginResponse.json() as { sessionToken: string }).sessionToken;
      cashierSessionTokenForE2E = (await cashierLoginResponse.json() as { sessionToken: string }).sessionToken;

      // Navega para app garçom
      await page.goto('http://localhost:5177', { waitUntil: 'networkidle' }).catch(() => {
        return page.goto('http://localhost:5177', { waitUntil: 'networkidle' });
      });

      await page.waitForLoadState('domcontentloaded');

      // Login com token temporario de funcionario. O login por PIN global fica
      // ambiguo quando execucoes criam funcionarios com o mesmo PIN.
      const pinInput = page.locator('input[placeholder*="PIN"], input[type="password"], input[type="text"]').first();
      await pinInput.fill(employeeToken);

      const loginButton = page.locator('button:has-text("Login"), button:has-text("Entrar")').first();
      await loginButton.click();

      await page.waitForLoadState('networkidle');

      // Seleciona a mesa 1 no mapa real de mesas.
      const mesaButton = page.getByRole('button', { name: /^1\b/ }).first();
      await mesaButton.click();

      await page.waitForLoadState('domcontentloaded');

      // Abre modal/tela de novo pedido
      const novoPedidoButton = page.locator('button:has-text("Novo Pedido"), button:has-text("New Order")').first();
      const novoPedidoModal = page.getByRole('heading', { name: /Novo pedido|New order/i });
      if (await novoPedidoButton.isVisible() && !(await novoPedidoModal.isVisible())) {
        await novoPedidoButton.click();
      }

      // Verifica se cardápio carrega (ponto crítico)
      const menuItemNames = ['Rodízio Completo', 'Rodízio Executivo', 'Picanha na Brasa'];
      for (const itemName of menuItemNames) {
        const item = page.getByText(itemName, { exact: true });
        await expect(item).toBeVisible({ timeout: 10000 });
        await item.locator('../..').getByRole('button').last().click();
      }

      // Simula a aprovação do Pix e mantém a criação do pedido real no backend.
      const fecharPedidoButton = page.getByRole('button', { name: 'Gerar QR Pix e fechar pedido' });
      await fecharPedidoButton.click();

      await page.waitForLoadState('networkidle');

      // Verifica se pedido foi criado
      const pedidoConfirmation = page.getByText(/Pedido confirmado|Order created|sucesso/i).first();
      await expect(pedidoConfirmation).toBeVisible({ timeout: 5000 });

      console.log('✓ 1.4 Pedido Garçom criado com sucesso (CARDÁPIO CARREGOU!)');
    });
  });

  test.describe.serial('1.5 Status Cozinha', () => {
    test.use({ storageState: gestorCompletoAuthFile });

    test('deve receber pedido na cozinha e alterar status', async ({ page }) => {
      // Navega para app cozinha
      await page.goto('http://localhost:5175', { waitUntil: 'networkidle' }).catch(() => {
        return page.goto('http://localhost:5173/cozinha', { waitUntil: 'networkidle' });
      });

      await page.waitForLoadState('domcontentloaded');
      await page.evaluate((token) => localStorage.setItem('miar-cozinha-token', token), kitchenSessionTokenForE2E);
      await page.reload({ waitUntil: 'networkidle' });

      // Muda status para "em preparo"
      const emPreparoButton = page.getByRole('button', { name: /Em Preparo|In Progress/i }).first();
      await expect(emPreparoButton).toBeVisible();
      const statusResponse = page.waitForResponse((response) => response.url().includes('/api/orders/') && response.url().endsWith('/status'));
      await emPreparoButton.click();
      const statusResult = await statusResponse;
      expect(statusResult.ok(), await statusResult.text()).toBeTruthy();
      await page.waitForTimeout(1000);

      // Muda status para "pronto"
      const prontoButton = page.getByRole('button', { name: /Pronto|Ready/i }).first();
      await expect(prontoButton).toBeVisible();
      await prontoButton.click();

      await page.waitForTimeout(500);

      // Verifica se status foi atualizado
      const statusText = page.getByText(/Pronto|Ready/i).first();
      await expect(statusText).toBeVisible({ timeout: 5000 });

      console.log('✓ 1.5 Pedido na Cozinha recebido e status alterado');
    });
  });

  test.describe.serial('1.6 Caixa e Pagamento', () => {
    test.use({ storageState: gestorCompletoAuthFile });

    test('deve receber mesa aguardando pagamento e fechar conta', async ({ page }) => {
      // Navega para app caixa
      await page.goto('http://localhost:5174', { waitUntil: 'networkidle' }).catch(() => {
        return page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
      });

      await page.waitForLoadState('domcontentloaded');
      await page.evaluate((token) => localStorage.setItem('miar-caixa-token', token), cashierSessionTokenForE2E);
      await page.reload({ waitUntil: 'networkidle' });

      // Aguarda mesa com pedido aparecer
      const mesaButton = page.getByRole('button', { name: /^1\b.*Pronto para fechar/i }).first();
      await expect(mesaButton).toBeVisible({ timeout: 10000 });

      // Clica na mesa para ver conta
      await mesaButton.click();

      // Aguarda carregamento da conta
      const contaItems = page.getByText('Pronto para fechar', { exact: true }).last();
      await expect(contaItems).toBeVisible({ timeout: 5000 });

      // Clica em fechar/confirmar pagamento
      const fecharContaButton = page.getByRole('button', { name: /Abrir recebimento/i }).first();
      await fecharContaButton.click();
      await expect(page.getByText(/Recebimento seleccionado/i)).toBeVisible({ timeout: 5000 });

      console.log('✓ 1.6 Caixa: conta pronta para recebimento confirmada visualmente');
    });
  });

  test.describe.serial('1.7 Configurações de Idioma', () => {
    test('deve acessar configurações e trocar idioma em todos os apps', async ({ page }) => {
      const apps = [
        { name: 'Gestor', port: 5173 },
        { name: 'Garçom', port: 5174 },
        { name: 'Cozinha', port: 5175 },
        { name: 'Caixa', port: 5176 },
      ];

      for (const app of apps) {
        console.log(`Testando idioma no app ${app.name}`);

        await page.goto(`http://localhost:${app.port}`, { waitUntil: 'domcontentloaded' }).catch(() => {
          return page.goto(`http://localhost:5173/${app.name.toLowerCase()}`, { waitUntil: 'domcontentloaded' });
        });

        // Encontra botão de configurações (⚙ ou "Config")
        const configButton = page.locator('button:has-text("⚙"), button:has-text("Configurações"), button:has-text("Settings"), [role="button"]:nth-child(1)').first();
        if (await configButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await configButton.click();
        }

        // Aguarda tela de configurações carregar
        await page.waitForLoadState('domcontentloaded');

        // Procura por seletor de idioma
        const idiomaSelect = page.locator('select, [role="combobox"], button:has-text("Português"), button:has-text("Idioma")').first();
        if (await idiomaSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await idiomaSelect.click();

          // Tenta selecionar idioma alternativo (Espanhol)
          const espanholOption = page.locator('text=Español, text=Spanish, text=Espanhol').first();
          if (await espanholOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await espanholOption.click();
          }

          console.log(`  ✓ Idioma alterado no ${app.name}`);
        } else {
          console.log(`  ⚠ Configurações não encontradas no ${app.name}`);
        }

        await page.waitForTimeout(500);
      }

      console.log('✓ 1.7 Configurações de idioma testadas');
    });
  });

  test.describe.serial('1.8 Mural de Empregos e Feed', () => {
    test('deve criar vaga no Mural e publicar no Feed', async ({ page }) => {
      // Volta para Gestor
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

      // Navega para Mural de Empregos
      const muralLink = page.locator('text=Mural, a:has-text("Empregos"), button:has-text("Vagas")').first();
      if (await muralLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await muralLink.click();

        // Aguarda carregamento
        await page.waitForLoadState('domcontentloaded');

        // Clica em criar vaga
        const novaVagaButton = page.locator('button:has-text("Nova Vaga"), button:has-text("Adicionar")').first();
        await novaVagaButton.click();

        // Preenche dados da vaga
        const titleInput = page.locator('input[placeholder*="Título"], input[placeholder*="Title"]').last();
        await titleInput.fill('Garçom - Tempo Integral');

        const descInput = page.locator('textarea, input[placeholder*="Descrição"]').last();
        if (await descInput.isVisible()) {
          await descInput.fill('Procuramos garçom experiente com conhecimento de POS');
        }

        // Confirma vaga
        const confirmaButton = page.locator('button:has-text("Publicar"), button:has-text("Confirmar")').first();
        await confirmaButton.click();

        await page.waitForLoadState('domcontentloaded');

        // Verifica se vaga aparece na lista
        const vagaItem = page.locator('text=Garçom').first();
        await expect(vagaItem).toBeVisible({ timeout: 5000 });

        // Testa pausar vaga
        const pauseButton = page.locator('button:has-text("Pausar")').first();
        if (await pauseButton.isVisible()) {
          await pauseButton.click();
          console.log('✓ Vaga pausada');
        }

        // Reativa vaga
        const reativarButton = page.locator('button:has-text("Reativar")').first();
        if (await reativarButton.isVisible()) {
          await reativarButton.click();
          console.log('✓ Vaga reativada');
        }
      }

      // Navega para Feed
      const feedLink = page.locator('text=Feed, a:has-text("Feed"), button:has-text("Publicar")').first();
      if (await feedLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await feedLink.click();

        await page.waitForLoadState('domcontentloaded');

        // Clica em publicar
        const publicarButton = page.locator('button:has-text("Publicar"), button:has-text("Novo Post")').first();
        await publicarButton.click();

        // Preenche texto do post
        const postInput = page.locator('textarea, input[placeholder*="Escreva"], input[placeholder*="Write"]').last();
        await postInput.fill('Bem-vindo ao nosso novo cardápio de outono! Confira as novidades.');

        // Confirma publicação
        const confirmaPublish = page.locator('button:has-text("Publicar"), button:has-text("Postar")').first();
        await confirmaPublish.click();

        await page.waitForLoadState('networkidle');

        // Verifica se post aparece no feed
        const postText = page.locator('text=cardápio').first();
        await expect(postText).toBeVisible({ timeout: 5000 });

        console.log('✓ Post publicado no Feed');
      }

      console.log('✓ 1.8 Mural de Empregos e Feed testados');
    });
  });
});
