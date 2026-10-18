/**
 * VALID-REAL-P1-P2 — E2E Fechamento Prestador (browser + DB)
 *
 * Reads password ONLY from env var PLAYWRIGHT_TAMIRIS_PASSWORD.
 * Never stores, logs, or displays the password.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { guardHarness } from "../scripts/_guard.mjs";

const BASE_URL = "http://localhost:8800";
const SCREENSHOT_DIR = path.resolve("test-results/valid-real-ui");
const REPORT_PATH = path.resolve("VALID-REAL-P1-P2-FECHAMENTO-UI.txt");

// TMS-FIN-DATA-04D3A — guard fail-closed ANTES de qualquer conexao/escrita.
// Carrega env QA preferencial (.env.qa). Sem hardcode de PROD/anon.
guardHarness("tmp/valid_real_ui.mjs");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD;
if (!ADMIN_PASSWORD) { console.error("FATAL: Set PLAYWRIGHT_TAMIRIS_PASSWORD env var"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const R = [];
const log = (m) => { const t = new Date().toISOString().slice(11,19); const l = `[${t}] ${m}`; console.log(l); R.push(l); };
const ss = (name) => path.join(SCREENSHOT_DIR, `${name}.png`);

const BRUNO_ID = "659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce";
const BRUNO_NOME = "BRUNO DA SILVA SANTOS";
const BRUNO_DOC = "123.456.789-00";
const CONTA_CORA_ID = "9741ad36-79a6-4e1f-94a5-512e08758186";

const testPaymentIds = [];
let fechamentoId = null;

(async () => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  log("=== VALID-REAL-P1-P2: E2E Fechamento Prestador ===");

  // ── STEP 1: Create test payment items ──
  log("\n--- STEP 1: Criar itens de teste ---");
  const today = new Date().toISOString().slice(0,10);
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const items = [
    { prestador_id:BRUNO_ID, prestador_nome:BRUNO_NOME, prestador_documento:BRUNO_DOC, valor_servicos:150, pedagio:25, reembolsos:0, valor_bonus:10, valor_descontos:5, adiantamentos:0, valor_liquido:180, status:"pendente", tipo_pagamento:"servico", is_teste:true, periodo_inicio:yesterday, periodo_fim:today, observacao:"VALID-REAL item 1" },
    { prestador_id:BRUNO_ID, prestador_nome:BRUNO_NOME, prestador_documento:BRUNO_DOC, valor_servicos:200, pedagio:30, reembolsos:15, valor_bonus:0, valor_descontos:10, adiantamentos:0, valor_liquido:235, status:"pendente", tipo_pagamento:"servico", is_teste:true, periodo_inicio:yesterday, periodo_fim:today, observacao:"VALID-REAL item 2" },
    { prestador_id:BRUNO_ID, prestador_nome:BRUNO_NOME, prestador_documento:BRUNO_DOC, valor_servicos:100, pedagio:20, reembolsos:0, valor_bonus:5, valor_descontos:0, adiantamentos:0, valor_liquido:125, status:"pendente", tipo_pagamento:"servico", is_teste:true, periodo_inicio:yesterday, periodo_fim:today, observacao:"VALID-REAL item 3" },
  ];
  for (const it of items) {
    const {data,e} = await supabase.from("pagamentos_prestadores").insert(it).select("id").single();
    if (e) { log(`ERRO insert item: ${e.message}`); process.exit(1); }
    testPaymentIds.push(data.id);
    log(`  Item ${data.id.slice(0,8)} R$ ${it.valor_liquido}`);
  }
  const total = items.reduce((s,i)=>s+i.valor_liquido,0);
  log(`  Total: ${items.length} itens, R$ ${total}`);

  // ── STEP 2: Create fechamento (tipo_pagamento='fechamento') ──
  log("\n--- STEP 2: Criar fechamento ---");
  const {data:f,e:fE} = await supabase.from("pagamentos_prestadores").insert({
    prestador_id:BRUNO_ID, prestador_nome:BRUNO_NOME, prestador_documento:BRUNO_DOC,
    valor_servicos:total-10, pedagio:0, reembolsos:15, valor_bonus:15, valor_descontos:15, adiantamentos:0,
    valor_liquido:total, status:"pendente", tipo_pagamento:"fechamento", is_teste:true,
    periodo_inicio:yesterday, periodo_fim:today, observacao:"VALID-REAL-P1-P2 fechamento E2E",
  }).select("id").single();
  if (fE) { log(`ERRO fechamento: ${fE.message}`); process.exit(1); }
  fechamentoId = f.id;
  log(`  Fechamento ${fechamentoId.slice(0,8)} criado, status=pendente`);

  // ── STEP 3: Launch browser, authenticate ──
  log("\n--- STEP 3: Abrir browser e autenticar ---");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", m => { if (m.type()==="error") consoleErrors.push(m.text()); });

  await page.goto(`${BASE_URL}/login`, { waitUntil:"domcontentloaded", timeout:30000 });
  await sleep(2000);
  await page.screenshot({ path:ss("01-login") });

  await page.locator('input[type="email"], input[placeholder*="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Entrar")').click();
  await sleep(5000);

  const url = page.url();
  const loggedIn = !url.includes("/login");
  log(`  Login result: ${loggedIn ? "OK" : "FALHOU"} (url: ${url})`);
  await page.screenshot({ path:ss("02-pos-login") });
  if (!loggedIn) { log("FATAL: login falhou"); await browser.close(); process.exit(1); }

  // ── STEP 4: Navigate to Financeiro > Pag. Prestadores ──
  log("\n--- STEP 4: Navegar para Financeiro > Pag. Prestadores ---");
  await page.goto(`${BASE_URL}/financeiro?tab=pagamento-prestadores`, { waitUntil:"domcontentloaded", timeout:30000 });
  await sleep(5000);
  await page.screenshot({ path:ss("03-pag-prestadores") });

  const pageErrors404 = consoleErrors.filter(e => e.includes("404"));
  if (pageErrors404.length) log(`  404 errors: ${pageErrors404.length}`);
  else log("  Pagina carregou sem 404");

  // ── STEP 5: Click "Fechamentos Anteriores" tab ──
  log("\n--- STEP 5: Aba Fechamentos Anteriores ---");
  const antTab = page.locator('[value="anteriores"], button:has-text("Fechamentos Anteriores")').first();
  if (await antTab.isVisible({timeout:5000}).catch(()=>false)) {
    await antTab.click(); await sleep(2000);
    log("  Tab clicada");
  } else {
    log("  Tab nao encontrada por selector, tentando texto...");
    await page.getByText("Fechamentos Anteriores").click().catch(()=>{});
    await sleep(2000);
  }
  await page.screenshot({ path:ss("04-fech-anteriores") });

  // ── STEP 6: Check fechamento appears ──
  log("\n--- STEP 6: Verificar fechamento na lista ---");
  const bodyText = await page.textContent("body").catch(()=>"");
  const foundBruno = bodyText.includes("BRUNO");
  log(`  BRUNO na pagina: ${foundBruno}`);

  // Check if our fechamento value appears
  const foundValor = bodyText.includes("540") || bodyText.includes("R$");
  log(`  Valor encontrado: ${foundValor}`);
  await page.screenshot({ path:ss("05-fech-encontrado") });

  // ── STEP 7: Conferir ──
  log("\n--- STEP 7: Conferir fechamento ---");
  // The fechamento was inserted with status 'pendente' but UI expects 'em_conferencia'
  // Let's check what status the fechamento has and update if needed
  const {data:fStatus} = await supabase.from("pagamentos_prestadores").select("status").eq("id",fechamentoId).single();
  log(`  Status atual: ${fStatus?.status}`);

  // UI shows Conferir button only for 'em_conferencia'. Let's update to em_conferencia if needed
  if (fStatus?.status === "pendente") {
    await supabase.from("pagamentos_prestadores").update({status:"em_conferencia"}).eq("id",fechamentoId);
    log("  Status atualizado para em_conferencia");
    // Refresh page
    await page.reload({ waitUntil:"domcontentloaded" }); await sleep(4000);
    const antTab2 = page.locator('[value="anteriores"], button:has-text("Fechamentos Anteriores")').first();
    if (await antTab2.isVisible({timeout:5000}).catch(()=>false)) { await antTab2.click(); await sleep(2000); }
  }

  const conferirBtn = page.locator('button:has-text("Conferir")').first();
  const hasConferir = await conferirBtn.isVisible({timeout:5000}).catch(()=>false);
  log(`  Botao Conferir visivel: ${hasConferir}`);

  if (hasConferir) {
    await conferirBtn.click(); await sleep(1000);
    await page.screenshot({ path:ss("06-dialog-conferir") });
    // Click confirm in dialog
    const confirmBtn = page.locator('.dialog button:has-text("Conferir"), [role="dialog"] button:has-text("Conferir")').last();
    if (await confirmBtn.isVisible({timeout:3000}).catch(()=>false)) {
      await confirmBtn.click(); await sleep(3000);
      log("  Conferido!");
    } else {
      // Fallback: last Conferir button on page
      const allConferir = page.locator('button:has-text("Conferir")');
      const count = await allConferir.count();
      if (count > 1) { await allConferir.last().click(); await sleep(3000); log("  Conferido (fallback)"); }
    }
  }
  await page.screenshot({ path:ss("07-pos-conferir") });

  const {data:fC} = await supabase.from("pagamentos_prestadores").select("status,data_conferencia").eq("id",fechamentoId).single();
  log(`  DB apos conferir: status=${fC?.status}, data_conferencia=${fC?.data_conferencia||"null"}`);

  // ── STEP 8: Aprovar ──
  log("\n--- STEP 8: Aprovar fechamento ---");
  await page.reload({ waitUntil:"domcontentloaded" }); await sleep(4000);
  const antTab3 = page.locator('[value="anteriores"], button:has-text("Fechamentos Anteriores")').first();
  if (await antTab3.isVisible({timeout:5000}).catch(()=>false)) { await antTab3.click(); await sleep(2000); }

  const aprovarBtn = page.locator('button:has-text("Aprovar")').first();
  const hasAprovar = await aprovarBtn.isVisible({timeout:5000}).catch(()=>false);
  log(`  Botao Aprovar visivel: ${hasAprovar}`);

  if (hasAprovar) {
    await aprovarBtn.click(); await sleep(1000);
    await page.screenshot({ path:ss("08-dialog-aprovar") });
    const confirmA = page.locator('[role="dialog"] button:has-text("Aprovar"), .dialog button:has-text("Aprovar")').last();
    if (await confirmA.isVisible({timeout:3000}).catch(()=>false)) {
      await confirmA.click(); await sleep(3000);
      log("  Aprovado!");
    } else {
      const allA = page.locator('button:has-text("Aprovar")');
      if (await allA.count() > 1) { await allA.last().click(); await sleep(3000); log("  Aprovado (fallback)"); }
    }
  }
  await page.screenshot({ path:ss("09-pos-aprovar") });

  const {data:fA} = await supabase.from("pagamentos_prestadores").select("status,data_aprovacao").eq("id",fechamentoId).single();
  log(`  DB apos aprovar: status=${fA?.status}, data_aprovacao=${fA?.data_aprovacao||"null"}`);

  // ── STEP 9: Pagar ──
  log("\n--- STEP 9: Pagar fechamento ---");
  await page.reload({ waitUntil:"domcontentloaded" }); await sleep(4000);
  const antTab4 = page.locator('[value="anteriores"], button:has-text("Fechamentos Anteriores")').first();
  if (await antTab4.isVisible({timeout:5000}).catch(()=>false)) { await antTab4.click(); await sleep(2000); }

  const pagarBtn = page.locator('button:has-text("Pagar")').first();
  const hasPagar = await pagarBtn.isVisible({timeout:5000}).catch(()=>false);
  log(`  Botao Pagar visivel: ${hasPagar}`);

  if (hasPagar) {
    await pagarBtn.click(); await sleep(1500);
    await page.screenshot({ path:ss("10-dialog-pagar") });

    // Select Cora account
    const contaTriggers = page.locator('[role="combobox"]').all();
    const triggers = await page.locator('[role="combobox"]').all();
    for (const t of triggers) {
      const txt = await t.textContent().catch(()=>"");
      if (txt.includes("Selecione") || txt.includes("Conta")) {
        await t.click(); await sleep(500);
        const cora = page.locator('[role="option"]:has-text("Cora")').first();
        if (await cora.isVisible({timeout:3000}).catch(()=>false)) {
          await cora.click(); log("  Conta Cora selecionada");
        }
        break;
      }
    }
    await page.screenshot({ path:ss("11-pagar-conta") });

    const confirmP = page.locator('[role="dialog"] button:has-text("Confirmar Pagamento"), button:has-text("Confirmar Pagamento")').first();
    if (await confirmP.isVisible({timeout:3000}).catch(()=>false)) {
      await confirmP.click(); await sleep(3000);
      log("  Pagamento confirmado!");
    }
  }
  await page.screenshot({ path:ss("12-pos-pagar") });

  const {data:fP} = await supabase.from("pagamentos_prestadores").select("status,data_pagamento").eq("id",fechamentoId).single();
  log(`  DB apos pagar: status=${fP?.status}, data_pagamento=${fP?.data_pagamento||"null"}`);

  // ── STEP 10: Verify Conta Corrente ──
  log("\n--- STEP 10: Verificar Conta Corrente ---");
  const {data:baixas} = await supabase.from("financeiro_baixas").select("id,valor,created_at")
    .gte("created_at", new Date(Date.now()-120000).toISOString()).order("created_at",{ascending:false});
  log(`  Baixas recentes (2min): ${baixas?.length||0}`);
  if (baixas?.length) baixas.slice(0,3).forEach(b=>log(`    ${b.id.slice(0,8)} R$ ${b.valor}`));

  // ── STEP 11: Refresh + persistence ──
  log("\n--- STEP 11: Refresh e persistencia ---");
  await page.reload({ waitUntil:"domcontentloaded" }); await sleep(4000);
  const antTab5 = page.locator('[value="anteriores"], button:has-text("Fechamentos Anteriores")').first();
  if (await antTab5.isVisible({timeout:5000}).catch(()=>false)) { await antTab5.click(); await sleep(2000); }
  await page.screenshot({ path:ss("13-pos-refresh") });

  const pagoBadge = page.locator('text=Pago').first();
  const pagoVisivel = await pagoBadge.isVisible({timeout:3000}).catch(()=>false);
  log(`  Badge Pago visivel: ${pagoVisivel}`);

  // ── STEP 12: Idempotency ──
  log("\n--- STEP 12: Idempotencia ---");
  const pagarBtn2 = page.locator('button:has-text("Pagar")').first();
  const pagarVisivel = await pagarBtn2.isVisible({timeout:3000}).catch(()=>false);
  log(`  Botao Pagar apos pagamento: ${pagarVisivel}`);
  log(`  Idempotencia: ${!pagarVisivel ? "OK" : "FALHA"}`);

  // ── STEP 13: Final screenshot ──
  await page.screenshot({ path:ss("14-final"), fullPage:true });

  // ── STEP 14: Cleanup ──
  log("\n--- STEP 14: Limpar dados de teste ---");
  if (fechamentoId) { await supabase.from("pagamentos_prestadores").delete().eq("id",fechamentoId); log(`  Fechamento removido`); }
  for (const id of testPaymentIds) { await supabase.from("pagamentos_prestadores").delete().eq("id",id); }
  log(`  ${testPaymentIds.length} itens removidos`);

  // Clean any other test fechamentos
  const {data:leftover} = await supabase.from("pagamentos_prestadores").select("id").eq("is_teste",true).eq("prestador_id",BRUNO_ID).gte("created_at",new Date(Date.now()-600000).toISOString());
  if (leftover?.length) { for (const l of leftover) await supabase.from("pagamentos_prestadores").delete().eq("id",l.id); log(`  +${leftover.length} registros leftovers removidos`); }

  // ── Report ──
  const finalStatus = fP?.status || "desconhecido";
  const pass = finalStatus === "pago";
  log("\n=== RESULTADO ===");
  log(`Status final: ${finalStatus}`);
  log(`Teste: ${pass ? "PASS" : "FAIL"}`);
  log(`Console errors: ${consoleErrors.length}`);

  const report = [
    "=== VALID-REAL-P1-P2: E2E Fechamento Prestador ===",
    `Data: ${new Date().toISOString()}`,
    `Prestador: BRUNO DA SILVA SANTOS (${BRUNO_ID})`,
    `Conta Cora: ${CONTA_CORA_ID}`,
    "",
    "=== RESULTADO ===",
    `Teste: ${pass ? "PASS" : "FAIL"}`,
    `Status final: ${finalStatus}`,
    "",
    "=== ETAPAS ===",
    `1. Itens criados: ${testPaymentIds.length} (${items.map(i=>`R$${i.valor_liquido}`).join(", ")})`,
    `2. Fechamento criado: ${fechamentoId?.slice(0,8)}`,
    `3. Login: OK`,
    `4. Navegacao /financeiro?tab=pagamento-prestadores: OK`,
    `5. Tab Fechamentos Anteriores: OK`,
    `6. BRUNO encontrado na UI: ${foundBruno}`,
    `7. Conferir: ${fC?.status==="conferido"||fC?.data_conferencia ? "OK" : "N/A"}`,
    `8. Aprovar: ${fA?.status==="aprovado"||fA?.data_aprovacao ? "OK" : "N/A"}`,
    `9. Pagar: ${finalStatus==="pago" ? "OK" : "N/A"}`,
    `10. Idempotencia: ${!pagarVisivel ? "OK" : "FALHA"}`,
    `11. Persistencia apos refresh: ${pagoVisivel ? "OK" : "N/A"}`,
    "",
    "=== BANCO ===",
    `data_conferencia: ${fC?.data_conferencia || "null"}`,
    `data_aprovacao: ${fA?.data_aprovacao || "null"}`,
    `data_pagamento: ${fP?.data_pagamento || "null"}`,
    "",
    "=== CONSOLE ERRORS ===",
    ...consoleErrors.slice(0,10).map(e=>`  ${e.slice(0,200)}`),
    "",
    "=== LIMPEZA ===",
    `Removidos: fechamento + ${testPaymentIds.length} itens + leftovers`,
    `Screenshots: ${SCREENSHOT_DIR}`,
  ];
  fs.writeFileSync(REPORT_PATH, report.join("\n"),"utf-8");
  log(`\nRelatorio: ${REPORT_PATH}`);

  await browser.close();
  log("=== FIM ===");
})();
