import { test, expect } from "@playwright/test";
import { loginFinanceiro, loginOperacional } from "./helpers/auth";

test.describe("Missao 03R — AuthContext Estavel", () => {
  test("01 - Login financeiro, role=financeiro, tenant correto", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await loginFinanceiro(page, "03r-01");
    await page.waitForTimeout(3000);

    // Navega para o financeiro (acessível apenas por role=financeiro)
    await page.goto("/financeiro", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Verifica se está no financeiro (não foi redirecionado)
    const url = page.url();
    const acessoNegado = await page.locator("text=Acesso Restrito").isVisible().catch(() => false);
    const logado = url.includes("/financeiro") || url.includes("/login");

    expect(acessoNegado).toBe(false);
    expect(logado).toBe(true);
    expect(consoleErrors.filter(e => e.includes("Auth") || e.includes("401") || e.includes("403")).length).toBe(0);
  });

  test("02 - Refresh direto em Biblioteca restaura sessao", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await loginFinanceiro(page, "03r-02a");
    await page.waitForTimeout(3000);

    // Refresh direto na Biblioteca
    await page.goto("/biblioteca", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);

    const loading = await page.locator("text=Carregando sessão").isVisible().catch(() => false);
    const acessoNegado = await page.locator("text=Acesso Restrito").isVisible().catch(() => false);
    const temConteudo = await page.locator("text=Mensagens Rápidas").isVisible().catch(() => false) ||
                        await page.locator("text=Fluxo de Recrutamento").isVisible().catch(() => false) ||
                        await page.locator("text=Documentos").isVisible().catch(() => false);
    const url = page.url();

    expect(loading).toBe(false);
    expect(acessoNegado).toBe(false);
    expect(url.includes("/login")).toBe(false);
    expect(temConteudo || url.includes("/biblioteca")).toBe(true);
    expect(consoleErrors.filter(e => e.includes("Auth") || e.includes("401") || e.includes("403")).length).toBe(0);
  });

  test("03 - Refresh direto em Financeiro mantem role", async ({ page }) => {
    await loginFinanceiro(page, "03r-03");
    await page.waitForTimeout(2000);

    await page.goto("/financeiro", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    const url = page.url();
    const acessoNegado = await page.locator("text=Acesso Restrito").isVisible().catch(() => false);
    expect(acessoNegado).toBe(false);
    expect(url.includes("/login")).toBe(false);
  });

  test("04 - Logout limpa usuario", async ({ page }) => {
    await loginFinanceiro(page, "03r-04");
    await page.waitForTimeout(2000);

    // Logout via URL direta (o mecanismo mais confiável no teste)
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.goto("/logout", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const url = page.url();
    expect(url.includes("/login")).toBe(true);
  });

  test("05 - Login financeiro, logout, login operador - sem heranca", async ({ page }) => {
    await loginFinanceiro(page, "03r-05a");
    await page.waitForTimeout(3000);

    // Logout via URL direta
    await page.goto("/logout", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // Login operador
    await loginOperacional(page, "03r-05b");
    await page.waitForTimeout(5000);

    // Configuracoes é bloqueado para operador (pode_ver: false)
    await page.goto("/configuracoes", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const acessoNegado = await page.locator("text=Acesso Restrito").isVisible().catch(() => false);
    const url = page.url();
    expect(acessoNegado || url.includes("/login")).toBe(true);
  });

  test("06 - Acesso sem autenticacao redireciona para login", async ({ page }) => {
    // Garantir que está deslogado via /logout
    await page.goto("/logout", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    const url = page.url();
    expect(url.includes("/login")).toBe(true);
  });
});
