// AUTH-TEST-02: Validate login only — NEVER reveal password
import { chromium } from "playwright";

const EMAIL = "financeiro@conexaoexpress.com.br";
const PASSWORD = process.env.PLAYWRIGHT_FINANCEIRO_PASSWORD;

if (!PASSWORD) {
  console.log(JSON.stringify({ login: "FALHOU", motivo: "PLAYWRIGHT_FINANCEIRO_PASSWORD não definida" }));
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const result = {};

  try {
    // 1. Navigate to login
    await page.goto("http://localhost:8800/login", { waitUntil: "networkidle", timeout: 15000 });

    // 2. Fill credentials (never log PASSWORD)
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);

    // 3. Submit
    await page.click('button[type="submit"]');

    // 4. Wait for navigation away from /login (timeout 15s)
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

    const finalUrl = page.url();
    result.login = "OK";
    result.email = EMAIL;
    result.sessao_autenticada = !finalUrl.includes("/login");
    result.url_pos_login = finalUrl;

    // 5. Check if can access financeiro
    await page.goto("http://localhost:8800/financeiro", { waitUntil: "networkidle", timeout: 15000 });
    const financeiroUrl = page.url();
    result.acesso_tms = !financeiroUrl.includes("/login");
    result.acesso_financeiro = !financeiroUrl.includes("/login") && financeiroUrl.includes("/financeiro");

    // 6. Check console for auth errors
    const errors = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.waitForTimeout(2000);
    result.console_errors = errors.filter(e => e.includes("auth") || e.includes("401") || e.includes("403")).length;

  } catch (e) {
    result.login = "FALHOU";
    result.motivo = e.message.split("\n")[0]; // sanitized, no credentials
  } finally {
    // NEVER include password in output
    delete result.password;
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
  }
})();
