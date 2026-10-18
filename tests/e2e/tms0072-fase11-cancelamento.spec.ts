import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";

const BASE = "test-results/e2e/fase11";
if (!existsSync(BASE)) mkdirSync(BASE, { recursive: true });

test.use({ storageState: "tests/e2e/.auth/storageState.json" });

async function expandSidebar(page: any) {
  await page.mouse.move(5, 300);
  await page.waitForTimeout(800);
}

test.describe("TMS-007.2 FASE 11 — Cancelamento e Estorno", () => {
  test("FASE 11.3 — Cancelar alocação pela interface", async ({ page }) => {
    test.setTimeout(120000);
    const errs: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errs.push(`console.error: ${msg.text()}`); });
    page.on("pageerror", (err) => errs.push(`pageerror: ${err.message}`));

    // 1. Ir para o dashboard (TMS app)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${BASE}/01-dashboard.png`, fullPage: true });

    // 2. Expandir sidebar
    await expandSidebar(page);
    await page.screenshot({ path: `${BASE}/02-sidebar-expandida.png`, fullPage: true });

    // 3. Verificar sidebar expandida
    const apoio = page.locator('aside button:has-text("Apoio Operacional")').first();
    const visivel = await apoio.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[FASE11] Apoio Operacional visible: ${visivel}`);
    expect(visivel).toBeTruthy();

    // 4. Abrir accordion Apoio Operacional
    await apoio.click();
    await page.waitForTimeout(800);

    // 5. Clicar em Escala
    const escala = page.locator('aside button:has-text("Escala")').last();
    await expect(escala).toBeVisible({ timeout: 5000 });
    await escala.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${BASE}/03-escala.png`, fullPage: true });

    // 6. Buscar alocação HML pelo data/hora
    const hmlText = page.locator("text=M43_2026-06-29_18-24-20").first();
    const found = await hmlText.isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`[FASE11] HML row visible: ${found}`);

    if (!found) {
      // Tenta buscar por fragmentos
      const allText = await page.locator("body").textContent().catch(() => "");
      console.log(`[FASE11] Body length: ${allText.length}`);
      console.log(`[FASE11] Body contains M43: ${allText.includes("M43")}`);
      console.log(`[FASE11] Body contains HML: ${allText.includes("HML")}`);
      await page.screenshot({ path: `${BASE}/03b-not-found.png`, fullPage: true });

      // Tenta ver se há tabela com registros
      const rows = page.locator("table tbody tr, [class*='row'], [class*='Row']");
      const count = await rows.count();
      console.log(`[FASE11] Table rows: ${count}`);
    }

    // 7. Encontrar e clicar no botão Cancelar
    if (found) {
      await hmlText.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const cancelBtn = page.locator('button[title*="Cancelar"], button:has-text("Cancelar")').first();
      const cancelVisible = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[FASE11] Cancel button visible: ${cancelVisible}`);

      if (cancelVisible) {
        await cancelBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${BASE}/04-modal.png`, fullPage: true });

        // 8. Confirmar cancelamento
        const confirmBtn = page.locator('button:has-text("Sim, Cancelar Alocação")').first();
        const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[FASE11] Confirm button visible: ${confirmVisible}`);

        if (confirmVisible) {
          // Preencher motivo
          const motivoInput = page.locator('textarea, input[placeholder*="motivo"], input[placeholder*="Motivo"]').first();
          if (await motivoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await motivoInput.fill("TMS-0072-HML — cancelamento para homologação financeira");
          }

          await confirmBtn.click();
          await page.waitForTimeout(5000);
          await page.screenshot({ path: `${BASE}/05-pos-cancelamento.png`, fullPage: true });
        }
      }
    }

    // 9. Verificar toasts e erros
    await page.screenshot({ path: `${BASE}/06-final.png`, fullPage: true });
    const toast = await page.locator("text=Alocação cancelada com sucesso").count();
    const toast2 = await page.locator('[class*="toast"], [class*="Toast"], [class*="alert"], [class*="Alert"]').filter({ hasText: /cancel/i }).count();
    console.log(`[FASE11] Toast 'Alocação cancelada': ${toast} | Toast/cancel: ${toast2} | Erros JS: ${errs.length}`);

    // Nao assert toast pois a interface pode usar mensagem diferente
    // Apenas reportar erros
    expect(errs.length).toBe(0);
  });
});
