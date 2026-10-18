const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:8801/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').first().fill('tamiris.castilho@conexaoexpress.com.br');
  await page.locator('input[type="password"]').first().fill('Conexao@2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  
  await page.goto('http://localhost:8801/financeiro?tab=pagar', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  await page.getByRole('button', { name: /Nova Despesa/i }).click();
  await page.waitForTimeout(2000);
  
  const debugInfo = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { hasDialog: false };
    
    const info = { hasDialog: true, childCount: dialog.children.length };
    const allEls = dialog.querySelectorAll('*');
    info.totalElements = allEls.length;
    
    // Find ALL elements with React fiber keys
    const reactEls = [];
    for (let i = 0; i < allEls.length; i++) {
      const el = allEls[i];
      const keys = Object.keys(el).filter(k => k.startsWith('__react'));
      if (keys.length > 0) {
        reactEls.push({ tag: el.tagName, idx: i, keyNames: keys });
      }
    }
    info.reactElementsCount = reactEls.length;
    info.firstFewReactEls = reactEls.slice(0, 10);
    
    // Find the fornecedor input
    const inputs = Array.from(dialog.querySelectorAll('input'));
    info.inputCount = inputs.length;
    info.inputPlaceholders = inputs.map(i => i.placeholder);
    
    const fornInput = inputs.find(i => i.placeholder && i.placeholder.includes('Fornecedor'));
    if (fornInput) {
      const fiberKey = Object.keys(fornInput).find(k => k.startsWith('__reactFiber'));
      if (fiberKey) {
        const fiber = fornInput[fiberKey];
        // Walk up fiber tree looking for setForm
        let cur = fiber;
        const ancestors = [];
        for (let i = 0; i < 30 && cur; i++) {
          const stateKeys = [];
          if (cur.memoizedState) {
            let hook = cur.memoizedState;
            let idx = 0;
            while (hook && idx < 30) {
              if (hook.queue && hook.queue.lastRenderedState && typeof hook.queue.lastRenderedState === 'object') {
                const s = hook.queue.lastRenderedState;
                if (s && typeof s === 'object') {
                  const sk = Object.keys(s).slice(0, 10);
                  stateKeys.push({ hookIdx: idx, stateKeys: sk });
                }
              }
              hook = hook.next;
              idx++;
            }
          }
          ancestors.push({
            depth: i,
            tag: typeof cur.type === 'function' ? cur.type.name || 'anonymous' : String(cur.type || 'unknown'),
            stateHooks: stateKeys,
          });
          cur = cur.return;
        }
        info.fiberAncestors = ancestors;
      } else {
        info.fornInputFiberKey = null;
        info.fornInputAllKeys = Object.keys(fornInput).filter(k => k.startsWith('__'));
      }
    }
    
    return info;
  });
  
  console.log(JSON.stringify(debugInfo, null, 2));
  await browser.close();
})();
