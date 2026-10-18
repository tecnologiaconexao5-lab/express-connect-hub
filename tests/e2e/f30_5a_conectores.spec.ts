import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = 'test-results/e2e/f30-5a';

test.describe('F30.5A - Conectores Universais', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/central-ia?tab=conectores', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const loginBtn = page.locator('button:has-text("Entrar")');
    const hasLoginForm = await loginBtn.isVisible().catch(() => false);
    if (hasLoginForm) {
      await page.waitForTimeout(500);
      const emailInput = page.locator('input[placeholder*="email"], input[placeholder*="@"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.click();
        await emailInput.fill('tamiris.castilho@conexaoexpress.com.br');
      }
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.click();
        await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
      }
      await loginBtn.click();
      await page.waitForTimeout(3000);
      await page.waitForLoadState('domcontentloaded');
    }
    await page.goto('/central-ia?tab=conectores', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('01 - should display Conectores tab with sub-tabs and stats', async ({ page }) => {
    await expect(page.locator('text=Conectores Universais').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Catálogo').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Vínculos').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Histórico').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Conectores').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Vínculos Ativos').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-tab-conectores.png'), fullPage: false });
  });

  test('02 - should display catalogo with connector cards', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Novo Conector').first()).toBeVisible({ timeout: 10000 });
    const connectorCardsCount = await page.locator('[role="tabpanel"] .grid.gap-3 > div').count();
    console.log(`Connector cards count: ${connectorCardsCount}`);
    if (connectorCardsCount > 0) {
      const firstConnectorName = await page.locator('[role="tabpanel"] .grid.gap-3 > div').first().locator('.font-semibold').textContent();
      console.log(`First connector: ${firstConnectorName}`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-catalogo-cards.png'), fullPage: false });
  });

  test('03 - should open and close Novo Conector dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Novo Conector")').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Cadastre uma nova integração externa').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-novo-conector-dialog.png'), fullPage: false });
    await page.locator('button:has-text("Cancelar")').first().click();
    await page.waitForTimeout(300);
  });

  test('04 - should create a new connector via dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Novo Conector")').first().click();
    await page.waitForTimeout(500);

    const testCode = 'TEST_PW_' + Date.now().toString(36).toUpperCase();
    await page.locator('input[placeholder*="CON_"]').first().fill(testCode);
    await page.locator('input[placeholder*="Zoho"]').first().fill('Playwright Test Connector');
    await page.locator('textarea').first().fill('Conector criado durante teste Playwright F30.5A');

    await page.locator('button:has-text("Criar")').first().click();
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Conector criado').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-conector-criado.png'), fullPage: false });
  });

  test('05 - should display vinculos tab', async ({ page }) => {
    await page.locator('button:has-text("Vínculos")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Vincular Conector').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-vinculos-tab.png'), fullPage: false });
  });

  test('06 - should display historico tab', async ({ page }) => {
    await page.locator('button:has-text("Histórico")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Atualizar').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-historico-tab.png'), fullPage: false });
  });
});
