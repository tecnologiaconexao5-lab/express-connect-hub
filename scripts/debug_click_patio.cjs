const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "tamiris.castilho@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log("URL:", page.url());

  // Expande sidebar
  const sidebar = page.locator("aside").first();
  await sidebar.hover({ force: true });
  await page.waitForTimeout(1000);

  // Clica no Apoio Operacional para expandir
  await page.locator("aside button:has-text('Apoio Operacional')").click();
  await page.waitForTimeout(1000);

  // Screenshot antes
  await page.screenshot({ path: "test-results/e2e/controle-patio/expanded.png" });

  // Clica em Controle de Patio
  await page.locator("aside button:has-text('Controle de Patio')").click();
  await page.waitForTimeout(3000);

  console.log("URL apos clique:", page.url());
  const body = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log("Conteudo:", body);

  await page.screenshot({ path: "test-results/e2e/controle-patio/patio-page.png" });

  // Tenta navegar diretamente sem recarregar a pagina
  await page.evaluate(() => {
    const navEvent = new PopStateEvent("popstate");
    window.history.pushState({}, "", "/controle-patio");
    window.dispatchEvent(navEvent);
  });
  await page.waitForTimeout(3000);
  console.log("URL apos pushState:", page.url());

  // Clica nos botoes da pagina
  const checkinBtn = page.locator('button:has-text("Novo Check-in")');
  if (await checkinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("Botao Novo Check-in visivel!");
    await checkinBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "test-results/e2e/controle-patio/checkin-modal.png" });
  } else {
    console.log("Botao Novo Check-in NAO visivel");
  }

  // Clica na aba Docas
  const docasBtn = page.locator('button:has-text("Docas")');
  if (await docasBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("Aba Docas visivel!");
    await docasBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/e2e/controle-patio/docas-tab.png" });
  } else {
    console.log("Aba Docas NAO visivel");
  }

  await browser.close();
})();
