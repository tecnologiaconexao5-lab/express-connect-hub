/**
 * TMS-031 — Diagnóstico de login do App: árvore de semântica Flutter + rede (sem segredos).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const APP_URL = 'https://prestador-app.pages.dev';
const EMAIL = 'infraestruturaconexao@gmail.com';
const SENHA = 'Di241328!';
const OUT = path.resolve(process.cwd(), 'test-results', 'tms031', 'probe4');
fs.mkdirSync(OUT, { recursive: true });

function log(msg) { console.log(`[tms031] ${msg}`); }
async function digitar(page, str, delay = 25) {
  for (const ch of str) { await page.keyboard.press(ch, { delay }); }
}
async function dumpSemantics(page, name) {
  const els = await page.$$eval('flt-semantics *', (els) =>
    els.map((e) => {
      const r = e.getAttribute('role');
      const l = e.getAttribute('aria-label');
      const t = (e.getAttribute('text') || e.textContent || '').trim().slice(0, 120);
      const isFocus = e.getAttribute('is-focused');
      const tagname = e.tagName;
      return `${tagname} role=${r} label=${l} focus=${isFocus} text=${t}`;
    }).slice(0, 200)
  );
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(els, null, 2));
  log(`${name}: ${els.length} nós de semântica`);
  for (const e of els.slice(0, 60)) log('  ' + e);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

  // Captura chamadas de auth/rede (só status e códigos, NUNCA tokens)
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('auth/v1/token') || url.includes('auth/v1/user')) {
      log(`[rede] ${r.request().method()} ${url.split('?')[0]} → ${r.status()}`);
    }
    if (url.includes('rest/v1/') && (url.includes('prestadores') || url.includes('alocacoes') || url.includes('driver_profiles') || url.includes('veiculos'))) {
      log(`[rede] ${r.request().method()} ${url.split('?')[0].split('rest/v1/')[1]} → ${r.status()}`);
    }
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(10000);
  await dumpSemantics(page, '00-pre-login');

  // Login por teclado (padrão F18)
  log('Digitando email...');
  await digitar(page, EMAIL);
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  log('Digitando senha...');
  await digitar(page, SENHA);
  await page.waitForTimeout(300);
  await dumpSemantics(page, '01-pre-submit');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(10000);
  await dumpSemantics(page, '02-pos-login');

  await browser.close();
  log('Fim.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
