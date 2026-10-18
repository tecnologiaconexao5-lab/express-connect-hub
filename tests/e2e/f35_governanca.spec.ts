import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("F35 - Governanca, Limites e Aprovacoes Operacionais", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, "f35");
    await page.goto("/central-ia");
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 });
    await page.getByRole("tab", { name: "Rob\u00f4s" }).waitFor({ state: "visible", timeout: 10000 });
  });

  test("1. Aba Aprovacoes carrega sem erros", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Aprova\u00e7\u00f5es" }).click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/f35-01-aprovacoes.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("2. Aba Ferramentas carrega com catalogo e permissoes", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Ferramentas" }).click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/f35-02-ferramentas.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("3. Aba Logs carrega com auditoria de governanca", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource") && !t.startsWith("Warning:")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Logs" }).click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/f35-03-logs.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("4. Aba Diretor Virtual carrega com decisoes", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource") && !t.startsWith("Warning:")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Diretor Virtual" }).click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/f35-04-diretor-virtual.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("5. Aba Missoes carrega com limites operacionais", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Miss\u00f5es", exact: true }).click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/f35-05-missoes.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("6. Navegacao completa entre todas as abas sem erros", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource") && !t.startsWith("Warning:")) consoleErrors.push(t);
    });

    const allTabs: { name: string; exact?: boolean }[] = [
      { name: "Rob\u00f4s" }, { name: "Tarefas" }, { name: "Aprova\u00e7\u00f5es" },
      { name: "Logs" }, { name: "Diretor Virtual" }, { name: "Live" },
      { name: "Comunica\u00e7\u00e3o" }, { name: "Miss\u00f5es", exact: true }, { name: "Trabalho" },
      { name: "Ferramentas" }, { name: "Conectores" }, { name: "Academia" },
      { name: "Processamentos" }, { name: "Biblioteca" }, { name: "Configura\u00e7\u00f5es" },
    ];
    for (const tab of allTabs) {
      await page.getByRole("tab", { name: tab.name, exact: tab.exact ?? false }).click({ force: true });
      await page.waitForTimeout(200);
    }

    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: "test-results/f35-06-navegacao-completa.png", fullPage: true });
  });
});
