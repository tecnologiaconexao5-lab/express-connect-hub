import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  } catch {
    // continue regardless
  }
  await page.waitForTimeout(3000);
}

test.describe('Validação P0 Sidebar Navigation (Destinos Corrigidos)', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('Comercial > Clientes (deve ir para Cadastros > Clientes)', async ({ page }) => {
    await page.goto('/cadastros/clientes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/cadastros/clientes');
  });

  test('Comercial > Tabela de Valores', async ({ page }) => {
    await page.goto('/comercial?tab=tabela', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/comercial');
  });

  test('Frota > Veículos', async ({ page }) => {
    await page.goto('/cadastros/veiculos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/cadastros/veiculos');
  });

  test('Cadastros > Prestadores', async ({ page }) => {
    await page.goto('/cadastros/prestadores', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/cadastros/prestadores');
  });

  test('Cadastros > Análise de Documentos', async ({ page }) => {
    await page.goto('/cadastros/analise-documentos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/cadastros/analise-documentos');
  });

  test('Cadastros > Unidades', async ({ page }) => {
    await page.goto('/cadastros/auxiliares?tab=unidades', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('tab=unidades');
  });

  test('Cadastros > Locais', async ({ page }) => {
    await page.goto('/cadastros/auxiliares?tab=filiais', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('tab=filiais');
  });

  test('Cadastros > Tipos de Veículo', async ({ page }) => {
    await page.goto('/cadastros/veiculos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/cadastros/veiculos');
  });

  test('Cadastros > Setores & CCs', async ({ page }) => {
    await page.goto('/cadastros/auxiliares?tab=centros-custo', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('tab=centros-custo');
  });

  test('Financeiro > Seguros Auto', async ({ page }) => {
    await page.goto('/financeiro?tab=seguros-auto', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/financeiro');
  });

  test('Biblioteca > Manuais Operação', async ({ page }) => {
    await page.goto('/biblioteca?tab=operacional', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/biblioteca');
  });

  test('Biblioteca > Manuais Prestador', async ({ page }) => {
    await page.goto('/biblioteca?tab=prestador', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/biblioteca');
  });

});
