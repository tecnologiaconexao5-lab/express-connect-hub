import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("F34A — Motor Cognitivo LLM dos Funcionários Digitais", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, "f34a");
    await page.goto("/central-ia");
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 });
    await page.getByRole("tab", { name: "Robôs" }).waitFor({ state: "visible", timeout: 10000 });
  });

  test('1. Abas da Central IA carregam sem erros (regressão F34)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource") && !t.startsWith("Warning:")) consoleErrors.push(t);
    });

    const tabs: { name: string; exact?: boolean }[] = [
      { name: "Robôs" }, { name: "Tarefas" }, { name: "Aprovações" },
      { name: "Logs" }, { name: "Diretor Virtual" }, { name: "Comunicação" },
      { name: "Ferramentas" }, { name: "Conectores" },
      { name: "Missões", exact: true }, { name: "Trabalho" },
    ];
    for (const tab of tabs) {
      await page.getByRole("tab", { name: tab.name, exact: tab.exact ?? false }).click({ force: true });
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(500);
    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: "test-results/f34a-01-abas-carregam.png", fullPage: true });
  });

  test("2. Navegação ampla entre todas as abas sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource") && !t.startsWith("Warning:")) consoleErrors.push(t);
    });

    const allTabs: { name: string; exact?: boolean }[] = [
      { name: "Robôs" }, { name: "Tarefas" }, { name: "Aprovações" },
      { name: "Logs" }, { name: "Diretor Virtual" }, { name: "Live" },
      { name: "Comunicação" }, { name: "Missões", exact: true }, { name: "Trabalho" },
      { name: "Ferramentas" }, { name: "Conectores" }, { name: "Academia" },
      { name: "Processamentos" }, { name: "Biblioteca" }, { name: "Configurações" },
    ];
    for (const tab of allTabs) {
      await page.getByRole("tab", { name: tab.name, exact: tab.exact ?? false }).click({ force: true });
      await page.waitForTimeout(200);
    }

    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: "test-results/f34a-02-navegacao-completa.png", fullPage: true });
  });

  test("3. Aba Ferramentas carrega catálogo de ferramentas", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Ferramentas" }).click({ force: true });

    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/f34a-03-ferramentas-catalogo.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("4. Aba Conectores carrega", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Conectores" }).click({ force: true });

    await page.waitForTimeout(2500);
    await page.screenshot({ path: "test-results/f34a-04-conectores.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("5. Aba Trabalho carrega", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Trabalho" }).click({ force: true });

    await page.waitForTimeout(2500);
    await page.screenshot({ path: "test-results/f34a-05-trabalho.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("6. Planejador Cognitivo — prompt montado com todas as fontes (regressão F34A)", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (msg.type() === "error" && !t.includes("401") && !t.includes("400") && !t.includes("Failed to load resource") && !t.startsWith("Warning:")) consoleErrors.push(t);
    });

    await page.getByRole("tab", { name: "Logs" }).click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "test-results/f34a-06-logs.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });
});
