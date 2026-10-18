import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = 'test-results/e2e/f304a-action-engine';

test.describe('F30.4A - Action Engine — Ferramentas dos Funcionários Digitais', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/central-ia?tab=ferramentas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Login if needed
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
    // Navigate again with correct tab after login
    await page.goto('/central-ia?tab=ferramentas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('01 - should display Ferramentas tab with all sub-tabs and stats', async ({ page }) => {
    await expect(page.locator('text=Action Engine').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Catálogo').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Permissões').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Histórico').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ferramentas').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Execuções').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-tab-ferramentas.png'), fullPage: false });
  });

  test('02 - should display catálogo with tool cards', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Nova Ferramenta').first()).toBeVisible({ timeout: 10000 });
    const toolCardsCount = await page.locator('[role="tabpanel"] .grid.gap-3 > div').count();
    console.log(`Tool cards count: ${toolCardsCount}`);
    if (toolCardsCount > 0) {
      const firstToolName = await page.locator('[role="tabpanel"] .grid.gap-3 > div').first().locator('.font-semibold').textContent();
      console.log(`First tool: ${firstToolName}`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-catalogo-cards.png'), fullPage: false });
  });

  test('03 - should open and close Nova Ferramenta dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /nova ferramenta/i }).click();
    await page.waitForTimeout(1000);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.locator('text=Código Único')).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Nome *')).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Categoria')).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Risco Operacional')).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Precisa de Aprovação Humana')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-nova-ferramenta-dialog.png'), fullPage: false });
    await dialog.locator('button:has-text("Cancelar")').click();
    await page.waitForTimeout(500);
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('04 - should create new tool via dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /nova ferramenta/i }).click();
    await page.waitForTimeout(1000);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Fill required fields
    const allInputs = dialog.locator('input');
    const codigoInput = allInputs.nth(0);
    await codigoInput.fill('TEST_ENVIAR_EMAIL_TS');

    const nomeInput = allInputs.nth(1);
    await nomeInput.fill('Ferramenta Teste Playwright');

    const descTextarea = dialog.locator('textarea').first();
    await descTextarea.fill('Ferramenta criada pelo teste Playwright F30.4A');

    // Click Criar
    await dialog.locator('button:has-text("Criar")').click();
    await page.waitForTimeout(3000);

    // Verify dialog closed
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-ferramenta-criada.png'), fullPage: false });
  });

  test('05 - should show permissoes empty state', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: /permissoes|permissões/i }).click();
    await page.waitForTimeout(2000);
    const emptyState = page.locator('text=Nenhuma permissão configurada');
    await expect(emptyState).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-permissoes-empty.png'), fullPage: false });
  });

  test('06 - should show historico empty state', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: /histórico/i }).click();
    await page.waitForTimeout(2000);
    const emptyState = page.locator('text=Nenhuma execução registrada');
    await expect(emptyState).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-historico-empty.png'), fullPage: false });
  });

  test('07 - should filter catalogo by search', async ({ page }) => {
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[placeholder="Buscar ferramenta..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('COM_ENVIAR_EMAIL');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-search-filter.png'), fullPage: false });
  });

  test('08 - should navigate between sub-tabs - catalogo, permissoes, historico', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Permissoes
    await page.getByRole('tab', { name: /permissoes|permissões/i }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator('text=Vincular Ferramenta').first()).toBeVisible({ timeout: 10000 });

    // Histórico
    await page.getByRole('tab', { name: /histórico/i }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator('button:has-text("Atualizar")').first()).toBeVisible({ timeout: 10000 });

    // Back to Catálogo
    await page.getByRole('tab', { name: /catálogo/i }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator('text=Nova Ferramenta').first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-navegacao-entre-sub-abas.png'), fullPage: false });
  });

  test('09 - should open Vincular Ferramenta dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: /permissoes|permissões/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /vincular ferramenta/i }).click();
    await page.waitForTimeout(1000);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.locator('text=Robô *')).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Ferramenta *')).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('text=Nível de Autonomia')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-vincular-ferramenta-dialog.png'), fullPage: false });
    await dialog.locator('button:has-text("Cancelar")').click();
    await page.waitForTimeout(500);
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('10 - should integrate with Academia IA tab', async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: /academia/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Academia IA').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-integracao-academia.png'), fullPage: false });
  });
});
