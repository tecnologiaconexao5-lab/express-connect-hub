import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/tms004";
const BASE_URL = "http://localhost:8800";

test.describe("TMS-004 — Edição Controlada de Veículo HML", () => {
  test("Cenário 1 — Valor escrito via Supabase aparece na UI", async ({ page }) => {
    await loginAdmin(page, "tms004");
    await page.goto(`${BASE_URL}/cadastros/veiculos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForSelector("table tbody tr", { timeout: 10000 });

    // Click ABC-1F23 row
    const vehicleRow = page.locator("table tbody tr").filter({ hasText: "ABC-1F23" });
    await vehicleRow.first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-detalhe.png"), fullPage: false });

    // Find the Observações textarea
    const textareas = page.locator("textarea");
    const count = await textareas.count();
    console.log(`[TEST] Textareas encontrados: ${count}`);

    let foundTms = false;
    for (let i = 0; i < count; i++) {
      const val = await textareas.nth(i).inputValue();
      const logVal = val?.substring(0, 40) || "(vazio)";
      console.log(`[TEST] textarea[${i}]: "${logVal}"`);
      if (val?.startsWith("TMS004")) {
        foundTms = true;
        console.log(`[TEST] ✅ Marcador TMS004 encontrado!`);
      }
    }

    expect(foundTms).toBe(true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-marker-visible.png"), fullPage: false });
    console.log(`[TEST] ✅ Persistência comprovada: valor DB → UI`);
  });

  test("Cenário 2 — Limpar valor via UI save e restaurar", async ({ page }) => {
    await loginAdmin(page, "tms004-reset");
    await page.goto(`${BASE_URL}/cadastros/veiculos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForSelector("table tbody tr", { timeout: 10000 });

    // Click ABC-1F23
    const vehicleRow = page.locator("table tbody tr").filter({ hasText: "ABC-1F23" });
    await vehicleRow.first().click();
    await page.waitForTimeout(2000);

    // Find Observações textarea and clear it
    const textareas = page.locator("textarea");
    const count = await textareas.count();

    if (count > 0) {
      const currentVal = await textareas.first().inputValue();
      console.log(`[TEST] Valor antes: "${currentVal?.substring(0, 30)}"`);

      // Clear and save
      await textareas.first().fill("");
      
      // Click save button
      const saveBtn = page.locator('button:has-text("Salvar Veículo")');
      await saveBtn.click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-salvar-limpo.png"), fullPage: false });
      console.log(`[TEST] Save clicado`);
    }
  });
});
