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

  // Navega via SPA para /controle-patio
  await page.evaluate(() => {
    window.history.pushState({}, "", "/controle-patio");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForTimeout(3000);

  // Extrai TODO o body text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("===== TODO O CONTEUDO DA PAGINA =====");
  console.log(bodyText);

  // Verifica elementos especificos
  const keys = [
    "Controle de Pátio", "Kanban", "Docas", "Regras", "Alertas",
    "Vagas", "Fila", "Check-in", "Patio", "em espera", "checkin"
  ];
  console.log("\n===== VERIFICACAO DE CONTEUDO =====");
  for (const key of keys) {
    const found = bodyText.toLowerCase().includes(key.toLowerCase());
    console.log(`  "${key}": ${found ? "✅" : "❌"}`);
  }

  await page.screenshot({ path: "test-results/e2e/controle-patio/full-page-verify.png", fullPage: true });
  console.log("\nScreenshot: test-results/e2e/controle-patio/full-page-verify.png");

  await browser.close();
})();
