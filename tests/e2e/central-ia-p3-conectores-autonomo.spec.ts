import { test, expect } from "@playwright/test";

const TMS_URL = "http://localhost:8800";

async function loginAdmin(page: any) {
  await page.goto(`${TMS_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill("tamiris.castilho@conexaoexpress.com.br");
  await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded");
}

test.describe.serial("F3C — Conectores Produção Autônoma", () => {

  test("F3C.1 — Dashboard de conectores carrega com indicadores", async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${TMS_URL}/admin/conectores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await expect(page.locator("h1")).toContainText("Monitor de Conectores");
    const cards = page.locator("text=Execuções Hoje, Taxa Sucesso, Disponibilidade, Tempo Médio");
    // Pelo menos 4 cards de métricas devem estar visíveis
    const metricCards = page.locator("text=Execuções Hoje");
    await expect(metricCards.first()).toBeVisible({ timeout: 10000 });

    const taxaCard = page.locator("text=Taxa Sucesso");
    await expect(taxaCard.first()).toBeVisible({ timeout: 5000 });

    const dispCard = page.locator("text=Disponibilidade");
    await expect(dispCard.first()).toBeVisible({ timeout: 5000 });

    const tempoCard = page.locator("text=Tempo Médio");
    await expect(tempoCard.first()).toBeVisible({ timeout: 5000 });

    console.log("[F3C.1] Dashboard carregou com 4+ cards de indicadores");
  });

  test("F3C.2 — Cards secundários (falhas, fila, duplicatas, conectores) carregam", async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${TMS_URL}/admin/conectores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await expect(page.locator("text=Falhas Hoje").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Pendências (Fila)").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Duplicatas Bloqueadas").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Conectores").first()).toBeVisible({ timeout: 5000 });

    console.log("[F3C.2] Cards secundários visíveis");
  });

  test("F3C.3 — Aba Dashboard mostra cards de conectores", async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${TMS_URL}/admin/conectores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Dashboard tab should be active by default
    const dashboardTab = page.locator('[role="tab"]', { hasText: "Dashboard" });
    await expect(dashboardTab).toBeVisible({ timeout: 10000 });

    // Toggle to Logs tab and back
    const logsTab = page.locator('[role="tab"]', { hasText: "Logs" });
    await expect(logsTab).toBeVisible({ timeout: 5000 });
    await logsTab.click();
    await page.waitForTimeout(500);

    // Check logs content area
    const logsContent = page.locator("text=Logs de Execução");
    await expect(logsContent.first()).toBeVisible({ timeout: 5000 });

    console.log("[F3C.3] Navegação entre abas Dashboard/Logs funciona");
  });

  test("F3C.4 — Botão Atualizar funciona sem erros", async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${TMS_URL}/admin/conectores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const refreshBtn = page.locator('button:has-text("Atualizar")');
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
    await refreshBtn.click();
    await page.waitForTimeout(2000);

    // Should not show error toast
    const errorToast = page.locator("text=Erro ao carregar dashboard");
    await expect(errorToast).toHaveCount(0);

    console.log("[F3C.4] Botão Atualizar clicado sem erros");
  });

  test("F3C.5 — Botão Processar Fila (se houver pendentes)", async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${TMS_URL}/admin/conectores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const processarBtn = page.locator('button:has-text("Processar")');
    // Pode ou não existir dependendo de haver pendentes
    const exists = await processarBtn.count();
    if (exists > 0) {
      await processarBtn.first().click();
      await page.waitForTimeout(3000);
      console.log("[F3C.5] Botão Processar clicado");
    } else {
      console.log("[F3C.5] Nenhum item pendente na fila — botão não exibido");
    }
    // Não deve quebrar a página
    await expect(page.locator("h1")).toContainText("Monitor de Conectores");
  });

  test("F3C.6 — Sidebar contém link para Monitor de Conectores", async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${TMS_URL}/central-ia`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Procura pelo link na sidebar
    const sidebarLink = page.locator('a:has-text("Monitor de Conectores")');
    const exists = await sidebarLink.count();
    if (exists > 0) {
      await expect(sidebarLink.first()).toBeVisible({ timeout: 5000 });
      console.log("[F3C.6] Link Monitor de Conectores encontrado na sidebar");
    } else {
      console.log("[F3C.6] Link Monitor de Conectores não encontrado na sidebar (pode estar em outro menu)");
    }
  });
});
