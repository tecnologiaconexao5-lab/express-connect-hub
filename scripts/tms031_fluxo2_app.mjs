/**
 * TMS-031 — Perfil (com scroll) + abrir operação HML em detalhes.
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
async function rolar(page, steps = 6) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);
  }
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
async function clicarTab(page, nome) {
  await page.locator(`flt-semantics[role="tab"][aria-label="${nome}"]`).first().click({ timeout: 8000 });
  await page.waitForTimeout(3500);
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
    if (ehHome(await dumpSemantics(page, `login-${t}`))) break;
  }
  log('✅ Logado');

  // PERFIL com scroll
  await clicarTab(page, 'Perfil');
  await rolar(page, 5);
  await screen(page, 'D-perfil-scroll');
  await dumpSemantics(page, 'D-perfil-scroll');

  // ROTAS e abrir primeira operação pendente (HML)
  await clicarTab(page, 'Rotas');
  await dumpSemantics(page, 'E-rotas-list');
  const btn = page.locator('flt-semantics[role="button"]').filter({ hasText: 'Ver detalhes' }).first();
  log('Abrindo primeira operação pendente (Ver detalhes)...');
  await btn.click({ timeout: 10000 });
  await page.waitForTimeout(5000);
  await screen(page, 'F-operacao-detalhe');
  await dumpSemantics(page, 'F-operacao-detalhe');

  await browser.close();
  log('\nFim.');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
