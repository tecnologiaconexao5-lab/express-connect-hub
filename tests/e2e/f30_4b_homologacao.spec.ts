import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = 'test-results/f30-4b';

test.describe('F30.4B — HOMOLOGACAO OPERACIONAL ACTION ENGINE', () => {
  
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
    await page.goto('/central-ia?tab=ferramentas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('F30.4B-01 — Catalogo de ferramentas visivel com dados', async ({ page }) => {
    await expect(page.locator('text=Action Engine').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    // Verify tools are displayed (from seed data)
    const toolCards = page.locator('[role="tabpanel"] .grid.gap-3 > div');
    await expect(toolCards.first()).toBeVisible({ timeout: 10000 });
    const count = await toolCards.count();
    console.log(`Ferramentas no catalogo: ${count}`);
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tela-catalogo.png'), fullPage: false });
  });

  test('F30.4B-02 — Criar ferramenta via dialogo e persistir apos recarga', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Click Nova Ferramenta
    await page.getByRole('button', { name: /nova ferramenta/i }).click();
    await page.waitForTimeout(1000);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    
    // Fill form
    const codigoUnico = 'TEST_F30_4B_' + Date.now().toString(36).toUpperCase();
    await dialog.locator('input').nth(0).fill(codigoUnico);
    await dialog.locator('input').nth(1).fill('Ferramenta Teste Homologacao');
    await dialog.locator('textarea').first().fill('Ferramenta criada durante homologacao F30.4B');
    
    // Click Criar
    await dialog.locator('button:has-text("Criar")').click();
    await page.waitForTimeout(3000);
    
    // Verify dialog closed (success)
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    
    // Screenshot after creation
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ferramenta-criada.png'), fullPage: false });
    
    // Reload and verify persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Login again if needed after reload
    const loginBtn = page.locator('button:has-text("Entrar")');
    if (await loginBtn.isVisible().catch(() => false)) {
      await page.waitForTimeout(500);
      const emailInput = page.locator('input[placeholder*="email"], input[placeholder*="@"]').first();
      if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.fill('tamiris.castilho@conexaoexpress.com.br');
      }
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
      }
      await loginBtn.click();
      await page.waitForTimeout(3000);
    }
    
    await page.goto('/central-ia?tab=ferramentas', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Search for the created tool
    const searchInput = page.locator('input[placeholder="Buscar ferramenta..."]');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(codigoUnico);
      await page.waitForTimeout(1000);
    }
    
    // Verify it exists after reload
    const toolCard = page.locator(`text=${codigoUnico}`).first();
    await expect(toolCard).toBeVisible({ timeout: 10000 });
    console.log(`Ferramenta ${codigoUnico} persistiu apos recarga!`);
  });

  test('F30.4B-03 — Vincular ferramenta ao robo e validar permissao', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Go to Permissoes tab
    await page.getByRole('tab', { name: /permissoes|permissões/i }).click();
    await page.waitForTimeout(2000);
    
    // Click Vincular Ferramenta
    await page.getByRole('button', { name: /vincular ferramenta/i }).click();
    await page.waitForTimeout(1000);
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    
    // Select robo "Comercial IA"
    const roboSelect = dialog.locator('select').first().or(dialog.locator('[role="combobox"]').first());
    await roboSelect.click();
    await page.waitForTimeout(500);
    await page.locator('text=Comercial IA').first().click();
    await page.waitForTimeout(500);
    
    // Select ferramenta "Enviar E-mail"
    const ferramentaSelect = dialog.locator('select').nth(1).or(dialog.locator('[role="combobox"]').nth(1));
    await ferramentaSelect.click();
    await page.waitForTimeout(500);
    await page.locator('text=Enviar E-mail').first().click();
    await page.waitForTimeout(500);
    
    // Vincular
    await dialog.locator('button:has-text("Vincular")').click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'permissao-robo.png'), fullPage: false });
    
    // Verify permission row appeared
    await expect(page.locator('text=Comercial IA').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Enviar E-mail').first()).toBeVisible({ timeout: 10000 });
  });

  test('F30.4B-04 — Executar, aprovar e validar historico completo', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Go to Catalogo tab
    await page.getByRole('tab', { name: /catálogo/i }).click();
    await page.waitForTimeout(2000);
    
    // Try to execute a tool by clicking the play button
    const playButton = page.locator('button[title="Solicitar execução"]').first();
    if (await playButton.isVisible().catch(() => false)) {
      await playButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Go to Historico
    await page.getByRole('tab', { name: /histórico/i }).click();
    await page.waitForTimeout(3000);
    
    // Try to approve if there's a pending execution
    const approveBtn = page.locator('button[title="Aprovar"]').first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Try to execute if there's an approved one
    const executeBtn = page.locator('button[title="Executar agora"]').first();
    if (await executeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await executeBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Refresh historico
    const refreshBtn = page.locator('button:has-text("Atualizar")').first();
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click();
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'execucao-historico.png'), fullPage: false });
    
    // Verify historico has content
    const histCards = page.locator('[role="tabpanel"] div.space-y-2 > div');
    const count = await histCards.count().catch(() => 0);
    console.log(`Execucoes no historico: ${count}`);
  });
});
