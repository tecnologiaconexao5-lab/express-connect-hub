/**
 * TMS-031 — LOGIN real no App Prestador via árvore de semântica Flutter.
 * Nenhum SQL. Nenhum UPDATE. Fluxo normal do App.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const APP_URL = 'https://prestador-app.pages.dev';
const EMAIL = 'infraestruturaconexao@gmail.com';
const SENHA = 'Di241328!';
const OUT = path.resolve(process.cwd(), 'test-results', 'tms031', 'homologacao');
fs.mkdirSync(OUT, { recursive: true });

function log(msg) { console.log(`[tms031] ${msg}`); }
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
      const t = (e.getAttribute('text') || e.textContent || '').trim().slice(0, 160);
      return `${e.tagName} role=${r} label=${l} text=${t}`;
    }).slice(0, 200)
  );
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(els, null, 2));
  log(`${name}: ${els.length} nós`);
}
async function screen(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  log(`📸 ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  await habilitarSemantica(page);

  // Preenche email
  const emailInput = page.locator('input[aria-label="E-mail, CPF ou CNPJ"]');
  await emailInput.fill(EMAIL);
  log('Email preenchido');
  await page.waitForTimeout(500);

  // Preenche senha
  const senhaInput = page.locator('input[aria-label="Senha"]');
  await senhaInput.fill(SENHA);
  log('Senha preenchida');
  await screen(page, '01-form-preenchido');
  await dumpSemantics(page, '01-form-preenchido');

  // Clica em "Acessar Painel"
  const btn = page.locator('flt-semantics[role="button"]').filter({ hasText: 'Acessar Painel' }).first();
  log('Clicando em Acessar Painel...');
  await btn.click({ timeout: 8000 });
  await page.waitForTimeout(10000);
  await screen(page, '02-pos-login');
  await dumpSemantics(page, '02-pos-login');

  await browser.close();
  log('Fim login.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
