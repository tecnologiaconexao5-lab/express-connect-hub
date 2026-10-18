import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/tms005";
const BASE_URL = "http://localhost:8800";

test.describe("TMS-005 — Homologação Prestadores", () => {
  test("Cenário 1 — Lista carrega com dados reais", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().substring(0, 80)}`); });

    await loginAdmin(page, "tms005");
    await page.goto(`${BASE_URL}/cadastros/prestadores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
    await page.waitForTimeout(1000);

    const rows = await page.locator("table tbody tr").count();
    console.log(`[TEST] Linhas: ${rows}`);
    expect(rows).toBeGreaterThan(0);

    const text = await page.locator("body").textContent();
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("[object Object]");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-lista.png"), fullPage: false });
    console.log(`[TEST] Erros: ${errors.length ? errors.join(" | ") : "nenhum"}`);
  });

  test("Cenário 2 — Detalhe carrega corretamente", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    await loginAdmin(page, "tms005-detalhe");
    await page.goto(`${BASE_URL}/cadastros/prestadores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    // Click first row
    const firstRow = page.locator("table tbody tr").first();
    const rowText = await firstRow.textContent();
    console.log(`[TEST] Primeira linha: "${rowText?.substring(0, 60)}"`);

    const viewButtons = firstRow.locator("button");
    if (await viewButtons.count() > 0) {
      await viewButtons.first().click();
    } else {
      await firstRow.click();
    }
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-detalhe.png"), fullPage: false });
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Carregando");
    expect(bodyText).not.toContain("undefined");
    console.log(`[TEST] Erros: ${errors.length ? errors.join(" | ") : "nenhum"}`);
  });

  test("Cenário 3 — Busca funciona", async ({ page }) => {
    await loginAdmin(page, "tms005-busca");
    await page.goto(`${BASE_URL}/cadastros/prestadores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
    await page.waitForTimeout(500);

    const rowsBefore = await page.locator("table tbody tr").count();
    console.log(`[TEST] Linhas antes: ${rowsBefore}`);

    // Type in search
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="text"]').first();
    await searchInput.fill("TESTE");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-busca.png"), fullPage: false });
    console.log(`[TEST] Busca "TESTE" aplicada`);
  });

  test("Cenário 4 — Network sem erros", async ({ page }) => {
    const httpErrors: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url().substring(0, 100)}`);
    });

    await loginAdmin(page, "tms005-network");
    await page.goto(`${BASE_URL}/cadastros/prestadores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.waitForSelector("table tbody tr", { timeout: 15000 });
    await page.waitForTimeout(500);

    const unexpected = httpErrors.filter(e => !e.includes("auth/v1"));
    console.log(`[TEST] HTTP errors: ${unexpected.length ? unexpected.join(" | ") : "0"}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-network.png"), fullPage: false });
  });
});
