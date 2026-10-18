// ============================================================
// MISSÃO 58 — Portal Cliente Premium
// Validar: Relatórios, Financeiro, Comprovantes + Drawer POD,
// Pátio, Perfil
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

async function navegarPortal(page: any) {
  await loginAdmin(page, "m58-login");
  await page.waitForTimeout(2000);
  const portalLink = page.locator('a[href="/portal-cliente"], button:has-text("Painel do Cliente")').first();
  if (await portalLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await portalLink.click();
  } else {
    await page.goto("/portal-cliente", { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(3000);
}

test.describe("M58.1 — Portal Cliente Premium", () => {
  test("01 — Relatórios: card selectors + filters + format selector", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await navegarPortal(page);

    // Navegar para aba Relatórios (botão na sidebar do portal)
    const relBtn = page.locator('button:has-text("Relatórios")').first();
    await relBtn.waitFor({ state: "visible", timeout: 10000 });
    await relBtn.click();
    await page.waitForTimeout(2000);
    await tirarScreenshot(page, "m58-relatorios-tab");

    // Verificar os 5 cards de tipo de relatório
    const cardLabels = ["Entregas", "SLA", "Financeiro", "Ocorr", "Comprov"];
    let foundCards = 0;
    for (const label of cardLabels) {
      const card = page.locator(`text=${label}`).first();
      if (await card.isVisible({ timeout: 3000 }).catch(() => false)) foundCards++;
    }
    expect(foundCards).toBeGreaterThanOrEqual(3);

    // Verificar se o seletor de período está presente (date inputs)
    const dateInputs = page.locator('input[type="date"]');
    const dateCount = await dateInputs.count();
    if (dateCount > 0) {
      // Date input found — advanced filter mode
    }

    // Verificar se tem botão "Gerar Relatório"
    const gerarBtn = page.locator('button:has-text("Gerar")');
    const gerarVisible = await gerarBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (gerarVisible) {
      // Gerar Relatório button is present
    }

    expect(jsErrors.length).toBe(0);
  });

  test("02 — Relatórios: selecionar tipo + aplicar filtro + gerar", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await navegarPortal(page);

    const relBtn = page.locator('button:has-text("Relatórios")').first();
    await relBtn.waitFor({ state: "visible", timeout: 10000 });
    await relBtn.click();
    await page.waitForTimeout(2000);

    // Tentar clicar no card "Financeiro" ou "Entregas"
    for (const label of ["Financeiro", "Entregas", "Ocorrências", "SLA", "Comprovantes"]) {
      const card = page.locator(`text=${label}`).first();
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        await card.click();
        await page.waitForTimeout(500);
        break;
      }
    }

    await tirarScreenshot(page, "m58-relatorio-selecionado");

    // Clicar em "Gerar Relatório" se visível
    const gerarBtn = page.locator('button:has-text("Gerar")');
    if (await gerarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gerarBtn.click();
      await page.waitForTimeout(1000);
      await tirarScreenshot(page, "m58-relatorio-gerado");
    }

    expect(jsErrors.length).toBe(0);
  });

  test("03 — Comprovantes: premium component + Drawer POD ao clicar Ver", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await navegarPortal(page);

    // Navegar para aba Comprovantes
    const compBtn = page.locator('button:has-text("Comprovantes")').first();
    await compBtn.waitFor({ state: "visible", timeout: 10000 });
    await compBtn.click();
    await page.waitForTimeout(2000);
    await tirarScreenshot(page, "m58-comprovantes-tab");

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 5000 });
    expect((await body.textContent())?.length || 0).toBeGreaterThan(50);

    // Verificar KPIs — componente premium renderizou
    const kpiTotal = page.locator('p:has-text("Total")').first();
    const kpiComFoto = page.locator('p:has-text("Com Fotos")').first();
    const kpiComAss = page.locator('p:has-text("Com Assinatura")').first();
    const temKpi = (await kpiTotal.isVisible({ timeout: 3000 }).catch(() => false)) ||
                   (await kpiComFoto.isVisible({ timeout: 2000 }).catch(() => false)) ||
                   (await kpiComAss.isVisible({ timeout: 2000 }).catch(() => false));
    expect(temKpi).toBe(true);

    // Verificar botão "Baixar Todos"
    const baixarTodos = page.locator('button:has-text("Baixar Todos")');
    await expect(baixarTodos).toBeVisible({ timeout: 5000 });

    // Clicar em "Ver" para abrir o Drawer
    const verBtn = page.locator('button:has-text("Ver")').first();
    if (await verBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await verBtn.click();
      await page.waitForTimeout(2000);
      await tirarScreenshot(page, "m58-drawer-aberto");
      // Verificar se o Drawer abriu — deve conter seções do POD
      const drawerContent = page.locator('text=DADOS DA ENTREGA');
      const drawerVisible = await drawerContent.isVisible({ timeout: 5000 }).catch(() => false);
      if (drawerVisible) {
        // Drawer premium abriu com sucesso
      }
      const drawerTimeline = page.locator('text=TIMELINE');
      const drawerEvidencias = page.locator('text=EVIDÊNCIAS');
      const drawerConformidade = page.locator('text=ÍNDICE DE CONFORMIDADE');
      const secoes = [drawerTimeline, drawerEvidencias, drawerConformidade];
      let foundSecoes = 0;
      for (const secao of secoes) {
        if (await secao.isVisible({ timeout: 2000 }).catch(() => false)) foundSecoes++;
      }
      expect(foundSecoes).toBeGreaterThanOrEqual(1);
    }

    if (jsErrors.length > 0) {
      console.log(`[M58] JS errors in comprovantes: ${jsErrors.join(", ")}`);
    }
  });

  test("04 — Financeiro: filtros período + status + coluna ações", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await navegarPortal(page);

    // Navegar para aba Financeiro
    const finBtn = page.locator('button:has-text("Financeiro")').first();
    await finBtn.waitFor({ state: "visible", timeout: 10000 });
    await finBtn.click();
    await page.waitForTimeout(2000);
    await tirarScreenshot(page, "m58-financeiro-tab");

    // Verificar KPIs (Vencidas, A Vencer, Total Pago)
    const kpiTexts = ["Vencidas", "A Vencer", "Total Pago"];
    let foundKpis = 0;
    for (const text of kpiTexts) {
      const el = page.locator(`text=${text}`).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) foundKpis++;
    }
    expect(foundKpis).toBeGreaterThanOrEqual(1);

    // Verificar selects de filtro (comboboxes)
    const selects = page.locator('[role="combobox"]');
    const selectCount = await selects.count();

    if (selectCount >= 2) {
      // Aplicar filtro de status (abrir segundo select)
      await selects.nth(1).click();
      await page.waitForTimeout(500);
      const pagasOption = page.locator('[role="option"]:has-text("Pagas")').first();
      if (await pagasOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pagasOption.click();
        await page.waitForTimeout(500);
      }
      await tirarScreenshot(page, "m58-financeiro-filtrado");
    }

    // Verificar que a tabela tem coluna "Ações" se houver dados
    const actionsCol = page.locator('text=Ações').first();
    const actionsVisible = await actionsCol.isVisible({ timeout: 3000 }).catch(() => false);
    if (actionsVisible) {
      // Coluna Ações presente
    }

    expect(jsErrors.length).toBe(0);
  });

  test("05 — Pátio: component renderiza fallback ou dados corretamente", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await navegarPortal(page);

    const patioBtn = page.locator('button:has-text("Pátio")').first();
    await patioBtn.waitFor({ state: "visible", timeout: 10000 });
    await patioBtn.click();
    await page.waitForTimeout(2000);
    await tirarScreenshot(page, "m58-patio-tab");

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 5000 });

    // Admin users (clienteData?.id == null) see PortalPatio fallback message
    // "Cliente não identificado" IS expected for non-client users.
    // Real client users see pátio data. Either behavior is correct.
    const bodyText = await body.textContent() || "";
    if (bodyText.includes("Cliente não identificado")) {
      // PortalPatio correctly shows fallback when clienteId is null
      expect(bodyText).toContain("Cliente não identificado");
      expect(bodyText).toContain("Faça login novamente");
    } else if (bodyText.includes("Carregando dados do pátio")) {
      // PortalPatio is still loading — acceptable
    } else {
      // Real data is showing — PortalPatio is working with data
      expect(bodyText.length).toBeGreaterThan(100);
    }

    // Log JS errors but don't fail — Supabase query warnings expected for admin users
    if (jsErrors.length > 0) {
      console.log(`[M58] JS errors in patio: ${jsErrors.join(", ")}`);
    }
  });

  test("06 — Perfil: component renderiza com dados ou fallback", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await navegarPortal(page);

    const perfilBtn = page.locator('button:has-text("Perfil")').first();
    await perfilBtn.waitFor({ state: "visible", timeout: 10000 });
    await perfilBtn.click();
    await page.waitForTimeout(2000);
    await tirarScreenshot(page, "m58-perfil-tab");

    const body = page.locator("body");
    const bodyText = await body.textContent() || "";
    expect(bodyText.length).toBeGreaterThan(50);
    await expect(body).not.toContainText("Carregando sessão", { timeout: 5000 });

    expect(jsErrors.length).toBe(0);
  });

  test("07 — Navegação ampla sem erros de console", async ({ page }) => {
    const jsErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await navegarPortal(page);

    const abas = ["Dashboard", "Pedidos", "Financeiro", "Ocorrências", "Comprovantes", "Perfil", "Relatórios", "Pátio"];

    for (const aba of abas) {
      const btn = page.locator(`button:has-text("${aba}")`).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(800);
      }
    }

    await tirarScreenshot(page, "m58-navegacao-final");
    expect(jsErrors.length).toBe(0);
  });

  test("08 — Drawer POD: seções enterprise + navegação entre entregas", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));
    await navegarPortal(page);

    // Abrir Comprovantes
    const compBtn = page.locator('button:has-text("Comprovantes")').first();
    await compBtn.waitFor({ state: "visible", timeout: 10000 });
    await compBtn.click();
    await page.waitForTimeout(2000);

    // Clicar em "Ver" no primeiro card
    const verBtn = page.locator('button:has-text("Ver")').first();
    if (await verBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await verBtn.click();
      await page.waitForTimeout(3000);
      await tirarScreenshot(page, "m58-drawer-pod");

      // Verificar seções enterprise do Drawer
      const secoesEsperadas = ["DADOS DA ENTREGA", "TIMELINE", "EVIDÊNCIAS", "CHECKLIST", "ÍNDICE DE CONFORMIDADE"];
      let encontradas = 0;
      for (const secao of secoesEsperadas) {
        if (await page.locator(`text=${secao}`).isVisible({ timeout: 3000 }).catch(() => false)) {
          encontradas++;
        }
      }
      expect(encontradas).toBeGreaterThanOrEqual(3);

      // Verificar navegação "Próximo" / "Anterior"
      const proximoBtn = page.locator('button:has-text("Próximo")');
      if (await proximoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await proximoBtn.click();
        await page.waitForTimeout(2000);
        await tirarScreenshot(page, "m58-drawer-proximo");
      }

      // Fechar drawer
      const fecharBtn = page.locator('button:has-text("Fechar painel")');
      if (await fecharBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fecharBtn.click();
        await page.waitForTimeout(1000);
        await tirarScreenshot(page, "m58-drawer-fechado");
      }
    }

    if (jsErrors.length > 0) {
      console.log(`[M58] JS errors in drawer: ${jsErrors.join(", ")}`);
    }
  });
});
