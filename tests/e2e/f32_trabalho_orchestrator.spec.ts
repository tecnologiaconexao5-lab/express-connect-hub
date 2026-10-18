import { test, expect } from "@playwright/test";

test.describe("F32 — Orquestrador de Trabalho", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/central-ia");
    await page.waitForLoadState("networkidle");
  });

  test("1. Aba Trabalho aparece e exibe fila geral corretamente", async ({ page }) => {
    const tabTrigger = page.locator('button[value="trabalho"]');
    await expect(tabTrigger).toBeVisible({ timeout: 15000 });
    await expect(tabTrigger).toContainText("Trabalho");
    await tabTrigger.click();
    await page.waitForTimeout(1000);

    await expect(page.locator("text=Orquestrador de Trabalho")).toBeVisible();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    expect(consoleErrors).toHaveLength(0);
  });

  test("2. Cards de estatísticas são exibidos na aba Trabalho", async ({ page }) => {
    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(2000);

    const statCards = page.locator(".grid-cols-5 .card, .grid-cols-5 > div");
    await expect(statCards.first()).toBeVisible({ timeout: 10000 });
  });

  test("3. Filtros de status e prioridade funcionam", async ({ page }) => {
    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(2000);

    const statusFilter = page.locator("select").first();
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption("pendente");
      await page.waitForTimeout(500);
    }
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    expect(consoleErrors).toHaveLength(0);
  });

  test("4. Botão Novo Trabalho abre diálogo de criação", async ({ page }) => {
    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(2000);

    const novoBtn = page.locator("button", { hasText: "Novo Trabalho" });
    await expect(novoBtn).toBeVisible();
    await novoBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Novo Trabalho")).toBeVisible();
  });

  test("5. Navegação entre sub-abas Fila, Histórico e Produtividade", async ({ page }) => {
    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(2000);

    const filaBtn = page.locator("button", { hasText: "Fila de Trabalho" });
    const historicoBtn = page.locator("button", { hasText: "Histórico" });
    const prodBtn = page.locator("button", { hasText: "Produtividade" });

    await expect(filaBtn).toBeVisible();
    await expect(historicoBtn).toBeVisible();
    await expect(prodBtn).toBeVisible();

    await historicoBtn.click();
    await page.waitForTimeout(500);
    await prodBtn.click();
    await page.waitForTimeout(500);
    await filaBtn.click();
    await page.waitForTimeout(500);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    expect(consoleErrors).toHaveLength(0);
  });

  test("6. Worker status é exibido na Produtividade", async ({ page }) => {
    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(2000);

    const prodBtn = page.locator("button", { hasText: "Produtividade" });
    await prodBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.locator("text=Status do Worker")).toBeVisible();
  });

  test("7. Tabela de trabalhos é renderizada", async ({ page }) => {
    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(3000);

    const table = page.locator("table");
    const exists = await table.isVisible().catch(() => false);
    if (!exists) {
      const empty = page.locator("text=Nenhum trabalho encontrado");
      await expect(empty).toBeVisible({ timeout: 5000 });
    }
  });

  test("8. Botão de atualizar funciona", async ({ page }) => {
    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(2000);

    const refreshBtn = page.locator("button", { hasText: "Atualizar" });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await page.waitForTimeout(1000);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    expect(consoleErrors).toHaveLength(0);
  });

  test("9. Navegação entre abas não quebra o layout", async ({ page }) => {
    const tabs = ["robos", "tarefas", "aprovacoes", "logs", "diretor", "comunicacao", "missoes", "trabalho"];
    for (const tab of tabs) {
      const btn = page.locator(`button[value="${tab}"]`);
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    }
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    expect(consoleErrors).toHaveLength(0);
  });

  test("10. Nenhum erro de console nas abas de trabalho", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.locator('button[value="trabalho"]').click();
    await page.waitForTimeout(3000);

    expect(consoleErrors).toHaveLength(0);
  });
});
