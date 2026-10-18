/**
 * TMS-031 — Homologação App Prestador (Flutter PWA) — ETAPAS 1 e 2
 * Login + verificação de Home/Perfil/Veículo + listagem de operações.
 * Nenhum SQL. Nenhum UPDATE. Apenas o fluxo normal do App.
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
async function screen(page, name) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  log(`📸 screenshot: ${name}.png`);
}
async function dump(page, name) {
  const txt = await page.evaluate(() => (document.body.innerText || '').slice(0, 3000));
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt || '(sem texto)');
}
async function digitar(page, str, delay = 25) {
  for (const ch of str) { await page.keyboard.press(ch, { delay }); }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') log(`[console.error] ${m.text()}`); });

  log(`Abrindo ${APP_URL}`);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(10000);
  await screen(page, '01-app-login');
  await dump(page, '01-app-login');

  // --- LOGIN (padrão F18: campo autofocado, teclado) ---
  log('Digitando email...');
  await digitar(page, EMAIL);
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  log('Digitando senha...');
  await digitar(page, SENHA);
  await page.waitForTimeout(300);
  await screen(page, '02-pre-submit');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(9000);
  await screen(page, '03-pos-login');
  await dump(page, '03-pos-login');

  // Detecta se ainda estamos na tela de login (falha de autenticação)
  const txtPos = await page.evaluate(() => (document.body.innerText || '').slice(0, 800));
  const aindaLogin = /Entrar|Login|Senha|email/i.test(txtPos) && !/Home|Operações|Operacoes/i.test(txtPos);
  log(`Pós-login texto: "${txtPos.replace(/\s+/g, ' ').slice(0, 200)}"`);
  log(`Ainda em tela de login? ${aindaLogin}`);

  // Tenta habilitar acessibilidade pós-login para leitura de DOM
  try {
    const btn = page.locator('flt-semantics-placeholder[role="button"]').first();
    await btn.click({ timeout: 3000, force: true });
    await page.waitForTimeout(2000);
    log('✅ acessibilidade pós-login habilitada');
  } catch {
    log('⚠️ acessibilidade não habilitada (segue com teclado)');
  }
  await screen(page, '04-pos-acessibilidade');
  await dump(page, '04-pos-acessibilidade');

  const aria = await page.$$eval('[aria-label]', (els) =>
    els.slice(0, 120).map((e) => `label=${e.getAttribute('aria-label')} role=${e.getAttribute('role')} tag=${e.tagName}`)
  );
  fs.writeFileSync(path.join(OUT, '05-aria.json'), JSON.stringify(aria, null, 2));
  log(`Elementos com aria-label: ${aria.length}`);

  await browser.close();
  log('Fim da etapa de login. Ver arquivos em test-results/tms031/homologacao/');
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
