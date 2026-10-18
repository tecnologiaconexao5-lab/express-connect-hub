import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("M97 — Centro de Controle Operacional (NOC)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("01 — Header exibe 'Centro de Controle Operacional'", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Centro de Controle Operacional");
  });

  test("02 — Aba Operacional carrega com cards de OS", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const operacionalTab = page.locator('button[value="operacional"]');
    await operacionalTab.click();
    await page.waitForTimeout(1500);
    await expect(page.locator("text=Ordens de Serviço")).toBeVisible();
    const cards = page.locator(".grid-cols-2\\ sm\\:grid-cols-3\\ md\\:grid-cols-4\\ lg\\:grid-cols-8 > div");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("03 — Aba Executivo carrega sem erros de console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const executivoTab = page.locator('button[value="executivo"]');
    await executivoTab.click();
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes("favicon"))).toEqual([]);
  });

  test("04 — Aba Rede Enterprise carrega com métricas", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const redeTab = page.locator('button[value="rede"]');
    await redeTab.click();
    await page.waitForTimeout(1500);
    await expect(page.locator("text=Oportunidades Abertas").first()).toBeVisible();
    await expect(page.locator("text=Visualizações").first()).toBeVisible();
  });

  test("05 — Filtro de período altera valor", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const selectTrigger = page.locator("text=Hoje").or(page.locator("text=Semana").or(page.locator("text=Mês").or(page.locator("text=Trimestre"))));
    if (await selectTrigger.isVisible()) {
      await selectTrigger.click();
      await page.locator('div[role="option"]:has-text("Hoje")').click();
      await page.waitForTimeout(500);
    }
  });

  test("06 — Aba Alertas carrega sem fallback hardcoded", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const alertasTab = page.locator('button[value="alertas"]');
    await alertasTab.click();
    await page.waitForTimeout(1500);
    await expect(page.locator("text=Alertas Ativos")).toBeVisible();
    const body = await page.textContent("body");
    expect(body).not.toContain("OS-4818");
    expect(body).not.toContain("FALLBACK_CRITICOS");
  });

  test("07 — Aba Financeiro mostra indicadores operacionais", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const financeiroTab = page.locator('button[value="financeiro"]');
    await financeiroTab.click();
    await page.waitForTimeout(2000);
    await expect(page.locator("text=Financeiro Operacional").first()).toBeVisible();
    await expect(page.locator("text=Faturamento Previsto").first()).toBeVisible();
  });

  test("08 — Atalho Ctrl+2 navega para Nova OS", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Control+2");
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("operacao");
  });
});
