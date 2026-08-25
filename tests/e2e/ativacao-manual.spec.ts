import { test, expect } from '@playwright/test';

function buildTestCpf(seed = Date.now()): string {
  const base = String(seed).slice(-9).padStart(9, '1').split('').map(Number);
  const digit = (digits: number[], weight: number) => {
    const sum = digits.reduce((total, value, index) => total + value * (weight - index), 0);
    const remainder = 11 - (sum % 11);
    return remainder >= 10 ? 0 : remainder;
  };
  const first = digit(base, 10);
  return [...base, first, digit([...base, first], 11)].join('');
}

test('cadastro manual aparece para super-admin e libera com código', async ({ browser }) => {
  const email = `cliente.${Date.now()}@example.com`;
  const client = await browser.newContext();
  const clientPage = await client.newPage();
  await clientPage.route('https://viacep.com.br/ws/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ logradouro: 'Rua E2E', bairro: 'Centro', localidade: 'Sao Paulo', uf: 'SP' }),
  }));

  await clientPage.goto('/');
  const languagePrompt = clientPage.getByRole('dialog');
  if (await languagePrompt.isVisible()) {
    await languagePrompt.getByRole('button', { name: 'Português' }).click();
  }
  await clientPage.getByPlaceholder('Estabelecimento').fill('Restaurante E2E');
  await clientPage.getByPlaceholder('Razão social').fill('Restaurante E2E LTDA');
  await clientPage.getByPlaceholder('Nome').fill('Cliente E2E');
  await clientPage.getByPlaceholder('E-mail', { exact: true }).fill(email);
  await clientPage.getByPlaceholder('Confirmar e-mail').fill(email);
  await clientPage.getByPlaceholder('CPF').fill(buildTestCpf());
  await clientPage.getByPlaceholder('CEP').fill('01001000');
  await clientPage.getByPlaceholder('Número').fill('100');
  await clientPage.getByRole('textbox', { name: 'WhatsApp', exact: true }).fill('11987654321');
  await clientPage.getByRole('textbox', { name: 'Confirmar WhatsApp', exact: true }).fill('11987654321');
  await clientPage.getByRole('textbox', { name: 'Senha', exact: true }).fill('Senha@12345');
  await clientPage.getByPlaceholder('Confirmar senha').fill('Senha@12345');
  await clientPage.locator('input[type=checkbox]').check();
  await clientPage.getByRole('button', { name: 'Criar conta e entrar' }).click();
  await expect(clientPage.getByText('Código de ativação')).toBeVisible();
  await expect(clientPage.getByText(/Solicite o código ao administrador/)).toBeVisible();

  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await adminPage.goto('/');
  const adminLanguagePrompt = adminPage.getByRole('dialog');
  if (await adminLanguagePrompt.isVisible()) {
    await adminLanguagePrompt.getByRole('button', { name: 'Português' }).click();
  }
  await adminPage.getByRole('button', { name: 'Entrar' }).last().click();
  await adminPage.getByPlaceholder('E-mail').fill('robson.test@example.com');
  await adminPage.getByPlaceholder('Senha').fill('Senha@12345');
  await adminPage.getByRole('button', { name: 'Entrar' }).click();
  await adminPage.waitForURL('**/painel');
  await expect(adminPage.getByRole('link', { name: 'App Mestre' })).toBeVisible();
  await adminPage.goto('/ativacoes');
  const row = adminPage.locator('tr').filter({ hasText: email });
  await expect(row).toBeVisible();
  const code = await row.locator('span.font-mono').innerText();
  expect(code).toMatch(/^\d{6}$/);
  await row.getByRole('button', { name: 'Copiar código' }).click();

  const digits = clientPage.locator('input[aria-label^="Dígito"]');
  for (let index = 0; index < 6; index += 1) await digits.nth(index).fill(code[index]);
  await clientPage.getByRole('button', { name: 'Confirmar cadastro' }).click();
  await clientPage.waitForURL('**/onboarding/segmento');

  await expect(adminPage.locator('tr').filter({ hasText: email })).toHaveCount(0);
  await client.close();
  await admin.close();
});
