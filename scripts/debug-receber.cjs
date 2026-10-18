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
  
  await page.goto('http://localhost:8801/financeiro?tab=receber', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  await page.getByRole('button', { name: /Nova Receita/i }).click();
  await page.waitForTimeout(2000);
  
  const result = await page.evaluate(() => {
    const logs = [];
    
    function findReactFiber(el) {
      for (const key of Object.keys(el)) {
        if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
          return el[key];
        }
      }
      return null;
    }
    
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { error: 'no dialog' };
    
    // Scan all elements for form state
    const allEls = dialog.querySelectorAll('*');
    const formStates = [];
    
    for (const el of Array.from(allEls)) {
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) continue;
      
      let cur = el[fiberKey];
      for (let depth = 0; depth < 50 && cur; depth++) {
        if (cur.memoizedState) {
          let hook = cur.memoizedState;
          let idx = 0;
          while (hook && idx < 30) {
            // Check memoizedState directly
            if (hook.memoizedState && typeof hook.memoizedState === 'object' && hook.memoizedState !== null) {
              const ms = hook.memoizedState;
              if (typeof ms === 'object' && !Array.isArray(ms) && ms !== null) {
                const keys = Object.keys(ms);
                if (keys.includes('clienteId') || keys.includes('clienteNome') || keys.includes('categoriaFinanceira')) {
                  formStates.push({
                    foundAt: `element <${el.tagName}> depth=${depth} hookIdx=${idx}`,
                    stateKeys: keys.slice(0, 15),
                    clienteId: ms.clienteId,
                    clienteNome: ms.clienteNome,
                    categoriaFinanceira: ms.categoriaFinanceira,
                  });
                }
              }
            }
            // Check queue.lastRenderedState
            if (hook.queue && hook.queue.lastRenderedState && typeof hook.queue.lastRenderedState === 'object') {
              const lrs = hook.queue.lastRenderedState;
              if (lrs && typeof lrs === 'object' && !Array.isArray(lrs)) {
                const keys = Object.keys(lrs);
                if (keys.includes('clienteId') || keys.includes('clienteNome') || keys.includes('categoriaFinanceira')) {
                  formStates.push({
                    foundAt: `queue element <${el.tagName}> depth=${depth} hookIdx=${idx}`,
                    stateKeys: keys.slice(0, 15),
                    clienteId: lrs.clienteId,
                    hasDispatch: typeof hook.queue.dispatch === 'function',
                  });
                }
              }
            }
            hook = hook.next;
            idx++;
          }
        }
        cur = cur.return;
      }
    }
    
    return { formStates, totalElements: allEls.length };
  });
  
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
