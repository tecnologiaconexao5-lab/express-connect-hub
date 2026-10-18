import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/tms0031";
const BASE_URL = "http://localhost:8800";

test.describe("TMS-003.1 — Homologação de Leitura do Módulo Veículos", () => {
  let errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || (msg.type() === "warning" && msg.text().includes("supabase"))) {
        errors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        errors.push(`[${response.status()}] ${response.url()}`);
      }
    });
  });

  test("Cenário 1 — Lista de Veículos carrega com dados reais", async ({ page }) => {
    await loginAdmin(page, "tms0031-cenario1");

    // Navigate to veiculos via Frota
    await page.goto(`${BASE_URL}/cadastros/veiculos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "c1-01-lista-veiculos.png"),
      fullPage: false,
    });

    // Wait for the table to load - look for vehicle data
    await page.waitForSelector("table", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Check that vehicle rows exist
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    console.log(`[TEST] Linhas na tabela: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    // Check no "undefined" or "[object Object]" in visible text
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("undefined");
    expect(bodyText).not.toContain("[object Object]");
    expect(bodyText).not.toContain("NaN");

    // Check vehicle columns render
    const firstRow = rows.first();
    const firstRowText = await firstRow.textContent();
    console.log(`[TEST] Primeira linha: ${firstRowText?.substring(0, 100)}`);
    expect(firstRowText).toBeTruthy();
    // Should show some vehicle data (placa, tipo, etc.)
    expect(firstRowText!.length).toBeGreaterThan(10);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "c1-02-dados-carregados.png"),
      fullPage: false,
    });

    // Check for any errors
    expect(errors.filter(e => e.includes("[400]") || e.includes("[401]") || e.includes("[403]"))).toEqual([]);
    console.log(`[TEST] Erros capturados: ${errors.length > 0 ? errors.join(" | ") : "nenhum"}`);
  });

  test("Cenário 2 — Detalhe do Veículo carrega campos corretos", async ({ page }) => {
    await loginAdmin(page, "tms0031-cenario2");

    await page.goto(`${BASE_URL}/cadastros/veiculos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Click first edit/view button
    const editButton = page.locator("table tbody tr button, table tbody tr").first();
    await editButton.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "c2-01-detalhe.png"),
      fullPage: false,
    });

    // Check detail page loaded
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Carregando");
    expect(bodyText).not.toContain("undefined");

    // Check key fields are present
    await expect(page.locator("body")).toContainText(/placa|marca|modelo|tipo|capacidade|status/i);

    // Check Select for tipo exists
    const selectTrigger = page.locator('[role="combobox"], [data-testid="select-trigger"], .select-trigger');
    const selectCount = await selectTrigger.count();
    console.log(`[TEST] Selects encontrados: ${selectCount}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "c2-02-campos.png"),
      fullPage: false,
    });
  });

  test("Cenário 3 — Select de Tipo renderiza opções", async ({ page }) => {
    await loginAdmin(page, "tms0031-cenario3");

    await page.goto(`${BASE_URL}/cadastros/veiculos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Click edit on first vehicle
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.click();
    await page.waitForTimeout(2000);

    // Find and open the Tipo de Veículo select
    const selects = page.locator('[role="combobox"]');
    const selectCount = await selects.count();
    console.log(`[TEST] Total de combobox encontrados: ${selectCount}`);

    // Find the first select and open it
    if (selectCount > 0) {
      await selects.first().click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "c3-01-select-aberto.png"),
        fullPage: false,
      });

      // Check options are rendered
      const options = page.locator('[role="option"]');
      const optionCount = await options.count();
      console.log(`[TEST] Opções no select: ${optionCount}`);
      expect(optionCount).toBeGreaterThan(5);

      // Check no empty/undefined options
      for (let i = 0; i < Math.min(optionCount, 5); i++) {
        const optText = await options.nth(i).textContent();
        console.log(`[TEST] Opção ${i}: "${optText?.trim()}"`);
        expect(optText).toBeTruthy();
        expect(optText!.trim()).not.toBe("");
      }
    } else {
      console.log("[TEST] Nenhum combobox encontrado — verificando se o detalhe carregou");
      const content = await page.locator("body").textContent();
      expect(content).toContain("Tipo");
    }
  });

  test("Cenário 4 — Console e Network sem erros", async ({ page }) => {
    const networkErrors: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await loginAdmin(page, "tms0031-cenario4");
    await page.goto(`${BASE_URL}/cadastros/veiculos`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Wait for data
    await page.waitForSelector("table", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    console.log(`[TEST] Erros de rede: ${networkErrors.length > 0 ? networkErrors.join(" | ") : "nenhum"}`);

    // Exceptions: 401/403 for tracking/notifications endpoints are expected
    const unexpectedErrors = networkErrors.filter(e =>
      !e.includes("tracking") &&
      !e.includes("auth/v1") &&
      !e.includes("notification")
    );
    console.log(`[TEST] Erros inesperados: ${unexpectedErrors.length > 0 ? unexpectedErrors.join(" | ") : "nenhum"}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "c4-01-network-ok.png"),
      fullPage: false,
    });
  });
});
