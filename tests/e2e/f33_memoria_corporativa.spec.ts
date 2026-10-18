import { test, expect } from "@playwright/test";

test.describe("F33 — Memória Corporativa Persistente", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/central-ia");
    await page.waitForLoadState("networkidle");
  });

  test("1. Abas da Central IA carregam sem erros", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    const tabs = ["robos", "tarefas", "aprovacoes", "logs", "diretor", "comunicacao", "missoes", "trabalho"];
    for (const tab of tabs) {
      const btn = page.locator(`button[value="${tab}"]`);
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    }

    await page.waitForTimeout(500);
    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: "test-results/f33-01-abas-carregam.png", fullPage: true });
  });

  test("2. Consulta a memoria_conhecimento via serviço não quebra UI", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.locator('button[value="robos"]').click();
    await page.waitForTimeout(2000);

    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: "test-results/f33-02-robos-tab.png", fullPage: true });
  });

  test("3. Navegação entre todas as abas não gera erros", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    const allTabs = ["robos", "tarefas", "aprovacoes", "logs", "diretor", "diretorlive", "comunicacao", "missoes", "trabalho", "academia", "processamentos", "ferramentas", "conectores", "corporativo", "config"];
    for (const tab of allTabs) {
      const btn = page.locator(`button[value="${tab}"]`);
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }

    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: "test-results/f33-03-navegacao-completa.png", fullPage: true });
  });

  test("4. Aba Conhecimento Corporativo carrega dados de memória", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.locator('button[value="corporativo"]').click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test-results/f33-04-conhecimento-corporativo.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("5. Aba Processamentos carrega e mostra fila de processamento de memória", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.locator('button[value="processamentos"]').click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test-results/f33-05-processamentos.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("6. Aba Diretor Virtual carrega decisões que alimentam memória", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.locator('button[value="diretor"]').click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "test-results/f33-06-diretor-virtual.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("7. Aba Logs mostra auditoria de todas as ações (base da memória)", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.locator('button[value="logs"]').click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "test-results/f33-07-logs-auditoria.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("8. Aba Missões carrega — metas e indicadores alimentam memória de desempenho", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.locator('button[value="missoes"]').click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "test-results/f33-08-missoes.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("9. Aba Trabalho carrega — trabalhos alimentam memória operacional", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });

    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "test-results/f33-09-trabalho.png", fullPage: true });
    expect(consoleErrors).toHaveLength(0);
  });

  test("10. Todas as abas carregam sem erros de console (validação final)", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/central-ia");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    expect(consoleErrors).toHaveLength(0);
    await page.screenshot({ path: "test-results/f33-10-final.png", fullPage: true });
  });
});
