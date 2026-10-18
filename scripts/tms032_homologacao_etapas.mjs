/**
 * TMS-032 — Homologação pós-aceite: avançar ETAPAS na PWA App Prestador.
 *
 * Contexto: Migration 1 (P0) já aplicada e aceite homologado. Este script
 * tenta a PRÓXIMA etapa natural do fluxo (Cheguei no cliente/CD → Iniciar),
 * exercitando o caminho de avanço de etapas do App (RPC/UPDATE).
 *
 * Parada obrigatória: qualquer erro novo de RLS/RPC/trigger/função encerra
 * o script e NÃO corrige nada — apenas reporta (autorização pendente).
 */
import { chromium } from 'playwright';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const APP_URL = 'https://prestador-app.pages.dev';
const EMAIL = 'infraestruturaconexao@gmail.com';
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
function log(msg) { console.log(`[tms032-etapas] ${msg}`); }
const rede = [];

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
      const t = (e.getAttribute('text') || e.textContent || '').trim().replace(/\n+/g, ' | ').slice(0, 200);
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
    `SELECT id, status, aceite_prestador, updated_at FROM public.alocacoes_escala WHERE id=$1`, [ALOCACAO_ID]
  );
  const { rows: hist } = await client.query(
    `SELECT evento, status_anterior, status_novo, created_at FROM public.historico_alocacoes_escala
       WHERE alocacao_id=$1 ORDER BY created_at DESC LIMIT 5`, [ALOCACAO_ID]
  );
  const { rows: tle } = await client.query(
    `SELECT type, title, event_time FROM public.operation_timeline_events
       WHERE operation_id=$1 ORDER BY event_time DESC LIMIT 5`, [ALOCACAO_ID]
  );
  await client.end();
  return { aloc: aloc[0] || null, hist, tle };
}

async function main() {
  if (!DATABASE_URL) { log('DATABASE_URL nao definida'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

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
    if (ehHome(await dumpSemantics(page, `etapas-login-${t}`))) { logado = true; break; }
  }
  if (!logado) { log('FALHA no login'); await browser.close(); process.exit(2); }

  await page.locator('flt-semantics[role="tab"][aria-label="Rotas"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(3500);
  let card = page.locator('flt-semantics[role="button"]').filter({ hasText: DESTINO_HML }).first();
  if (!(await card.isVisible({ timeout: 6000 }).catch(() => false))) {
    card = page.locator('flt-semantics[role="button"]').filter({ hasText: 'Ver detalhes' }).first();
  }
  await card.click({ timeout: 10000 });
  await page.waitForTimeout(5000);
  await dumpSemantics(page, 'etapas-detalhe');
  fs.writeFileSync(path.join(OUT, 'rede-sessao-etapas.json'), JSON.stringify(rede, null, 2));

  // Se o app ainda exibir o diálogo de aceite (estado local defasado), reconfirmar
  let dialogAceite = page.locator('flt-semantics[role="alertdialog"] flt-semantics[role="button"]').filter({ hasText: /^Aceitar$/ }).first();
  if (await dialogAceite.isVisible({ timeout: 6000 }).catch(() => false)) {
    log('Dialogo de aceite presente (estado local defasado). Reconfirmando aceite...');
    rede.length = 0;
    await dialogAceite.click({ timeout: 10000 });
    await page.waitForTimeout(9000);
    await screen(page, 'etapas-pos-reaceite');
    await dumpSemantics(page, 'etapas-pos-reaceite');
  }

  // Próxima etapa natural: "Iniciar" (Cheguei no cliente/CD) — já aceita, botão deve estar habilitado
  rede.length = 0;
  const btnIniciar = page.locator('flt-semantics[role="button"]').filter({ hasText: /^Iniciar$/ }).first();
  if (await btnIniciar.isVisible({ timeout: 8000 }).catch(() => false)) {
    log('Clicando Iniciar (Cheguei no cliente/CD)...');
    await btnIniciar.click({ timeout: 10000 });
    await page.waitForTimeout(8000);
    await screen(page, 'etapas-pos-iniciar');
    await dumpSemantics(page, 'etapas-pos-iniciar');
  } else {
    log('Botao Iniciar nao visivel. Verificando estado atual.');
  }

  fs.writeFileSync(path.join(OUT, 'rede-etapas.json'), JSON.stringify(rede, null, 2));
  const erros = rede.filter((c) => c.status >= 400);
  log(`\nChamadas: ${rede.length} | erros 4xx/5xx: ${erros.length}`);
  for (const c of erros) log(`  ${c.metodo} ${c.url} -> ${c.status} | ${c.corpo || ''}`);
  for (const c of rede.filter((x) => !erros.includes(x) && (x.tipo === 'rest' || x.tipo === 'fn'))) log(`  OK ${c.metodo} ${c.url} -> ${c.status}`);

  const { aloc, hist, tle } = await confirmarBanco();
  log('\n--- CONFIRMACAO BANCO ---');
  log('ALOCACAO:', aloc ? JSON.stringify({ status: aloc.status, aceite_prestador: aloc.aceite_prestador }) : 'NAO ENCONTRADA');
  log('HISTORICO:');
  for (const h of hist) log(`  ${h.evento} | ${h.status_anterior} -> ${h.status_novo} | ${h.created_at}`);
  log('TIMELINE:');
  for (const t of tle) log(`  ${t.type} | ${t.title} | ${t.event_time}`);

  const temErroRls = erros.some((c) => c.status >= 400);
  log(`\nRESULTADO: erros=${temErroRls}`);
  await browser.close();
  if (temErroRls) {
    log('BLOQUEIO — erro de RLS/RPC/trigger/funcao. Nenhuma correcao automatica. Aguardando autorizacao.');
    process.exit(3);
  }
  log('ETAPAS: sem novos erros RLS neste passo.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
