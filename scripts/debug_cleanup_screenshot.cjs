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
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Navega para controle-patio via SPA
  await page.evaluate(() => {
    window.history.pushState({}, "", "/controle-patio");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(3000);

  // Expande sidebar
  await page.locator("aside").first().hover({ force: true });
  await page.waitForTimeout(1500);

  // Expande Apoio Operacional
  const apoioBtn = page.locator("aside button:has-text('Apoio Operacional')");
  if (await apoioBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await apoioBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Screenshot: sidebar expanded with Controle de Patio visible
  await page.screenshot({
    path: "test-results/e2e/controle-patio/final-sidebar-completa.png",
    fullPage: false,
  });

  const fs = require("fs");
  const stat = fs.statSync("test-results/e2e/controle-patio/final-sidebar-completa.png");
  console.log(`final-sidebar-completa.png - ${(stat.size/1024).toFixed(1)} KB`);
  console.log("URL:", page.url());

  await browser.close();
})();
