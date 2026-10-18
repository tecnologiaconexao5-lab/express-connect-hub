// ============================================================
// MISSÃO 55 — CENÁRIO 2: Portal Cliente Completo
// Sidebar → Portal → Pedidos → Financeiro → Ocorrências
// → Comprovantes → Perfil → Fiscal → Relatórios
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M55-C2: Portal Cliente Completo", () => {
  async function navegarPortal(page: any) {
    await loginAdmin(page);
    await page.waitForTimeout(2000);
    const portalBtn = page.locator('button:has-text("Portal"), a:has-text("Portal Cliente")').first();
    if (await portalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await portalBtn.click();
    } else {
      await page.goto("/portal-cliente");
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(3000);
  }

  const ABAS = ["Pedidos", "Financeiro", "Ocorr", "Comprov", "Perfil", "Fiscal", "Relat"];

  for (const aba of ABAS) {
    test(`Aba ${aba} carrega dados`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await navegarPortal(page);

      const abaBtn = page.locator(`[role="tab"]:has-text("${aba}"), button:has-text("${aba}")`).first();
      if (await abaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await abaBtn.click();
        await page.waitForTimeout(2000);
      }

      await tirarScreenshot(page, `m55-c2-portal-${aba.toLowerCase()}`);
      const body = page.locator("body");
      await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
      await expect(body).not.toContainText("Carregando...", { timeout: 5000 });
      expect((await body.textContent())?.length || 0).toBeGreaterThan(100);
    });
  }
});
