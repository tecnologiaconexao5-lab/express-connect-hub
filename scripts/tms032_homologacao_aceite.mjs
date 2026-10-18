/**
 * TMS-032 — Homologação do ACEITE (Migration 1 / P0) na PWA App Prestador.
 *
 * Contexto: a policy `hae_insert_prestador` foi aplicada em
 * historico_alocacoes_escala para destravar o INSERT do trigger
 * registrar_historico_alocacao() quando o prestador aceita via REST.
 *
 * Fluxo (somente via App, nenhuma escrita manual):
 *   1. Login em prestador-app.pages.dev (infraestruturaconexao@gmail.com);
 *   2. Abrir aba Rotas e localizar a operação HML (destino Av. Paulista);
 *   3. Ver detalhes → Iniciar (Aceitar serviço) → confirmar "Aceitar";
 *   4. Capturar rede (status 4xx/5xx, especialmente 403/42501);
 *   5. Verificar no banco: status, aceite_prestador, data_aceite e
 *      novo registro em historico_alocacoes_escala.
 *
 * Parada obrigatória: qualquer erro RLS/RPC/trigger/função novo encerra o
 * script e NÃO corrige nada — apenas reporta.
 */
import { chromium } from 'playwright';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const APP_URL = 'https://prestador-app.pages.dev';
const EMAIL = 'infraestruturaconexao@gmail.com';
// Credenciais herdadas do script TMS-031 (evita duplicar o segredo em outro arquivo).
const SENHA = (() => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'scripts', 'tms031_homologacao_app.mjs'), 'utf8');
  const m = src.match(/const SENHA = '([^']+)'/);
  return m ? m[1] : '';
})();
const ALOCACAO_ID = '01fc1dce-a7b2-4b4d-a78a-06a267d02afd';
const DESTINO_HML = 'Av. Paulista';
const OUT = path.resolve(process.cwd(), 'test-results', 'tms032', 'homologacao');
const DATABASE_URL = process.env.DATABASE_URL;

fs.mkdirSync(OUT, { recursive: true });

function log(msg) { console.log(`[tms032] ${msg}`); }
const rede = [];
const pageErrors = [];

async function habilitarSemantica(page) {
  await page.evaluate(() => {
    const el = document.querySelector('flt-semantics-placeholder[role="button"]');
    if (el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }
  });
  await page.waitForTimeout(3000);
}
async function dumpSemantics(page, name) {
  const els = await page.$$eval('flt-semantics *', (els) =>
    els.map((e) => {
      const r = e.getAttribute('role');
      const l = e.getAttribute('aria-label');
      const t = (e.getAttribute('text') || e.textContent || '').trim().replace(/\n+/g, ' | ').slice(0, 220);
      return `${e.tagName} role=${r} label=${l} text=${t}`;
    }).slice(0, 400)
  );
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(els, null, 2));
  return els;
}
async function screen(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  log(`screenshot: ${name}.png`);
}
function ehHome(els) { return els.some((e) => /PRESTADOR TESTE APP/i.test(e)); }
async function tentarLogin(page) {
  await habilitarSemantica(page);
  const email = page.locator('input[aria-label="E-mail, CPF ou CNPJ"]');
  const senha = page.locator('input[aria-label="Senha"]');
  const btn = page.locator('flt-semantics[role="button"]').filter({ hasText: 'Acessar Painel' }).first();
  await email.click({ timeout: 8000 }); await email.fill(EMAIL);
  await senha.click({ timeout: 8000 }); await senha.fill(SENHA);
  if (!(await email.inputValue().catch(() => '')) || !(await senha.inputValue().catch(() => ''))) return false;
  await btn.click({ timeout: 8000 });
  await page.waitForTimeout(11000);
  return true;
}

async function confirmarBanco() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows: aloc } = await client.query(
    `SELECT id, status, aceite_prestador, data_aceite, updated_at FROM public.alocacoes_escala WHERE id=$1`, [ALOCACAO_ID]
  );
  const { rows: hist } = await client.query(
    `SELECT id, alocacao_id, evento, status_anterior, status_novo, descricao, created_at, created_by
       FROM public.historico_alocacoes_escala WHERE alocacao_id=$1 ORDER BY created_at DESC LIMIT 3`, [ALOCACAO_ID]
  );
  await client.end();
  return { aloc: aloc[0] || null, hist };
}

