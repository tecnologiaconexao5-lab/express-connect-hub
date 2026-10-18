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
  
  const result = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { error: 'no dialog' };
    
    // Find the fornecedor input
    const inputs = Array.from(dialog.querySelectorAll('input'));
    const fornInput = inputs.find(i => i.placeholder && i.placeholder.includes('Fornecedor'));
    if (!fornInput) return { error: 'no fornecedor input' };
    
    const fiberKey = Object.keys(fornInput).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return { error: 'no fiber key on input' };
    
    const fiber = fornInput[fiberKey];
    
    // Walk up from input fiber to find onSelect in memoizedProps or props
    let cur = fiber;
    const findings = [];
    for (let i = 0; i < 40 && cur; i++) {
      const props = cur.memoizedProps || cur.pendingProps || {};
      const propKeys = Object.keys(props);
      
      // Look for onSelect, setForm, form, or dispatch in props
      const interesting = propKeys.filter(k => 
        ['onSelect', 'setForm', 'form', 'dispatch', 'setErros'].includes(k) ||
        (typeof props[k] === 'function' && k.startsWith('set'))
      );
      
      if (interesting.length > 0 || propKeys.includes('children')) {
        findings.push({
          depth: i,
          tag: typeof cur.type === 'function' ? (cur.type.name || 'anon') : String(cur.type || '?'),
          propKeys: propKeys.slice(0, 15),
          interesting,
        });
      }
      
      // Check for form state in memoizedState
      if (cur.memoizedState) {
        let hook = cur.memoizedState;
        let idx = 0;
        while (hook && idx < 30) {
          if (hook.memoizedState && typeof hook.memoizedState === 'object' && hook.memoizedState !== null) {
            const ms = hook.memoizedState;
            if (ms && typeof ms === 'object' && !Array.isArray(ms) && 'favorecidoNome' in ms) {
              findings.push({
                depth: i,
                hookIdx: idx,
                FOUND_FORM_STATE: true,
                formState: { favorecidoNome: ms.favorecidoNome, vencimento: ms.vencimento, categoria: ms.categoria, valorOriginal: ms.valorOriginal }
              });
            }
          }
          // Also check queue.lastRenderedState
          if (hook.queue && hook.queue.lastRenderedState && typeof hook.queue.lastRenderedState === 'object') {
            const lrs = hook.queue.lastRenderedState;
            if (lrs && typeof lrs === 'object' && 'favorecidoNome' in lrs) {
              findings.push({
                depth: i,
                hookIdx: idx,
                FOUND_VIA_QUEUE: true,
                formState: { favorecidoNome: lrs.favorecidoNome }
              });
            }
          }
          hook = hook.next;
          idx++;
        }
      }
      
      cur = cur.return;
    }
    
    return { findings };
  });
  
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
