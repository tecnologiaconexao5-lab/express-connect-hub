/**
 * TMS-031 — Navegação pós-login: Perfil (nome/veículo) e Rotas (operações).
 * Fluxo normal do App. Nenhum SQL. Nenhum UPDATE.
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
      const t = (e.getAttribute('text') || e.textContent || '').trim().replace(/\n+/g, ' | ').slice(0, 200);
      return `${e.tagName} role=${r} label=${l} text=${t}`;
    }).slice(0, 250)
  );
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(els, null, 2));
  log(`${name}: ${els.length} nós`);
}
async function screen(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  log(`📸 ${name}.png`);
}
async function clicarTab(page, nome) {
  const tab = page.locator(`flt-semantics[role="tab"][aria-label="${nome}"]`).first();
  await tab.click({ timeout: 8000 });
  await page.waitForTimeout(3000);
  log(`Tab "${nome}" clicada`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  await habilitarSemantica(page);

  await page.locator('input[aria-label="E-mail, CPF ou CNPJ"]').fill(EMAIL);
  await page.locator('input[aria-label="Senha"]').fill(SENHA);
  await page.locator('flt-semantics[role="button"]').filter({ hasText: 'Acessar Painel' }).first().click();
  await page.waitForTimeout(9000);
  await screen(page, '03-home');
  await dumpSemantics(page, '03-home');

  // Aba Perfil
  await clicarTab(page, 'Perfil');
  await screen(page, '04-perfil');
  await dumpSemantics(page, '04-perfil');

  // Aba Rotas
  await clicarTab(page, 'Rotas');
  await screen(page, '05-rotas');
  await dumpSemantics(page, '05-rotas');

  await browser.close();
  log('Fim navegação.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
