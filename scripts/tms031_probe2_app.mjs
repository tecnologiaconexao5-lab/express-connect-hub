/**
 * TMS-031 — Ativa acessibilidade do Flutter web e descreve a tela de login.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const APP_URL = 'https://prestador-app.pages.dev';
const OUT = path.resolve(process.cwd(), 'test-results', 'tms031', 'probe2');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  // Tenta clicar no placeholder de acessibilidade
  const ph = page.locator('flt-semantics-placeholder, flt-semantics [role="button"]').first();
  try {
    await ph.click({ timeout: 5000 });
    console.log('✅ clicou no placeholder/accessibility');
  } catch {
    console.log('⚠️ não clicou via locator, tentando clique por coordenada do placeholder');
    const box = await page.evaluate(() => {
      const el = document.querySelector('flt-semantics-placeholder, flt-semantics');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    });
    if (box) {
      await page.mouse.click(box.x, box.y);
      console.log('clicou em', JSON.stringify(box));
    }
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, '01-pos-enable.png') });

  const aria = await page.$$eval('[aria-label]', (els) =>
    els.slice(0, 80).map((e) => `label=${e.getAttribute('aria-label')} role=${e.getAttribute('role')} tag=${e.tagName}`)
  );
  console.log('\n--- aria-label (80) ---');
  for (const s of aria) console.log(s);

  const inputs = await page.$$eval('input', (els) =>
    els.map((e) => `type=${e.getAttribute('type')} placeholder=${e.getAttribute('placeholder')} aria-label=${e.getAttribute('aria-label')}`)
  );
  console.log('\n--- inputs ---');
  for (const i of inputs) console.log(i);

  const bodyText = await page.evaluate(() => (document.body.innerText || '').slice(0, 2000));
  console.log('\n--- body text ---\n' + bodyText);

  await browser.close();
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
