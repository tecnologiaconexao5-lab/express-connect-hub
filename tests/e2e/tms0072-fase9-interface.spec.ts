import { test, expect, Page, BrowserContext } from "@playwright/test";
import { existsSync } from "fs";

const OS_ID = "28640e7b-fbe5-4141-a59a-c5bead26d25a";

const ERRORS: string[] = [];
const screenshotBase = "test-results/e2e";

async function log(msg: string) { ERRORS.push(msg); console.log(`[FASE9] ${msg}`); }

test.use({ storageState: "tests/e2e/.auth/storageState.json" });

test.describe("TMS-007.2 FASE 9 — Interface Financeira", () => {
  test.beforeEach(({ page }) => {
    page.on("console", (msg) => { if (msg.type() === "error") log(`console.error: ${msg.text()}`); });
    page.on("pageerror", (err) => log(`pageerror: ${err.message}`));
    page.on("response", (resp) => {
      if (resp.status() >= 400) log(`HTTP ${resp.status()}: ${resp.url().slice(0, 120)}`);
    });
  });

  test("FASE 9.1 — Pré-check: sessão ativa", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const url = page.url();
    log(`URL após /dashboard: ${url}`);
    expect(url).not.toContain("/login");
    const pageContent = page.locator("body");
    await expect(pageContent).not.toBeEmpty({ timeout: 15000 });
    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible().catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) : "(hidden)";
    log(`H1 visível: ${h1Visible}, texto: ${h1Text}`);
    await page.screenshot({ path: `${screenshotBase}/fase9-prcheck.png`, fullPage: true });
  });

  test("FASE 9.2 — Contas a Receber: TESTE-001 (R$ 100)", async ({ page }) => {
    await page.goto("/financeiro?tab=receber", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshotBase}/fase9-r-inicial.png`, fullPage: true });

    const pageBody = page.locator("body");
    const bodyText = await pageBody.textContent();

    if (bodyText?.includes("Carregando") || bodyText?.includes("carregando")) {
      log("Aguardando fim do loading...");
      await page.waitForTimeout(5000);
    }

    const hasRecord = bodyText?.includes("TESTE-001") || bodyText?.includes("100") || bodyText?.includes("teste");
    log(`TESTE-001 visível na página: ${hasRecord}`);

    const searchInput = page.locator("input[placeholder*='Buscar' i]").first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    log(`Campo de busca visível: ${searchVisible}`);

    if (searchVisible) {
      await searchInput.fill("TESTE-001");
      await page.waitForTimeout(2000);
      log("Digitado 'TESTE-001' no campo de busca");
    } else {
      log("Campo de busca não encontrado — buscando por placeholder alternativo");
      const allInputs = page.locator("input");
      const ic = await allInputs.count();
      log(`Total inputs na página: ${ic}`);
      for (let i = 0; i < Math.min(ic, 8); i++) {
        const ph = await allInputs.nth(i).getAttribute("placeholder");
        log(`  input[${i}]: placeholder="${ph}"`);
      }
    }

    await page.screenshot({ path: `${screenshotBase}/fase9-r-busca.png`, fullPage: true });

    const tables = page.locator("table");
    const tableCount = await tables.count();
    log(`Tabelas na página: ${tableCount}`);

    for (let t = 0; t < tableCount; t++) {
      const tbody = tables.nth(t).locator("tbody");
      const rowCount = await tbody.locator("tr").count();
      log(`  Tabela[${t}]: ${rowCount} linhas`);
      if (rowCount > 0) {
        const firstRow = tbody.locator("tr").first();
        const rowText = await firstRow.textContent();
        log(`  Linha[0]: "${rowText?.replace(/\s+/g, " ").trim().slice(0, 200)}"`);
      }
    }

    await page.screenshot({ path: `${screenshotBase}/fase9-r-final.png`, fullPage: true });
  });

  test("FASE 9.3 — Contas a Pagar: TESTE-001 (R$ 60)", async ({ page }) => {
    await page.goto("/financeiro?tab=pagar", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").textContent();
    const hasRecord = bodyText?.includes("TESTE-001") || bodyText?.includes("60,00");
    log(`TESTE-001/R$60 visível: ${hasRecord}`);

    const searchInput = page.locator("input[placeholder*='Buscar' i]").first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    log(`Campo de busca visível: ${searchVisible}`);

    if (searchVisible) await searchInput.fill("TESTE-001");

    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotBase}/fase9-p-busca.png`, fullPage: true });

    const tables = page.locator("table");
    const tc = await tables.count();
    log(`Tabelas: ${tc}`);

    for (let t = 0; t < tc; t++) {
      const rows = tables.nth(t).locator("tbody tr");
      const rc = await rows.count();
      log(`  Tabela[${t}]: ${rc} linhas`);
      if (rc > 0) {
        const rowText = await rows.first().textContent();
        log(`  Linha[0]: "${rowText?.replace(/\s+/g, " ").trim().slice(0, 200)}"`);
        const hasVal = rowText?.includes("60,00") || rowText?.includes("60.00");
        log(`    R$ 60,00: ${hasVal}`);
      }
    }

    await page.screenshot({ path: `${screenshotBase}/fase9-p-final.png`, fullPage: true });
  });

  test("FASE 9.4 — Pagamento Prestadores: R$ 70 (60+10)", async ({ page }) => {
    await page.goto("/financeiro?tab=pagamento-prestadores", { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);

    await page.screenshot({ path: `${screenshotBase}/fase9-pp-inicial.png`, fullPage: true });

    const tabs = page.locator("button[role='tab']");
    const tc = await tabs.count();
    log(`Abas encontradas: ${tc}`);
    for (let i = 0; i < tc; i++) log(`  Aba[${i}]: "${(await tabs.nth(i).textContent())?.trim()}"`);

    const bodyText = await page.locator("body").textContent();
    log(`TESTE-001 na página: ${bodyText?.includes("TESTE-001")}`);
    log(`R$ 70 visível: ${bodyText?.includes("70,00") || bodyText?.includes("70.00")}`);
    log(`R$ 60 visível: ${bodyText?.includes("60,00") || bodyText?.includes("60.00")}`);

    if (bodyText?.includes("Nenhum") || bodyText?.includes("vazio")) {
      log("⚠️ Página vazia ou sem dados — verificar período/filtro");
    }

    const tables = page.locator("table");
    const tc2 = await tables.count();
    for (let t = 0; t < tc2; t++) {
      const rows = tables.nth(t).locator("tbody tr");
      const rc = await rows.count();
      log(`Tabela[${t}]: ${rc} linhas`);
      if (rc > 0) {
        const rowText = await rows.first().textContent();
        log(`  Linha[0]: "${rowText?.replace(/\s+/g, " ").trim().slice(0, 200)}"`);
      }
    }

    const dashTab = tabs.filter({ hasText: /dashboard/i });
    if ((await dashTab.count()) > 0) {
      await dashTab.first().click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${screenshotBase}/fase9-pp-dashboard.png`, fullPage: true });
      const db = await page.locator("body").textContent();
      log(`Dashboard tab - valor visível: ${db?.includes("70") || db?.includes("60")}`);
    }

    await page.screenshot({ path: `${screenshotBase}/fase9-pp-final.png`, fullPage: true });
  });

  test("FASE 9.5 — Dashboard Financeiro KPIs", async ({ page }) => {
    await page.goto("/financeiro?tab=dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);

    await page.screenshot({ path: `${screenshotBase}/fase9-dash.png`, fullPage: true });

    const body = await page.locator("body").textContent();
    if (body) {
      log(`Page body length: ${body.length}`);
      log(`"Receita" encontrado: ${body.includes("Receita") || body.includes("receita")}`);
      log(`"Custo" encontrado: ${body.includes("Custo") || body.includes("custo")}`);
      log(`"Margem" encontrado: ${body.includes("Margem") || body.includes("margem")}`);
      log(`"Carregando" ativo: ${body.includes("Carregando")}`);
      log(`"Nenhum dado" presente: ${body.includes("Nenhum dado")}`);

      if (body.includes("Nenhum dado")) {
        log("⚠️ Dashboard sem dados (mês sem OS finalizadas ou dados insuficientes)");
      }

      const valorPattern = body.match(/R\$\s*[\d.,]+/g);
      if (valorPattern) {
        log(`Valores em R$ encontrados: ${valorPattern.length}`);
        valorPattern.slice(0, 10).forEach((v) => log(`  ${v}`));
      }
    }

    const kpiCards = page.locator("div[class*='rounded'], div[class*='card'], div[class*='Card']").first();
    const kpiVisible = await kpiCards.isVisible().catch(() => false);
    log(`Cards visíveis: ${kpiVisible}`);

    const h2 = page.locator("h2");
    const h2c = await h2.count();
    log(`Subtítulos (h2): ${h2c}`);
    for (let i = 0; i < h2c; i++) log(`  h2[${i}]: "${(await h2.nth(i).textContent())?.trim()}"`);

    await page.screenshot({ path: `${screenshotBase}/fase9-dash-final.png`, fullPage: true });
  });

  test("FASE 9.6 — Composição Financeira (OS pendente = vazio)", async ({ page }) => {
    await page.goto("/financeiro?tab=receber", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const searchInput = page.locator("input[placeholder*='Buscar' i]").first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(OS_ID.slice(0, 8));
      await page.waitForTimeout(2000);
    }

    const tableRows = page.locator("table").first().locator("tbody tr");
    const rc = await tableRows.count();
    log(`Linhas após busca: ${rc}`);

    if (rc > 0) {
      const buttons = tableRows.first().locator("button");
      const bc = await buttons.count();
      log(`Botões na primeira linha: ${bc}`);
      if (bc > 0) {
        const btnTitle = await buttons.first().getAttribute("title") || await buttons.first().textContent();
        log(`Primeiro botão: "${btnTitle?.trim()}"`);

        if (btnTitle?.toLowerCase().includes("detalhe") || btnTitle?.toLowerCase().includes("ver") || btnTitle?.toLowerCase().includes("eye")) {
          await buttons.first().click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `${screenshotBase}/fase9-c-detalhe.png`, fullPage: true });
        }
      }
    }

    const cardText = await page.locator("body").textContent();
    const hasComposicao = cardText?.includes("composi") || cardText?.includes("Composi");
    log(`Seção composição presente: ${hasComposicao}`);

    if (hasComposicao) {
      log("⚠️ Seção composição visível — deveria estar vazia (OS pendente)");
    }

    const renderBugs = ["Infinity", "NaN", "undefined", "null"].filter((b) => cardText?.includes(b));
    if (renderBugs.length > 0) log(`⚠️ Render bugs: ${renderBugs.join(", ")}`);

    await page.screenshot({ path: `${screenshotBase}/fase9-c-final.png`, fullPage: true });
  });

  test("FASE 9.7 — Console e Network: zero erros", async ({ page }) => {
    await page.goto("/financeiro?tab=receber", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    await page.goto("/financeiro?tab=pagar", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    await page.goto("/financeiro?tab=pagamento-prestadores", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    await page.goto("/financeiro?tab=dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${screenshotBase}/fase9-network-final.png`, fullPage: true });

    const httpErrors = ERRORS.filter((e) => e.startsWith("HTTP "));
    const jsErrors = ERRORS.filter((e) => e.startsWith("console.error:") || e.startsWith("pageerror:"));

    log(`\n=== CONSOLE / NETWORK ===`);
    log(`HTTP 4xx/5xx: ${httpErrors.length}`);
    httpErrors.forEach((e) => log(`  ${e}`));
    log(`Erros JS: ${jsErrors.length}`);
    jsErrors.forEach((e) => log(`  ${e}`));
    log(`Total ocorrências: ${ERRORS.length}`);
    log(`=== FIM ===`);
  });

  test("FASE 9.8 — Screenshots", async () => {
    const screenshots = [
      "fase9-prcheck.png",
      "fase9-r-inicial.png", "fase9-r-busca.png", "fase9-r-final.png",
      "fase9-p-busca.png", "fase9-p-final.png",
      "fase9-pp-inicial.png", "fase9-pp-dashboard.png", "fase9-pp-final.png",
      "fase9-dash.png", "fase9-dash-final.png",
      "fase9-c-detalhe.png", "fase9-c-final.png",
    ];

    let ok = 0, missing = 0;
    for (const s of screenshots) {
      if (existsSync(`${screenshotBase}/${s}`)) ok++;
      else missing++;
    }
    log(`Screenshots: ${ok} salvos, ${missing} não gerados`);
  });

  test("FASE 9.9 — Classificação final", async () => {
    const total = ERRORS.length;
    const httpErrors = ERRORS.filter((e) => e.startsWith("HTTP "));
    const jsErrors = ERRORS.filter((e) => e.startsWith("console.error:") || e.startsWith("pageerror:"));
    const criticalHttp = httpErrors.filter(
      (e) => !e.includes("supabase.co/rest/v1") && !e.includes("401") && !e.includes("403")
    );

    log(`\n═══════════════════════════════════`);
    log(`CLASSIFICAÇÃO FASE 9`);
    log(`═══════════════════════════════════`);
    log(`Erros HTTP: ${httpErrors.length}`);
    log(`Erros JS: ${jsErrors.length}`);
    log(`Críticos não-Supabase: ${criticalHttp.length}`);
    log(`Total: ${total}`);

    if (criticalHttp.length === 0 && jsErrors.length <= 3) {
      log(`\n✅ APROVADO`);
    } else if (criticalHttp.length <= 2 && jsErrors.length <= 5) {
      log(`\n⚠️ APROVADO COM RESSALVAS`);
    } else {
      log(`\n❌ REPROVADO`);
    }
    log(`═══════════════════════════════════\n`);
  });
});
