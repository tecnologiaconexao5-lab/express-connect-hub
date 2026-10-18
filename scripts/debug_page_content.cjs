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
  await page.waitForTimeout(3000);

  console.log("URL apos login:", page.url());

  // Navegar para controle-patio
  try {
    await page.goto("http://localhost:8800/controle-patio", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log("Timeout ou erro na navegação:", e.message.substring(0, 200));
  }

  console.log("URL2:", page.url());
  const title = await page.title();
  console.log("TITLE:", title);
  const body = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log("BODY:", body);

  const h1 = await page.evaluate(() => {
    const el = document.querySelector("h1");
    return el ? el.innerText : "NO H1 FOUND";
  });
  console.log("H1:", h1);

  // Check for any error
  const errors = await page.evaluate(() => {
    const errEls = document.querySelectorAll('[class*="error"], [class*="Error"]');
    return Array.from(errEls).map((e) => e.textContent).join(" | ");
  });
  console.log("ERRORS:", errors);

  await page.screenshot({ path: "test-results/e2e/controle-patio/debug-page.png" });
  console.log("Screenshot saved");
  await browser.close();
})();
