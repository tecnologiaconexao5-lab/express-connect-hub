const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Collect all console messages
  const consoleLogs = [];
  page.on("console", msg => {
    const text = msg.text();
    if (text.length > 200) consoleLogs.push(`[${msg.type()}] ${text.substring(0,200)}...`);
    else consoleLogs.push(`[${msg.type()}] ${text}`);
  });
  page.on("pageerror", err => consoleLogs.push("PAGE_ERROR: " + err.message));

  // Login as contato (should redirect to /portal-cliente since papel=cliente)
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "contato@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log("URL after login:", page.url());

  if (consoleLogs.length > 0) {
    console.log(`\n=== CONSOLE LOGS (${consoleLogs.length} total, showing first 30) ===`);
    consoleLogs.slice(0, 30).forEach(e => console.log("  ", e));
    if (consoleLogs.length > 30) console.log(`  ... and ${consoleLogs.length - 30} more`);
  }

  const bodyText = await page.evaluate(() => document.body.innerText);
  // Check for key sections
  const sections = ["Gráfico", "Análise", "Movimenta", "Agenda", "Controle de Pátio", "Insight", "Evolução"];
  console.log("\n=== SECTION CHECK ===");
  sections.forEach(s => console.log(`  ${s}: ${bodyText.includes(s) ? "✅" : "❌"}`));
  
  await page.screenshot({ path: "test-results/e2e/controle-patio/portal-login.png", fullPage: true });
  console.log("\nScreenshot saved: portal-login.png");
  
  await browser.close();
})();
