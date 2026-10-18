import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

const OS_ID_PREFIX = "71e61468";

test.describe("TMS-007.4 ETAPA B — FASE B1: Interface MargemPorOS", () => {

  test("B1 — Validar todos os campos da OS HML na interface", async ({ page }) => {
    const pageErrors: string[] = [];
    const http500: string[] = [];

    page.on("pageerror", err => pageErrors.push(err.message));
    page.on("response", resp => {
      if (resp.status() >= 500) http500.push(`[${resp.status()}] ${resp.url()}`);
    });

    await loginAdmin(page, "b1");
    await page.waitForTimeout(2000);

    // Click Financeiro Enterprise in sidebar
    const sideBtn = page.locator('button:has-text("Financeiro Enterprise"), a:has-text("Financeiro Enterprise")').first();
    if (await sideBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sideBtn.click();
    } else {
      await page.goto("/financeiro", { waitUntil: "domcontentloaded", timeout: 30000 });
    }
    await page.waitForTimeout(3000);

    // Wait for "Carregando sessão" to disappear
    try {
      await expect(page.locator("body")).not.toContainText("Carregando sessão", { timeout: 15000 });
    } catch { /* timeout ok */ }

    // Click Margem por OS tab
    await page.locator('button:has-text("Margem por OS")').click();
    await page.waitForTimeout(3000);

    // Wait for table
    await page.waitForSelector('table', { timeout: 30000 });

    // Read the full table body text
    const tableText = await page.locator('table tbody').innerText();
    console.log("TABLE BODY:");
    console.log(tableText);

    // Verify all expected values are present in the table
    const expectedValues = [
      OS_ID_PREFIX,        // OS
      "04280785",          // Cliente
      "6cc41f68",          // Prestador
      "3.000,00",          // Vl. Cliente (R$ 3.000,00)
      "1.500,00",          // Vl. Prestador (-R$ 1.500,00)
      "135,00",            // Imposto
      "30,00",             // Seguro
      "80,00",             // Pedágio
      "170,00",            // Outros
      "1.250,00",          // Mg. Bruta
      "1.085,00",          // Mg. Líq.
      "36,2",              // % Margem
    ];

    const results: { campo: string; valor: string; encontrado: boolean }[] = [];

    for (const val of expectedValues) {
      const found = tableText.includes(val);
      results.push({
        campo: val,
        valor: val,
        encontrado: found,
      });
      if (!found) console.log(`MISSING: ${val}`);
    }

    // Verificar zero HTTP 500
    expect(http500).toEqual([]);

    // Verificar zero page errors com PGRST
    expect(pageErrors.filter(e => e.includes("PGRST"))).toEqual([]);

    // Verificar todos os valores encontrados
    const missing = results.filter(r => !r.encontrado);
    expect(missing).toEqual([]);

    console.log("\nALL 12 VALUES VERIFIED ✅");
  });
});
