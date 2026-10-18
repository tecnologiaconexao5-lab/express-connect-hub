import { test, expect } from '@playwright/test';

test.describe('F30.2 - Academia dos Funcionários Digitais IA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/central-ia', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const academiaTab = page.getByRole('tab', { name: /academia/i });
    if (await academiaTab.isVisible()) {
      await academiaTab.click();
      await page.waitForTimeout(2000);
    }
  });

  test('should load Academy dashboard with stats cards', async ({ page }) => {
    await expect(page.locator('text=Academia dos Funcionários Digitais').first()).toBeVisible({ timeout: 15000 });
    const statCards = page.locator('text=Cursos Totais,text=Materiais,text=Concluído');
    await expect(statCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should create a new curso', async ({ page }) => {
    await page.getByRole('button', { name: /novo curso/i }).click();
    await page.waitForTimeout(1000);
    await page.getByLabel(/título/i).fill('Teste Automatizado Playwright');
    await page.getByLabel(/descrição/i).fill('Curso criado por teste Playwright');
    await page.getByRole('button', { name: /salvar|criar/i }).first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Teste Automatizado Playwright').first()).toBeVisible({ timeout: 10000 });
  });

  test('should add text material to curso', async ({ page }) => {
    await page.locator('text=Teste Automatizado Playwright').first().click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /novo material|adicionar material/i }).click();
    await page.waitForTimeout(1000);
    await page.getByLabel(/título/i).fill('Material de Texto Teste');
    await page.getByRole('button', { name: /salvar/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Material de Texto Teste').first()).toBeVisible({ timeout: 10000 });
  });

  test('should change curso status to em_andamento', async ({ page }) => {
    await page.locator('text=Teste Automatizado Playwright').first().click();
    await page.waitForTimeout(1500);
    const statusSelect = page.getByRole('combobox').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.click();
      await page.getByRole('option', { name: /em andamento/i }).click();
      await page.waitForTimeout(1000);
    }
    await expect(page.locator('text=em_andamento').first().or(page.locator('text=Em Andamento').first())).toBeVisible({ timeout: 10000 });
  });
});
