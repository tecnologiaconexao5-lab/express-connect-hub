/**
 * TMS-031 — Força primeiro toque para ativar acessibilidade do Flutter e descreve a tela.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const APP_URL = 'https://prestador-app.pages.dev';
const OUT = path.resolve(process.cwd(), 'test-results', 'tms031', 'probe3');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  // Primeiro toque no centro da tela
  await page.mouse.click(206, 450);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, '01-apos-toque.png') });

  const aria = await page.$$eval('[aria-label]', (els) =>
    els.slice(0, 100).map((e) => `label=${e.getAttribute('aria-label')} role=${e.getAttribute('role')} tag=${e.tagName}`)
  );
  console.log('\n--- aria-label (100) ---');
  for (const s of aria) console.log(s);

  const bodyText = await page.evaluate(() => (document.body.innerText || '').slice(0, 2500));
  console.log('\n--- body text ---\n' + bodyText);

  await browser.close();
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
