import { test, expect } from "@playwright/test";
import { loginFinanceiro } from "./helpers/auth";

test.describe("Missão 03P — Biblioteca Operacional", () => {
  test("POSITIVO: financeiro acessa /biblioteca?tab=operacional após correção D06", async ({ page }) => {
    const { usuario, role } = await loginFinanceiro(page);

    expect(usuario).toContain("financeiro");
    expect(role).toBe("financeiro");

    await page.goto("/biblioteca?tab=operacional");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Acesso Restrito")).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=Central Operacional")).toBeVisible({ timeout: 5000 });

    const logs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") logs.push(msg.text());
    });
    await page.waitForTimeout(1000);
    expect(logs.filter(l => l.includes("403") || l.includes("401") || l.includes("400")).length).toBe(0);
  });

  test("NEGATIVO: usuário sem permissão continua bloqueado", async ({ page, browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const negPage = await context.newPage();
    await negPage.goto("http://localhost:8800/login");
    await negPage.fill('input[name="email"]', "cliente@teste.com");
    await negPage.fill('input[name="password"]', "senha_errada");
    await negPage.click('button[type="submit"]');
    await negPage.waitForTimeout(1000);

    await negPage.goto("http://localhost:8800/biblioteca?tab=operacional");
    await negPage.waitForLoadState("networkidle");

    await expect(negPage.locator("text=Acesso Restrito")).toBeVisible({ timeout: 3000 });
    await context.close();
  });

  test("SIDEBAR: item Biblioteca Global visível para financeiro", async ({ page }) => {
    await loginFinanceiro(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const bibliotecaSidebar = page.locator("text=Biblioteca Global");
    await expect(bibliotecaSidebar).toBeVisible({ timeout: 5000 });
  });

  test("REDIRECT: login sem sessão vai para /login", async ({ page }) => {
    await page.goto("/biblioteca?tab=operacional");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/login");
  });
});
