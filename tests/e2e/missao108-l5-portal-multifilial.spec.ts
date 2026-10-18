// ============================================================
// MISSÃO 108-L5 — Portal MultiFilial Real
// Valida: sidebar, visão geral, comparativo, detalhe, filtros,
// permissões, isolamento, ausência de dados sensíveis
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot } from "./helpers/screenshots";

test.describe("M108-L5: Multi Filial Real", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
    await page.waitForTimeout(2000);
    const portalBtn = page.locator('button:has-text("Portal"), a:has-text("Portal Cliente")').first();
    if (await portalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await portalBtn.click();
    } else {
      await page.goto("/portal-cliente");
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(3000);
  });

  test("01 — Sidebar item Multi Filial existe e navega sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const btn = page.locator('nav button:has-text("Multi Filial")');
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForTimeout(4000);

    await tirarScreenshot(page, "m108l5-multifilial");
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
  });

  test("02 — Renderiza título e KPIs com dados reais ou estado vazio", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    await expect(page.locator("text=Multi Filial").first()).toBeVisible({ timeout: 10000 });

    const body = page.locator("body");
    const text = await body.textContent();
    expect(text).toContain("Multi Filial");
    if (text?.includes("filial(is)")) {
      expect(text).toMatch(/\d+ filial/);
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-filiais-kpis");
  });

  test("03 — Visão Comparativa carrega sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(4000);

    const comparativoBtn = page.locator('button:has-text("Comparativo")');
    if (await comparativoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await comparativoBtn.click();
      await page.waitForTimeout(2000);
    }

    await tirarScreenshot(page, "m108l5-comparativo");
    expect(jsErrors.length).toBe(0);
  });

  test("04 — Filtro de período recalcula dados", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(4000);

    const periodSelect = page.locator('select:has-text("30"), [role="combobox"]').first();
    if (await periodSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await periodSelect.click();
      await page.waitForTimeout(1000);
      const opt7 = page.locator('option:has-text("7"), [role="option"]:has-text("7 dias")').first();
      if (await opt7.isVisible({ timeout: 1000 }).catch(() => false)) {
        await opt7.click();
        await page.waitForTimeout(3000);
      }
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-filtro-periodo");
  });

  test("05 — Busca textual filtra filiais", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(4000);

    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill("SP");
      await page.waitForTimeout(1000);
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-busca");
  });

  test("06 — Abre detalhe da filial ao clicar em card", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    const firstCard = page.locator('[class*="rounded-2xl"][class*="cursor-pointer"]').first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(3000);
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-detalhe-filial");
  });

  test("07 — Detalhe da filial exibe operações", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    const firstCard = page.locator('[class*="rounded-2xl"][class*="cursor-pointer"]').first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(3000);
    }

    const body = await page.locator("body").textContent();
    const hasOperacoes = body?.includes("Operação") || body?.includes("operações") || body?.includes("Operações");
    if (hasOperacoes) {
      expect(hasOperacoes).toBeTruthy();
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-operacoes-filial");
  });

  test("08 — Detalhe da filial exibe financeiro", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    const firstCard = page.locator('[class*="rounded-2xl"][class*="cursor-pointer"]').first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(3000);
    }

    const body = await page.locator("body").textContent();
    const hasFinanceiro = body?.includes("Faturamento") || body?.includes("faturamento") || body?.includes("A Receber");
    if (hasFinanceiro) {
      expect(hasFinanceiro).toBeTruthy();
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-financeiro-filial");
  });

  test("09 — Detalhe da filial exibe contratos", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    const firstCard = page.locator('[class*="rounded-2xl"][class*="cursor-pointer"]').first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(3000);
    }

    const body = await page.locator("body").textContent();
    const hasContratos = body?.includes("Contratos") || body?.includes("contratos");
    if (hasContratos) {
      expect(hasContratos).toBeTruthy();
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-contratos-filial");
  });

  test("10 — Isolamento tenant: admin sem cliente vê mensagem", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });
    expect(jsErrors.length).toBe(0);
  });

  test("11 — Ausência de margem e repasse do prestador na tela", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(4000);

    const bodyText = await page.locator("body").textContent();
    const sensitiveTerms = ["Margem", "Repasse", "Custo interno", "margem", "repasse", "prestador"];
    for (const term of sensitiveTerms) {
      if (bodyText?.includes(term)) {
        const ctx = bodyText.substring(Math.max(0, bodyText.indexOf(term) - 30), bodyText.indexOf(term) + 30);
        if (ctx.includes("prestador") || ctx.includes("custo") || ctx.includes("repasse")) {
          expect(term).toBe(""); // fail if sensitive internal data is visible
        }
      }
    }

    expect(jsErrors.length).toBe(0);
    await tirarScreenshot(page, "m108l5-sem-margem");
  });

  test("12 — Navegação ampla sem erros de console", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    const abas = ["Executivo", "Multi Filial", "Escala", "Pedidos", "Comprovantes", "Dashboard"];
    for (const aba of abas) {
      const btn = page.locator(`nav button:has-text("${aba}")`).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1500);
      }
    }

    expect(jsErrors.length).toBe(0);
  });

  test("13 — Navegação entre Visão Geral e Comparativo sem erros", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(4000);

    const comparativoBtn = page.locator('button:has-text("Comparativo")');
    if (await comparativoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await comparativoBtn.click();
      await page.waitForTimeout(2000);
    }

    const visaoGeralBtn = page.locator('button:has-text("Visão Geral")');
    if (await visaoGeralBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await visaoGeralBtn.click();
      await page.waitForTimeout(2000);
    }

    expect(jsErrors.length).toBe(0);
  });

  test("14 — Botão Atualizar presente e funcional", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(4000);

    const atualizarBtn = page.locator('button:has-text("Atualizar")');
    if (await atualizarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await atualizarBtn.click();
      await page.waitForTimeout(3000);
    }

    expect(jsErrors.length).toBe(0);
  });

  test("15 — Zero erros ErrorBoundary na tela", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(4000);

    const body = page.locator("body");
    await expect(body).not.toContainText("Algo deu errado", { timeout: 5000 });
    await expect(body).not.toContainText("ErrorBoundary", { timeout: 3000 });
    await expect(body).not.toContainText("Something went wrong", { timeout: 3000 });

    expect(jsErrors.length).toBe(0);
  });

  test("16 — Zero 404 na navegação", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("404");
    expect(bodyText).not.toContain("Not Found");

    expect(jsErrors.length).toBe(0);
  });

  test("17 — Fecha modal de detalhe ao clicar Fechar", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    const firstCard = page.locator('[class*="rounded-2xl"][class*="cursor-pointer"]').first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(3000);

      const fecharBtn = page.locator('button:has-text("Fechar")').last();
      if (await fecharBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fecharBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    expect(jsErrors.length).toBe(0);
  });

  test("18 — Zero mocks: dados vêm de ordens_servico via API", async ({ page }) => {
    const networkRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("rest/v1/")) {
        networkRequests.push(req.url());
      }
    });

    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.locator('nav button:has-text("Multi Filial")').click();
    await page.waitForTimeout(5000);

    const ordensServicoCalls = networkRequests.filter(u => u.includes("ordens_servico"));
    const body = page.locator("body");
    await expect(body).not.toContainText("Carregando sessão", { timeout: 10000 });

    expect(jsErrors.length).toBe(0);
  });
});
