/**
 * TMS-031 — Confirmar ACEITE da operação HML (diálogo "Aceitar").
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
      const t = (e.getAttribute('text') || e.textContent || '').trim().replace(/\n+/g, ' | ').slice(0, 220);
      return `${e.tagName} role=${r} label=${l} text=${t}`;
    }).slice(0, 350)
  );
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(els, null, 2));
  return els;
}
async function screen(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  log(`📸 ${name}.png`);
}
function ehHome(els) { return els.some((e) => /PRESTADOR TESTE APP/i.test(e)); }
async function tentarLogin(page) {
  await habilitarSemantica(page);
  const email = page.locator('input[aria-label="E-mail, CPF ou CNPJ"]');
  const senha = page.locator('input[aria-label="Senha"]');
  const btn = page.locator('flt-semantics[role="button"]').filter({ hasText: 'Acessar Painel' }).first();
  await email.click({ timeout: 8000 }); await email.fill(EMAIL);
  await senha.click({ timeout: 8000 }); await senha.fill(SENHA);
  const em = await email.inputValue().catch(() => '');
  const se = await senha.inputValue().catch(() => '');
  if (!em || !se) return false;
  await btn.click({ timeout: 8000 });
  await page.waitForTimeout(11000);
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  for (let t = 1; t <= 3; t++) {
    await tentarLogin(page);
    if (ehHome(await dumpSemantics(page, `log-${t}`))) break;
  }
  log('✅ Logado');

  // Rotas → primeira operação → Iniciar → Aceitar
  await page.locator('flt-semantics[role="tab"][aria-label="Rotas"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(3500);
  await page.locator('flt-semantics[role="button"]').filter({ hasText: 'Ver detalhes' }).first().click({ timeout: 10000 });
  await page.waitForTimeout(5000);

  await page.locator('flt-semantics[role="button"]').filter({ hasText: /^Iniciar$/ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(4000);
  await dumpSemantics(page, 'dialog-antes-confirmar');

  // Confirmar no diálogo
  const btnAceitar = page.locator('flt-semantics[role="alertdialog"] flt-semantics[role="button"]').filter({ hasText: /^Aceitar$/ }).first();
  log('Confirmando aceite...');
  await btnAceitar.click({ timeout: 10000 });
  await page.waitForTimeout(8000);
  await screen(page, 'aceite-confirmado');
  await dumpSemantics(page, 'aceite-confirmado');

  await browser.close();
  log('Fim confirmação aceite.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
