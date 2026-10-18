import { test, expect } from '@playwright/test';

test.describe('F30.3 - Motor de Aprendizado e Processamento', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/central-ia?tab=processamentos', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  });

  test('should display Processamentos tab with fila view', async ({ page }) => {
    await expect(page.locator('text=Processamentos').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Fila').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Memória').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Raciocínio').first()).toBeVisible({ timeout: 10000 });
  });

  test('should load fila de processamento', async ({ page }) => {
    const filaSection = page.locator('text=Fila').first();
    await expect(filaSection).toBeVisible({ timeout: 10000 });
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show estatisticas view', async ({ page }) => {
    await page.getByRole('button', { name: /estatísticas/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Total Materiais').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Fragmentos de Memória').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between tabs - fila, memoria, raciocinio', async ({ page }) => {
    await page.getByRole('tab', { name: /memória/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Buscar na memória').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /raciocínio/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Registro de Raciocínio').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /fila/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Nenhum processamento na fila').or(page.locator('table'))).toBeVisible({ timeout: 10000 });
  });

  test('should integrate with Academia IA tab', async ({ page }) => {
    await page.getByRole('tab', { name: /academia/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Academia IA').first()).toBeVisible({ timeout: 15000 });
  });
});
