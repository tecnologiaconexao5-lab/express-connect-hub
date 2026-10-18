const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Vai para login
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Verifica localStorage antes do login
  let ls = await page.evaluate(() => JSON.stringify(localStorage));
  console.log("localStorage ANTES do login:", ls.substring(0, 300));

  // Preenche e submete login
  await page.fill('input[type="email"]', "tamiris.castilho@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log("URL apos login:", page.url());

  // Verifica localStorage DEPOIS do login
  ls = await page.evaluate(() => JSON.stringify(localStorage));
  console.log("localStorage DEPOIS do login (300 chars):", ls.substring(0, 300));
  console.log("localStorage contem sb-?", ls.includes("sb-"));

  // Tenta navegar usando window.location (CLIENT SIDE, nao page.goto)
  await page.evaluate(() => { window.location.href = "/controle-patio"; });
  await page.waitForTimeout(5000);

  console.log("URL apos nav client-side:", page.url());
  const body = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log("Conteudo:", body);

  // Tenta com page.goto (SERVER SIDE)
  await page.goto("http://localhost:8800/controle-patio", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  console.log("URL apos page.goto:", page.url());
  ls = await page.evaluate(() => JSON.stringify(localStorage));
  console.log("localStorage apos page.goto:", ls.substring(0, 300));
  console.log("localStorage contem sb-?", ls.includes("sb-"));
  const body2 = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log("Conteudo apos page.goto:", body2);

  await browser.close();
})();
