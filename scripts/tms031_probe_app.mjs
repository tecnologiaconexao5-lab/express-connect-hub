/**
 * TMS-031 — Reconhecimento do App Prestador (Flutter PWA) — SOMENTE LEITURA
 * Abre o app, captura screenshot e descreve os elementos acessíveis da tela de login.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const APP_URL = 'https://prestador-app.pages.dev';
const OUT = path.resolve(process.cwd(), 'test-results', 'tms031', 'probe');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(10000);
  await page.screenshot({ path: path.join(OUT, '01-login.png') });

  const inputs = await page.locator('input, textarea').count();
  console.log('inputs/textarea:', inputs);

  // Elementos com acessibilidade do Flutter
  const sem = await page.$$eval('flt-semantics, [aria-label], [role]', (els) =>
    els.slice(0, 60).map((e) => {
      const a = e.getAttribute('aria-label') || e.getAttribute('label') || '';
      const r = e.getAttribute('role') || '';
      const tag = e.tagName;
      const text = (e.textContent || '').trim().slice(0, 60);
      return `${tag} role=${r} label=${a} text=${text}`;
    })
  );
  console.log('\n--- semantics/aria (60) ---');
  for (const s of sem) console.log(s);

  // Body text
  const bodyText = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 1500) : '');
  console.log('\n--- body text ---');
  console.log(bodyText);

  // input descriptions
  const inputInfo = await page.$$eval('input, textarea', (els) =>
    els.map((e) => `tag=${e.tagName} type=${e.getAttribute('type')} placeholder=${e.getAttribute('placeholder')} aria-label=${e.getAttribute('aria-label')}`)
  );
  console.log('\n--- inputs ---');
  for (const i of inputInfo) console.log(i);

  await browser.close();
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
