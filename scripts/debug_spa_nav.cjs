const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "tamiris.castilho@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');

  // Espera o login (pode levar ate 15s)
  try {
    await page.waitForURL("**/dashboard", { timeout: 15000 });
  } catch {
    console.log("Timeout esperando dashboard, URL atual:", page.url());
  }
  await page.waitForTimeout(2000);
  console.log("URL apos login:", page.url());

  // Navegacao VIA React Router (nao page.goto)
  // Expande sidebar
  const sidebarEl = page.locator("aside").first();
  await sidebarEl.hover({ force: true });
  await page.waitForTimeout(1000);

  // Clica no Apoio Operacional
  try {
    await page.locator('button:has-text("Apoio Operacional")').click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (e) {
    console.log("Erro ao clicar Apoio Operacional:", e.message.substring(0, 200));
  }

  // Clica em Controle de Patio
  try {
    await page.locator('button:has-text("Controle de Patio")').click({ timeout: 5000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log("Erro ao clicar Controle de Patio:", e.message.substring(0, 200));
  }

  console.log("URL apos navegar pelo menu:", page.url());
  const body = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log("Conteudo:", body);

  // Tenta navegar via React Router usando History API
  await page.evaluate(() => {
    window.history.pushState({}, "", "/controle-patio");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(3000);

  console.log("URL apos history.pushState:", page.url());
  const body2 = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log("Conteudo:", body2);

  await page.screenshot({ path: "test-results/e2e/controle-patio/debug-spa-nav.png" });

  await browser.close();
})();
