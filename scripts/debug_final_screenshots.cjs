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

  // Navigate to controle-patio
  await page.evaluate(() => {
    window.history.pushState({}, "", "/controle-patio");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(3000);

  // Expand sidebar via hover
  await page.locator("aside").first().hover({ force: true });
  await page.waitForTimeout(1500);

  // Ensure Apoio Operacional is expanded  
  const apoioBtn = page.locator("aside button:has-text('Apoio Operacional')");
  if (await apoioBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await apoioBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Screenshot 1: Full page with sidebar showing Controle de Patio in Apoio Operacional
  await page.screenshot({
    path: "test-results/e2e/controle-patio/final-sidebar-expanded.png",
    fullPage: false,
  });

  // Screenshot 2: Full page content (fullPage)
  await page.screenshot({
    path: "test-results/e2e/controle-patio/final-full-content.png",
    fullPage: true,
  });

  // Screenshot 3: Click on Docas tab
  const docasBtn = page.locator('button:has-text("Docas")');
  if (await docasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await docasBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: "test-results/e2e/controle-patio/final-docas-tab.png",
      fullPage: false,
    });
  }

  // Screenshot 4: Click on Regras tab  
  const regrasBtn = page.locator('button:has-text("Regras")');
  if (await regrasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await regrasBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: "test-results/e2e/controle-patio/final-regras-tab.png",
      fullPage: false,
    });
  }

  // Output file list
  const fs = require("fs");
  const files = fs.readdirSync("test-results/e2e/controle-patio");
  console.log("Screenshots capturados:");
  files.filter(f => f.startsWith("final-")).forEach(f => {
    const stat = fs.statSync(`test-results/e2e/controle-patio/${f}`);
    console.log(`  ${f} - ${(stat.size/1024).toFixed(1)} KB`);
  });

  await browser.close();
})();
