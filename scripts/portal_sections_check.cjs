const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "contato@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Scroll to bottom of content area
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(1500);

  const text = await page.evaluate(() => document.body.innerText);
  const checkTerms = ["Grafico", "Evolucao", "Analise", "Insight", "Movimentacoes", "SLA", "Performance", "Timeline", "Seus Pedidos"];
  console.log("=== Section Check (scrolled) ===");
  checkTerms.forEach(t => console.log(`  ${t}: ${text.includes(t) ? "YES" : "NO"}`));

  if (errors.length > 0) {
    console.log("\n=== Page Errors ===");
    errors.forEach(e => console.log("  ", e));
  }

  await page.screenshot({ path: "test-results/e2e/controle-patio/portal-full.png", fullPage: true });
  console.log("\nScreenshot: portal-full.png");
  
  await browser.close();
})();
