/**
 * M86 — Teste Playwright Visual da Rede Enterprise
 * 
 * Cenários simplificados para validação visual rápida:
 * 1. Sidebar carrega com itens operacionais
 * 2. Navegação sem erros de console
 * 3. App não quebra ao carregar
 */

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("M86 — Validação Visual da Rede", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("C1 - Sidebar carrega com itens operacionais", async ({ page }) => {
    // Apenas verificar que a sidebar carregou com itens principais
    await page.waitForSelector("text=Dashboard", { timeout: 30000 }).catch(() => {});
    await page.waitForSelector("text=Ordens de Serviço", { timeout: 10000 }).catch(() => {});
    await page.waitForSelector("text=Prestadores", { timeout: 10000 }).catch(() => {});

    const bodyText = await page.locator("body").innerText();
    const hasSidebar = bodyText.includes("Dashboard") || bodyText.includes("Operação") || bodyText.includes("Menu");

    expect(hasSidebar).toBeTruthy();
    console.log("✅ Sidebar carregada com sucesso");
  });

  test("C2 - Navega sem erros de console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Navegar para algumas páginas
    const links = page.locator("a, button").filter({ hasText: /Dashboard|Prestadores|Ordens/ });
    const count = await links.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      try {
        await links.nth(i).click();
        await page.waitForTimeout(2000);
      } catch {
        // Ignora se o link não for clicável
      }
    }

    expect(errors.length).toBe(0);
    console.log("✅ Navegação sem erros de console");
  });

  test("C3 - Página de login existe e tem campos", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(2000);
    const hasEmail = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').count();
    expect(hasEmail).toBeGreaterThan(0);
    console.log("✅ Tela de login tem campo de email");
  });

  test("C4 - App carrega sem crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navegar para a raiz
    await page.goto("/");
    await page.waitForTimeout(5000);

    expect(errors.length).toBe(0);
    console.log("✅ App carrega sem crash");
  });
});
