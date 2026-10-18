/**
 * TMS-031 — Fluxo homologação (passo a passo): Login robusto → Home → Perfil → Rotas.
 * Fluxo normal do App. Nenhum SQL. Nenhum UPDATE manual.
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
    }).slice(0, 300)
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
function ehLogin(els) { return els.some((e) => /Acessar Painel/i.test(e)); }

async function tentarLogin(page) {
  await habilitarSemantica(page);
  const email = page.locator('input[aria-label="E-mail, CPF ou CNPJ"]');
  const senha = page.locator('input[aria-label="Senha"]');
  const btn = page.locator('flt-semantics[role="button"]').filter({ hasText: 'Acessar Painel' }).first();

  await email.click({ timeout: 8000 });
  await page.waitForTimeout(400);
  await email.fill(EMAIL);
  await page.waitForTimeout(500);

  await senha.click({ timeout: 8000 });
  await page.waitForTimeout(400);
  await senha.fill(SENHA);
  await page.waitForTimeout(500);

  const em = await email.inputValue().catch(() => '');
  const se = await senha.inputValue().catch(() => '');
  log(`campos: email="${em ? 'OK' : 'VAZIO'}" senha="${se ? 'OK' : 'VAZIO'}"`);
  if (!em || !se) return false;

  await btn.click({ timeout: 8000 });
  await page.waitForTimeout(11000);
  return true;
}

async function clicarTab(page, nome) {
  const tab = page.locator(`flt-semantics[role="tab"][aria-label="${nome}"]`).first();
  await tab.click({ timeout: 8000 });
  await page.waitForTimeout(3500);
  log(`Tab "${nome}" aberta`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);

  let ok = false;
  for (let t = 1; t <= 3 && !ok; t++) {
    log(`\nTentativa ${t}/3 login`);
    await tentarLogin(page);
    const els = await dumpSemantics(page, `login-tentativa-${t}`);
    if (ehHome(els)) { ok = true; }
    else if (ehLogin(els)) log('⚠️ ainda na tela de login');
    else log('⚠️ estado indeterminado');
  }
  if (!ok) throw new Error('Login NOK após 3 tentativas');

  // HOME
  await screen(page, 'A-home');
  await dumpSemantics(page, 'A-home');

  // PERFIL
  await clicarTab(page, 'Perfil');
  await screen(page, 'B-perfil');
  const perfil = await dumpSemantics(page, 'B-perfil');

  // ROTAS
  await clicarTab(page, 'Rotas');
  await screen(page, 'C-rotas');
  const rotas = await dumpSemantics(page, 'C-rotas');

  await browser.close();
  log('\nFim fluxo navegação.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