async function main() {
  if (!DATABASE_URL) { log('DATABASE_URL nao definida'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { pageErrors.push(e.message); log(`[pageerror] ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error') log(`[console.error] ${m.text()}`); });

  // Rede: captura tudo que não seja token
  page.on('response', async (r) => {
    const url = r.url();
    if (!/auth\.supabase|supabase\.co/.test(url)) return;
    const tipo = url.includes('/rest/v1/') ? 'rest' : url.includes('auth/v1/token') ? 'token' : url.includes('/functions/') ? 'fn' : 'other';
    if (tipo === 'token') { rede.push({ tipo, metodo: r.request().method(), status: r.status() }); return; }
    let corpo = '';
    try {
      const txt = await r.text();
      corpo = txt.replace(/["\\]/g, '').slice(0, 400);
    } catch { corpo = '(sem corpo)'; }
    rede.push({ tipo, metodo: r.request().method(), status: r.status(), url: url.split('supabase.co')[1], corpo });
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  let logado = false;
  for (let t = 1; t <= 3; t++) {
    await tentarLogin(page);
    if (ehHome(await dumpSemantics(page, `login-${t}`))) { logado = true; log('LOGIN OK — Home reconhecida'); break; }
  }
  if (!logado) { log('FALHA no login (3 tentativas)'); fs.writeFileSync(path.join(OUT, 'rede.json'), JSON.stringify(rede, null, 2)); await browser.close(); process.exit(2); }
  await screen(page, 'pos-login');

  // Aba Rotas
  await page.locator('flt-semantics[role="tab"][aria-label="Rotas"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(3500);
  await dumpSemantics(page, 'rotas');

  // Localizar o card da operação HML pelo destino
  let card = page.locator('flt-semantics[role="button"]').filter({ hasText: DESTINO_HML }).first();
  if (await card.isVisible({ timeout: 6000 }).catch(() => false)) {
    log(`Operacao HML localizada (destino "${DESTINO_HML}")`);
  } else {
    log(`Destino "${DESTINO_HML}" nao encontrado; usando primeiro card de detalhes`);
    card = page.locator('flt-semantics[role="button"]').filter({ hasText: 'Ver detalhes' }).first();
  }
  await card.click({ timeout: 10000 });
  await page.waitForTimeout(5000);
  await dumpSemantics(page, 'detalhe-antes');

  // Iniciar (Aceitar serviço) e confirmar Aceitar no diálogo
  rede.length = 0;
  await page.locator('flt-semantics[role="button"]').filter({ hasText: /^Iniciar$/ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(4000);
  await dumpSemantics(page, 'dialog-aceite');
  const btnAceitar = page.locator('flt-semantics[role="alertdialog"] flt-semantics[role="button"]').filter({ hasText: /^Aceitar$/ }).first();
  await btnAceitar.click({ timeout: 10000 });
  await page.waitForTimeout(9000);
  await screen(page, 'pos-aceite');
  await dumpSemantics(page, 'pos-aceite');

  fs.writeFileSync(path.join(OUT, 'rede.json'), JSON.stringify(rede, null, 2));
  fs.writeFileSync(path.join(OUT, 'pageerrors.json'), JSON.stringify(pageErrors, null, 2));

  const erros = rede.filter((c) => c.status >= 400);
  log(`\nChamadas capturadas: ${rede.length} | erros 4xx/5xx: ${erros.length}`);
  for (const c of erros) log(`  ${c.metodo} ${c.url} -> ${c.status} | ${c.corpo || ''}`);
  for (const c of rede.filter((x) => !erros.includes(x) && x.tipo === 'rest')) log(`  OK ${c.metodo} ${c.url} -> ${c.status}`);

  // Confirmação no banco
  const { aloc, hist } = await confirmarBanco();
  log('\n--- CONFIRMACAO BANCO ---');
  log('ALOCACAO:', aloc ? JSON.stringify({ status: aloc.status, aceite_prestador: aloc.aceite_prestador, data_aceite: aloc.data_aceite }) : 'NAO ENCONTRADA');
  log('HISTORICO (${hist.length} registros):');
  for (const h of hist) log(`  ${h.evento} | ${h.status_anterior} -> ${h.status_novo} | ${h.created_at} | by=${h.created_by || '?'}`);

  const tem403 = erros.some((c) => c.status === 403 || (c.corpo && /42501|permission denied|violates row-level/i.test(c.corpo)));
  const aceiteOk = aloc && aloc.status !== 'aguardando_aceite' && aloc.aceite_prestador === true;
  const historicoOk = hist.length > 0;
  log(`\nRESULTADO: aceiteOk=${aceiteOk} historicoOk=${historicoOk} erroRLS=${tem403}`);

  await browser.close();
  if (tem403 || !aceiteOk || !historicoOk) {
    log('HOMOLOGACAO NÃO CONCLUÍDA — verificar acima. Nenhuma correção automática. Aguardando autorização.');
    process.exit(3);
  }
  log('HOMOLOGACAO DO ACEITE CONCLUIDA.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
