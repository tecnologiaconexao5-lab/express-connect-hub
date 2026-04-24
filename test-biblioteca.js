import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleErrors = [];
  const pageErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });
  
  try {
    console.log('1. Acessando página de login...');
    await page.goto('http://localhost:8800/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // Fill login form with valid credentials
    console.log('2. Preenchendo credenciais...');
    await page.fill('input[type="email"], input[name="email"], input[type="text"]', 'admin@conexaoexpress.com.br');
    await page.fill('input[type="password"]', 'admin123');
    
    // Click login button
    console.log('3. Clicando no botão de login...');
    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      await loginButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(2000);
    
    // Try accessing biblioteca
    console.log('4. Acessando /biblioteca...');
    await page.goto('http://localhost:8800/biblioteca', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get current URL
    const currentUrl = page.url();
    console.log('URL atual:', currentUrl);
    
    // Get title/heading
    const heading = await page.$('h1');
    const title = heading ? await heading.textContent() : 'Não encontrado';
    console.log('TÍTULO ENCONTRADO:', title);
    
    // Get body text
    const bodyText = await page.textContent('body');
    const hasBibliotecaContent = bodyText.includes('Biblioteca') || bodyText.includes('Manuais');
    console.log('Tem conteúdo da Biblioteca:', hasBibliotecaContent);
    
    const isWhiteScreen = bodyText.length < 50;
    console.log('Tela branca:', isWhiteScreen);
    
    // Report results
    console.log('\n=== RESULTADO DO TESTE ===');
    console.log('Console Errors:', consoleErrors.length > 0 ? consoleErrors : 'NENHUM');
    console.log('Page Errors:', pageErrors.length > 0 ? pageErrors : 'NENHUM');
    console.log('Título:', title);
    console.log('URL:', currentUrl);
    console.log('Tem conteúdo Biblioteca:', hasBibliotecaContent ? 'SIM' : 'NÃO');
    console.log('Tela branca:', isWhiteScreen ? 'SIM' : 'NÃO');
    
    // Check specifically for the error "nome is not defined"
    const hasNomeError = consoleErrors.some(e => e.toLowerCase().includes('nome')) || pageErrors.some(e => e.toLowerCase().includes('nome'));
    
    if (hasNomeError) {
      console.log('\n*** REPROVADO - Erro com "nome" encontrado ***');
      console.log('Erros:', consoleErrors, pageErrors);
      process.exit(1);
    } else if (consoleErrors.length > 0 || pageErrors.length > 0) {
      console.log('\n*** REPROVADO - Há outros erros ***');
      process.exit(1);
    } else if (isWhiteScreen) {
      console.log('\n*** REPROVADO - Tela branca ***');
      process.exit(1);
    } else {
      console.log('\n*** APROVADO - Biblioteca carregou sem erro de "nome" ***');
      process.exit(0);
    }
    
  } catch (error) {
    console.log('ERRO DURANTE TESTE:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();