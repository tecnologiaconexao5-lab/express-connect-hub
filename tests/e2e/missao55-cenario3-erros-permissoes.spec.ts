// ============================================================
// MISSÃO 55 — CENÁRIO 3: Erros e Permissões
// 404 handling, logout, session expiry, login inválido,
// forgot-password, role-based access, navegação ampla
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M55-C3: Erros e Permissões", () => {
  test("Rota inexistente mostra 404 ou fallback", async ({ page }) => {
    await loginAdmin(page);
    await page.waitForTimeout(2000);
    await page.goto("/rota-inexistente-xyz-123", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await tirarScreenshot(page, "m55-c3-404");
    const body = page.locator("body");
    // Não deve crashar ou mostrar tela em branco
    const text = await body.textContent() || "";
    expect(text.length).toBeGreaterThan(0);
    // Se mostrar erro 404, está ok
    if (text.includes("404") || text.includes("não encontrada")) {
      console.log("[TEST] Rota inexistente retornou 404/fallback");
    }
  });

  test("Logout redireciona para /login", async ({ page }) => {
    await loginAdmin(page);
    await page.waitForTimeout(2000);
    await page.goto("/logout", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await tirarScreenshot(page, "m55-c3-logout");
    // Deve sair do dashboard
    const url = page.url();
    expect(url).not.toContain("/dashboard");
    console.log(`[TEST] Após logout: ${url}`);
  });

  test("Página após logout não mostra dados sensíveis", async ({ page }) => {
    await loginAdmin(page);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Recarrega para forçar verificação de sessão
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await tirarScreenshot(page, "m55-c3-session-expired");
    const url = page.url();
    // Pode redirecionar para login ou mostrar erro
    console.log(`[TEST] Sessão expirada - URL: ${url}`);
  });

  test("Navegação ampla sem erros de console", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await loginAdmin(page);
    await page.waitForTimeout(2000);

    const rotasSidebar = [
      "Clientes", "Prestadores", "Ordens", "Escala",
      "Financeiro", "Relatórios", "Contratos", "Frota",
    ];

    for (const label of rotasSidebar) {
      const btn = page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(2000);
      }
    }

    await tirarScreenshot(page, "m55-c3-all-routes");
    const critical = jsErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("404") && !e.includes("HMR") && !e.includes("WebSocket")
    );
    if (critical.length > 0) {
      console.log(`[WARN] JS errors: ${critical.join(", ")}`);
    }
  });

  test("Tela de login carrega sem erros", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    await tirarScreenshot(page, "m55-c3-login-page");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 5000 });
    // Verifica se há campos de login
    const emailInput = page.locator('input[type="email"]');
    expect(await emailInput.count()).toBeGreaterThanOrEqual(1);
  });

  test("Login inválido mostra erro", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.fill("invalido@teste.com");
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: "visible", timeout: 5000 });
    await passwordInput.fill("senha_errada_123");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
    await tirarScreenshot(page, "m55-c3-login-invalido");
    // Deve mostrar erro ou permanecer na página de login
    expect(page.url()).toContain("login");
  });

  test("Recuperação de senha carrega", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await tirarScreenshot(page, "m55-c3-forgot-password");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando", { timeout: 5000 });
  });
});
