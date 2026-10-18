import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/tms005-edit";

test.describe("TMS-005 Edit", () => {
  test("Cenário — Edição controlada de prestador HML", async ({ page }) => {
    await loginAdmin(page, "tms005-edit");
    await page.goto("http://localhost:8800/cadastros/prestadores", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    // Search for the test candidate
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="text"]').first();
    await searchInput.fill("M43_2026");
    await page.waitForTimeout(1500);

    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    console.log(`[TEST] Linhas encontradas: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    // Open first match
    await rows.first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-detalhe.png"), fullPage: false });

    // Find observacoes field
    const textareas = page.locator("textarea");
    const taCount = await textareas.count();

    let found = false;
    for (let i = 0; i < taCount; i++) {
      const val = await textareas.nth(i).inputValue();
      console.log(`[TEST] textarea[${i}]: "${val?.substring(0, 40)}"`);
      if (val?.startsWith("TMS005-EDICAO")) {
        found = true;
        console.log(`[TEST] ✅ Marcador TMS005 encontrado!`);
      }
    }

    expect(found).toBe(true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-marker-visible.png"), fullPage: false });
    console.log(`[TEST] ✅ Persistência comprovada: DB → UI`);
  });
});
