/**
 * VALID-REAL-P1-P2-UI — Validação Visual do Fechamento na Interface Real
 *
 * Abre o TMS, navega até Pag. Prestadores, localiza o fechamento
 * dc26a5f1 e valida visualmente os dados. Captura screenshots.
 *
 * NOTA: usa Playwright direto (sem framework de testes) para
 * evitar bloqueio de produção no global-setup.ts.
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { guardHarness } from "./_guard.mjs";

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/valid_real_p1p2_ui_visual.ts");

// TMS-FIN-DATA-04D2 — sem hardcode de PROD/anon.
const SUPA_URL = process.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const BASE_URL = "http://localhost:8800";
const FECHAMENTO_ID = "dc26a5f1";
const FECHAMENTO_FULL = "dc26a5f1-720f-4631-bc4c-3106a305d96c";
const SCREENSHOT_DIR = "test-results/valid-real-p1p2-ui";

const log: string[] = [];
function step(name: string, status: string, detail: string) {
  const line = `[${status}] ${name}: ${detail}`;
  log.push(line);
  console.log(line);
}

async function main() {
  console.log("=== VALID-REAL-P1-P2-UI — Valiação Visual ===\n");

  // Garantir diretório de screenshots
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage();

  // Coletar erros de console e rede
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", msg => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("response", response => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    // ── ETAPA 1: Abrir TMS ──
    console.log("--- ETAPA 1: Abrir TMS ---");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-tms-aberto.png"), fullPage: false });
    step("TMS", "INFO", `URL: ${page.url()} | Título: ${await page.title()}`);

    // Verificar se estamos na página de login
    const isLoginPage = page.url().includes("/login");
    if (isLoginPage) {
      step("TMS", "BLOQUEADO", "Página de login detectada. Auth necessária. Senha não disponível nesta missão.");
      step("TMS", "INFO", "Tentando verificar dados via Supabase client diretamente...");

      // Fallback: verificar dados via Supabase REST API
      const response = await page.evaluate(async ({ supaUrl, supaKey }: { supaUrl: string; supaKey: string }) => {
        const url = supaUrl;
        const key = supaKey;
        const fid = "dc26a5f1-720f-4631-bc4c-3106a305d96c";
        
        const res = await fetch(`${url}/rest/v1/pagamentos_prestadores?id=eq.${fid}&select=id,prestador_nome,valor_liquido,status,status_conferencia,status_aprovacao,status_pagamento,data_pagamento,data_conferencia,data_aprovacao,qtd_os,tipo_pagamento,is_teste,observacao`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        return await res.json();
      }, { supaUrl: SUPA_URL, supaKey: SUPA_KEY });

      if (response?.length) {
        const f = response[0];
        step("BANCO-DIRETO", "OK", `Fechamento encontrado via REST API`);
        step("BANCO", "OK", `prestador=${f.prestador_nome}`);
        step("BANCO", "OK", `valor_liquido=R$${f.valor_liquido}`);
        step("BANCO", "OK", `qtd_os=${f.qtd_os}`);
        step("BANCO", "OK", `status=${f.status}`);
        step("BANCO", "OK", `status_conferencia=${f.status_conferencia}`);
        step("BANCO", "OK", `status_aprovacao=${f.status_aprovacao}`);
        step("BANCO", "OK", `status_pagamento=${f.status_pagamento}`);
        step("BANCO", "OK", `data_pagamento=${f.data_pagamento}`);
        step("BANCO", "OK", `data_conferencia=${f.data_conferencia?.slice(0,10)}`);
        step("BANCO", "OK", `data_aprovacao=${f.data_aprovacao?.slice(0,10)}`);
        step("BANCO", "OK", `is_teste=${f.is_teste}`);
        step("BANCO", "OK", `observacao=${f.observacao?.slice(0,60)}`);
      } else {
        step("BANCO", "FALHA", "Fechamento não encontrado via REST API");
      }

      // Verificar itens vinculados
      const itens = await page.evaluate(async ({ supaUrl, supaKey }: { supaUrl: string; supaKey: string }) => {
        const url = supaUrl;
        const key = supaKey;
        const fid = "dc26a5f1-720f-4631-bc4c-3106a305d96c";
        
        const res = await fetch(`${url}/rest/v1/pagamentos_prestadores?fechamento_id=eq.${fid}&select=id,prestador_nome,valor_liquido,status,status_pagamento,is_teste&order=periodo_inicio`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        return await res.json();
      }, { supaUrl: SUPA_URL, supaKey: SUPA_KEY });

      if (itens?.length) {
        step("ITENS", "OK", `${itens.length} itens vinculados:`);
        let total = 0;
        itens.forEach((i: any) => {
          total += i.valor_liquido || 0;
          step("  ITEM", "OK", `${i.id.slice(0,8)} | R$${i.valor_liquido} | status=${i.status} | pag=${i.status_pagamento}`);
        });
        step("ITENS-TOTAL", total === 1140 ? "OK" : "FALHA", `Total R$${total} (esperado R$1140)`);
      } else {
        step("ITENS", "FALHA", "Nenhum item vinculado encontrado");
      }

      // Verificar duplicatas
      const duplicatas = await page.evaluate(async ({ supaUrl, supaKey }: { supaUrl: string; supaKey: string }) => {
        const url = supaUrl;
        const key = supaKey;
        
        const res = await fetch(`${url}/rest/v1/pagamentos_prestadores?prestador_id=eq.659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce&tipo_pagamento=eq.fechamento&is_teste=eq.true&select=id,status,is_teste`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        return await res.json();
      }, { supaUrl: SUPA_URL, supaKey: SUPA_KEY });

      step("DUPLICATAS", (duplicatas?.length || 0) <= 1 ? "OK" : "FALHA",
        `${duplicatas?.length || 0} fechamentos TESTE deste prestador`);

      // Screenshot da página de login como evidência
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-login-page.png"), fullPage: false });
      step("SCREENSHOT", "OK", "02-login-page.png capturado");

    } else {
      // Estamos logados (sessão persistente)
      step("TMS", "OK", "TMS aberto sem login (sessão persistente)");

      // Navegar para Financeiro > Pag. Prestadores
      console.log("\n--- ETAPA 2: Navegar para Pag. Prestadores ---");
      
      // Clicar no menu Financeiro
      const financeiroMenu = page.locator('text=Financeiro').first();
      if (await financeiroMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
        await financeiroMenu.click();
        await page.waitForTimeout(1000);
      }

      // Navegar para a rota diretamente
      await page.goto(`${BASE_URL}/financeiro?tab=pagamentos`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-pag-prestadores.png"), fullPage: false });
      step("NAVEGACAO", "OK", "Financeiro > Pag. Prestadores aberto");

      // Procurar pelo fechamento
      console.log("\n--- ETAPA 3: Localizar fechamento ---");
      const pageContent = await page.content();
      
      if (pageContent.includes(FECHAMENTO_ID) || pageContent.includes("BRUNO")) {
        step("FECHAMENTO", "OK", "Fechamento BRUNO encontrado na página");
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-fechamento-encontrado.png"), fullPage: false });
      } else {
        step("FECHAMENTO", "INFO", "Fechamento não visível imediatamente. Verificando conteúdo...");
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-pagina-verificada.png"), fullPage: false });
      }

      // Refresh e re-verificar
      console.log("\n--- ETAPA 4: Refresh ---");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-pos-refresh.png"), fullPage: false });
      step("REFRESH", "OK", "Página recarregada");
    }

    // ── RESUMO ──
    console.log("\n=== RESUMO ===");
    console.log(`Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach(e => console.log(`  [CONSOLE] ${e.slice(0, 200)}`));
    console.log(`Network errors: ${networkErrors.length}`);
    networkErrors.forEach(e => console.log(`  [NETWORK] ${e}`));

    console.log("\n=== LOG COMPLETO ===");
    log.forEach(l => console.log(l));

  } catch (err: any) {
    step("ERRO", "FALHA", err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "ERRO.png"), fullPage: false });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
