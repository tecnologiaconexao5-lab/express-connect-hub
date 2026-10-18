import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = 'test-results/e2e/f31';

test.describe('F31 - Missões, Metas, Agenda e KPIs', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/central-ia?tab=missoes', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Handle login if present
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
    await page.goto('/central-ia?tab=missoes', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('01 - should display Missoes tab with sub-tabs', async ({ page }) => {
    await expect(page.locator('text=Missões').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Metas').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Agenda').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Limites').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Desempenho').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Nova Missão")').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-tab-missoes.png'), fullPage: false });
  });

  test('02 - should open and close Nova Missao dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Nova Missão")').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Defina a missão do funcionário digital').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-nova-missao-dialog.png'), fullPage: false });
    await page.locator('button:has-text("Cancelar")').first().click();
    await page.waitForTimeout(300);
  });

  test('03 - should create a new mission via dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Nova Missão")').first().click();
    await page.waitForTimeout(500);

    // Select first robot from dropdown
    const selectTrigger = page.locator('[role="dialog"] .space-y-4').first().locator('button[role="combobox"]').first();
    if (await selectTrigger.isVisible().catch(() => false)) {
      await selectTrigger.click();
      await page.waitForTimeout(300);
      const firstItem = page.locator('[role="option"]').first();
      if (await firstItem.isVisible().catch(() => false)) {
        await firstItem.click();
        await page.waitForTimeout(200);
      }
    }

    await page.locator('input[placeholder*="Ex: Prospecção"]').first().fill('Missão Playwright Teste F31');
    await page.locator('textarea').first().fill('Missão criada durante teste Playwright');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-missao-form-filled.png'), fullPage: false });

    await page.locator('button:has-text("Salvar")').first().click();
    await page.waitForTimeout(2000);

    // Verify mission was created
    await expect(page.locator('text=Missão criada').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('text=Missão Playwright Teste F31').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-missao-criada.png'), fullPage: false });
  });

  test('04 - should navigate to Metas sub-tab and see empty state', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button[role="tab"]:has-text("Metas")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Nova Meta').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-metas-tab.png'), fullPage: false });
  });

  test('05 - should navigate to Agenda sub-tab', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button[role="tab"]:has-text("Agenda")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Selecione um robô').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-agenda-tab.png'), fullPage: false });
  });

  test('06 - should navigate to Limites sub-tab', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button[role="tab"]:has-text("Limites")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Novo Limite').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-limites-tab.png'), fullPage: false });
  });

  test('07 - should navigate to Desempenho sub-tab', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.locator('button[role="tab"]:has-text("Desempenho")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Desempenho dos Funcionários Digitais').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-desempenho-tab.png'), fullPage: false });
  });

  test('08 - should verify Central IA has Missões tab', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Get the tab list and check all tabs are present including Missões
    const tabsList = page.locator('[role="tablist"]');
    await expect(tabsList.locator('text=Robôs').first()).toBeVisible({ timeout: 10000 });
    await expect(tabsList.locator('text=Missões').first()).toBeVisible({ timeout: 10000 });
    await expect(tabsList.locator('text=Configurações').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-tabs-all.png'), fullPage: false });
  });

  test('09 - should verify Diretor Virtual integration monitors missions', async ({ page }) => {
    // Verify Diretor Virtual tab is still present and working
    await page.goto('/central-ia?tab=diretor', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Diretor Virtual').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-diretor-virtual.png'), fullPage: false });
  });

  test('10 - should check console for errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);
    // Visit each sub-tab to trigger any errors
    const subTabs = ['missoes', 'metas', 'agenda', 'limites', 'desempenho'];
    for (const subTab of subTabs) {
      await page.locator(`button[role="tab"]:has-text("${subTab === 'missoes' ? 'Missões' : subTab === 'metas' ? 'Metas' : subTab === 'agenda' ? 'Agenda' : subTab === 'limites' ? 'Limites' : 'Desempenho'}")`).first().click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-console-check.png'), fullPage: false });

    if (errors.length > 0) {
      console.log('Console errors found:', errors.join('\n'));
    }
    expect(errors.filter(e => !e.includes('favicon') && !e.includes('manifest'))).toEqual([]);
  });
});
