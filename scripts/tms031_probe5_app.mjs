/**
 * TMS-031 — Habilita acessibilidade Flutter por múltiplos métodos e verifica.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const APP_URL = 'https://prestador-app.pages.dev';
const OUT = path.resolve(process.cwd(), 'test-results', 'tms031', 'probe5');
fs.mkdirSync(OUT, { recursive: true });

function log(msg) { console.log(`[tms031] ${msg}`); }
async function dumpSemantics(page, name) {
  const els = await page.$$eval('flt-semantics *', (els) =>
    els.map((e) => {
      const r = e.getAttribute('role');
      const l = e.getAttribute('aria-label');
      const t = (e.getAttribute('text') || e.textContent || '').trim().slice(0, 120);
      return `${e.tagName} role=${r} label=${l} text=${t}`;
    }).slice(0, 120)
  );
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(els, null, 2));
  log(`${name}: ${els.length} nós`);
  for (const e of els.slice(0, 50)) log('  ' + e);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);

  // Método 1: click com force no placeholder
  try {
    await page.locator('flt-semantics-placeholder[role="button"]').click({ force: true, timeout: 5000 });
    log('✅ M1: click force no placeholder');
  } catch (e) { log(`M1 falhou: ${e.message.split('\n')[0]}`); }
  await page.waitForTimeout(3000);
  let n = await page.$$eval('flt-semantics *', (els) => els.length);
  log(`após M1: ${n} nós`);

  if (n === 0) {
    // Método 2: dispatchEvent via JS
    await page.evaluate(() => {
      const el = document.querySelector('flt-semantics-placeholder[role="button"]');
      if (el) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      }
    });
    await page.waitForTimeout(3000);
    n = await page.$$eval('flt-semantics *', (els) => els.length);
    log(`após M2: ${n} nós`);
  }

  if (n === 0) {
    // Método 3: clique no canvas (posições da área de login)
    for (const [x, y] of [[206, 300], [206, 380], [206, 460], [206, 540]]) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(1200);
      n = await page.$$eval('flt-semantics *', (els) => els.length);
      log(`após click(${x},${y}): ${n} nós`);
      if (n > 0) break;
    }
  }

  await dumpSemantics(page, 'final');
  await page.screenshot({ path: path.join(OUT, 'final.png') });
  await browser.close();
}
main().catch((e) => { console.error('ERRO', e); process.exit(1); });
