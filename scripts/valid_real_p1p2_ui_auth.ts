/**
 * VALID-REAL-P1-P2-UI-AUTH — Validação Visual com Login Manual (v2)
 *
 * Abre navegador NÃO-headless. Usuário faz login manualmente.
 * Após detectar sessão autenticada, navega para Pagamentos e valida o fechamento.
 *
 * REGRAS:
 * - NÃO preenche senha
 * - NÃO armazena credenciais
 * - NÃO imprime tokens
 * - Sessão persiste apenas no diretório temporário do teste
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { guardHarness } from "./_guard.mjs";

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/valid_real_p1p2_ui_auth.ts");

const BASE_URL = "http://localhost:8800";
const FECHAMENTO_IDcurto = "dc26a5f1";
const PRESTADOR = "BRUNO DA SILVA SANTOS";
const VALOR_ESPERADO = "1.140";
const QTD_ITENS_ESPERADA = 6;
const SCREENSHOT_DIR = "test-results/valid-real-p1p2-ui-auth";

const log: string[] = [];
function step(name: string, status: string, detail: string) {
  const line = `[${status}] ${name}: ${detail}`;
  log.push(line);
  console.log(line);
}

async function screenshot(page: any, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name) });
  step("SCREENSHOT", "OK", name);
}

async function main() {
  console.log("=== VALID-REAL-P1-P2-UI-AUTH (v2) ===\n");
  console.log("INSTRUÇÕES:");
  console.log("1. O navegador irá abrir localhost:8800");
  console.log("2. Faça login manualmente no TMS");
  console.log("3. Após login, o script detectará automaticamente");
  console.log("4. NÃO feche o navegador\n");

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Usar diretório temporário para sessão (não versionar)
  const userDataDir = path.join(process.env.TEMP || "/tmp", "p1p2-ui-auth-session-v2");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const page = context.pages()[0] || await context.newPage();

  // Coletar erros
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", resp => {
    if (resp.status() >= 400) networkErrors.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    // ── ETAPA 1: Abrir TMS ──
    console.log("--- ETAPA 1: Abrir TMS ---");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, "01-tms-aberto.png");
    step("TMS", "OK", `URL: ${page.url()}`);

    // ── ETAPA 2: Aguardar login manual ──
    console.log("\n--- ETAPA 2: Aguardar login manual ---");
    console.log(">>> FAÇA LOGIN NO NAVEGADOR AGORA <<<\n");

    const maxWait = 300000; // 5 minutos
    const startTime = Date.now();
    let loggedIn = false;

    while (Date.now() - startTime < maxWait) {
      const currentUrl = page.url();
      const isLogin = currentUrl.includes("/login") || currentUrl.includes("/auth");

      if (!isLogin) {
        loggedIn = true;
        step("LOGIN", "OK", `Sessão detectada: ${currentUrl}`);
        break;
      }

      await page.waitForTimeout(2000);
    }

    if (!loggedIn) {
      step("LOGIN", "BLOQUEADO", "Timeout 5min — login não concluído");
      await screenshot(page, "TIMEOUT-login.png");
      await context.close();
      return;
    }

    await page.waitForTimeout(3000);
    await screenshot(page, "03-pos-login.png");

    // ── ETAPA 3: Navegar para Financeiro ──
    console.log("\n--- ETAPA 3: Navegar para Financeiro ---");
    await page.goto(`${BASE_URL}/financeiro`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    await screenshot(page, "04-financeiro-geral.png");
    step("NAVEGACAO", "OK", "Financeiro carregado");

    // ── ETAPA 4: Clicar na aba Pagamentos ──
    console.log("\n--- ETAPA 4: Clicar na aba Pagamentos ---");

    // Procurar pela aba Pagamentos
    const pagamentosTab = page.locator('button:has-text("Pagamentos"), [role="tab"]:has-text("Pagamentos")').first();
    if (await pagamentosTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pagamentosTab.click();
      await page.waitForTimeout(3000);
      await screenshot(page, "05-aba-pagamentos.png");
      step("ABA", "OK", "Aba Pagamentos clicada");
    } else {
      step("ABA", "INFO", "Aba Pagamentos não encontrada, tentando via URL");
      await page.goto(`${BASE_URL}/financeiro?tab=pagamentos`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(5000);
      await screenshot(page, "05-pagamentos-url.png");
    }

    // ── ETAPA 5: Procurar sub-aba Pagamento Prestadores ──
    console.log("\n--- ETAPA 5: Procurar Pagamento Prestadores ---");

    // Verificar sub-abas disponíveis
    const subTabs = await page.locator('[role="tab"], button').allTextContents();
    step("SUB-TABS", "INFO", `Abas visíveis: ${subTabs.filter(t => t.trim()).join(", ").slice(0, 200)}`);

    // Procurar por "Pagamento Prestadores" ou "Prestadores"
    const prestadoresTab = page.locator('button:has-text("Pagamento Prestadores"), button:has-text("Prestadores"), [role="tab"]:has-text("Prestadores")').first();
    if (await prestadoresTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prestadoresTab.click();
      await page.waitForTimeout(3000);
      await screenshot(page, "06-pag-prestadores.png");
      step("SUB-ABA", "OK", "Pagamento Prestadores clicado");
    } else {
      step("SUB-ABA", "INFO", "Pagamento Prestadores não encontrado como sub-aba");
      await screenshot(page, "06-pagamentos-aba.png");
    }

    // ── ETAPA 6: Clicar em "Fechamentos Anteriores" ──
    console.log("\n--- ETAPA 6: Fechamentos Anteriores ---");

    const fechamentosAntTab = page.locator('button:has-text("Fechamentos Anteriores"), [role="tab"]:has-text("Fechamentos Anteriores")').first();
    if (await fechamentosAntTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fechamentosAntTab.click();
      await page.waitForTimeout(3000);
      await screenshot(page, "06-fechamentos-anteriores.png");
      step("ABA", "OK", "Fechamentos Anteriores clicado");
    } else {
      step("ABA", "INFO", "Aba Fechamentos Anteriores não encontrada");
      await screenshot(page, "06-aba-nao-encontrada.png");
    }

    // ── ETAPA 7: Localizar fechamento de BRUNO ──
    console.log("\n--- ETAPA 7: Localizar fechamento ---");
    await page.waitForTimeout(2000);

    // Verificar conteúdo da página
    const pageContent = await page.content();
    const hasBruno = pageContent.includes("BRUNO") || pageContent.includes("Bruno");
    const hasFechamento = pageContent.includes("Fechamento") || pageContent.includes("fechamento");
    const hasPago = pageContent.includes("Pago") || pageContent.includes("pago");
    const hasValor = pageContent.includes(VALOR_ESPERADO) || pageContent.includes("1140");
    const hasConferido = pageContent.includes("Conferido") || pageContent.includes("conferido");
    const hasAprovado = pageContent.includes("Aprovado") || pageContent.includes("aprovado");

    step("BUSCA", hasBruno ? "OK" : "FALHA", `BRUNO na página: ${hasBruno}`);
    step("BUSCA", hasFechamento ? "OK" : "INFO", `Seção fechamento visível: ${hasFechamento}`);
    step("BUSCA", hasPago ? "OK" : "INFO", `Status PAGO visível: ${hasPago}`);
    step("BUSCA", hasValor ? "OK" : "INFO", `Valor R$ 1.140 visível: ${hasValor}`);
    step("BUSCA", hasConferido ? "OK" : "INFO", `Status CONFERIDO visível: ${hasConferido}`);
    step("BUSCA", hasAprovado ? "OK" : "INFO", `Status APROVADO visível: ${hasAprovado}`);

    await screenshot(page, "07-busca-fechamento.png");

    // Se encontrou BRUNO, clicar para expandir
    if (hasBruno) {
      const brunoRow = page.locator(`text=BRUNO`).first();
      if (await brunoRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await brunoRow.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "08-bruno-expandido.png");
        step("EXPANSAO", "OK", "Fechamento de BRUNO expandido");

        // Verificar itens detalhados
        const expandedContent = await page.content();
        const hasR100 = expandedContent.includes("100");
        const hasR200 = expandedContent.includes("200");
        const hasR300 = expandedContent.includes("300");
        step("ITENS", hasR100 ? "OK" : "INFO", `Item R$100: ${hasR100}`);
        step("ITENS", hasR200 ? "OK" : "INFO", `Item R$200: ${hasR200}`);
        step("ITENS", hasR300 ? "OK" : "INFO", `Item R$300: ${hasR300}`);
      }
    } else {
      // Tentar filtro de prestador
      step("BUSCA", "INFO", "BRUNO não encontrado, verificando filtros...");
      await screenshot(page, "08-sem-bruno.png");
    }

    // ── ETAPA 8: Refresh ──
    console.log("\n--- ETAPA 8: Refresh ---");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await screenshot(page, "10-pos-refresh.png");
    step("REFRESH", "OK", "Página recarregada");

    // Re-verificar após refresh
    const afterContent = await page.content();
    const afterBruno = afterContent.includes("BRUNO") || afterContent.includes("Bruno");
    const afterPago = afterContent.includes("Pago") || afterContent.includes("pago");
    const afterValor = afterContent.includes(VALOR_ESPERADO) || afterContent.includes("1140");

    step("POS-REFRESH", afterBruno ? "OK" : "FALHA", `BRUNO persiste: ${afterBruno}`);
    step("POS-REFRESH", afterPago ? "OK" : "FALHA", `Status PAGO persiste: ${afterPago}`);
    step("POS-REFRESH", afterValor ? "OK" : "FALHA", `Valor R$ 1.140 persiste: ${afterValor}`);

    // ── ETAPA 9: Contas a Pagar ──
    console.log("\n--- ETAPA 9: Contas a Pagar ---");

    // Navegar para Contas a Pagar
    await page.goto(`${BASE_URL}/financeiro`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // Clicar na aba Pagamentos novamente
    const pagTab2 = page.locator('button:has-text("Pagamentos"), [role="tab"]:has-text("Pagamentos")').first();
    if (await pagTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pagTab2.click();
      await page.waitForTimeout(2000);
    }

    // Clicar em "Contas a Pagar"
    const pagarTab = page.locator('button:has-text("Contas a Pagar"), [role="tab"]:has-text("Contas a Pagar")').first();
    if (await pagarTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pagarTab.click();
      await page.waitForTimeout(3000);
      await screenshot(page, "09-contas-pagar.png");
      step("CONTAS-PAGAR", "OK", "Contas a Pagar acessado");

      const pagarContent = await page.content();
      const pagarBruno = pagarContent.includes("BRUNO") || pagarContent.includes("Bruno");
      step("CONTAS-PAGAR", pagarBruno ? "OK" : "INFO", `BRUNO visível: ${pagarBruno}`);
    } else {
      await screenshot(page, "09-pagamentos-aba.png");
      step("CONTAS-PAGAR", "INFO", "Sub-aba Contas a Pagar não encontrada");
    }

    // ── ETAPA 10: Verificar duplicidade ──
    console.log("\n--- ETAPA 10: Duplicidade ---");
    const allContent = afterContent + (await page.content());
    const fechamentoCount = (allContent.match(new RegExp(FECHAMENTO_IDcurto, "g")) || []).length;
    step("DUPLICIDADE", fechamentoCount <= 1 ? "OK" : "FALHA", `Ocorrências do fechamento: ${fechamentoCount}`);

    // ── RESUMO ──
    console.log("\n=== RESUMO ===");
    console.log(`Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach(e => {
      if (!e.includes("recrutamento_automacoes")) {
        console.log(`  [CONSOLE] ${e.slice(0, 200)}`);
      }
    });

    const flowErrors = networkErrors.filter(e => !e.includes("recrutamento_automacoes"));
    console.log(`Network errors (relacionados): ${flowErrors.length}`);
    flowErrors.forEach(e => console.log(`  [NETWORK] ${e}`));

    // Salvar log
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, "log.txt"),
      log.join("\n"),
      "utf-8"
    );

    console.log("\n=== LOG COMPLETO ===");
    log.forEach(l => console.log(l));

    console.log("\n=== Screenshots salvos em:", SCREENSHOT_DIR, "===");

  } catch (err: any) {
    step("ERRO", "FALHA", err.message);
    await screenshot(page, "ERRO.png");
  } finally {
    console.log("\n>>> NAVEGADOR FECHANDO EM 10 SEGUNDOS <<<");
    await page.waitForTimeout(10000);
    await context.close();
  }
}

main().catch(console.error);
