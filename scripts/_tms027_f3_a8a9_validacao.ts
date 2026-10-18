import { chromium } from "@playwright/test";

const BASE = "http://localhost:8800";
const EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const SENHA = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";
const OUT = "test-results/e2e/tms027-f3";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const httpErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`);
  });

  const fs = await import("fs");
  fs.mkdirSync(OUT, { recursive: true });

  // ---- A8: Login admin ----
  console.log("[A8] Abrindo login...");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 20000 });
  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
  await page.waitForTimeout(5000);

  const url = page.url();
  console.log(`[A8] URL pos-login: ${url}`);
  await page.screenshot({ path: `${OUT}/a8-pos-login.png`, fullPage: false });

  const logado = !url.includes("/login");
  console.log(`[A8] Login admin: ${logado ? "OK" : "FALHOU"}`);

  // ---- A9: Torre de Controle ----
  if (logado) {
    console.log("[A9] Navegando para /torre-controle...");
    await page.goto(`${BASE}/torre-controle`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${OUT}/a9-torre.png`, fullPage: false });

    const body = await page.locator("body").innerText().catch(() => "");
    const temLoading = /carregando|loading/i.test(body.slice(0, 4000));
    const semErroVazio = !body.includes("Erro ao carregar");
    console.log(`[A9] body length: ${body.length}`);
    console.log(`[A9] contém 'carregando' no topo: ${temLoading}`);
    console.log(`[A9] sem 'Erro ao carregar': ${semErroVazio}`);

    // tenta abrir filtros e contar cards/indicadores
    const btnFiltros = page.locator('button:has-text("Filtros")').first();
    const temFiltros = await btnFiltros.isVisible({ timeout: 4000 }).catch(() => false);
    console.log(`[A9] botão Filtros visível: ${temFiltros}`);
    if (temFiltros) {
      await btnFiltros.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/a9-torre-filtros.png`, fullPage: false });
      await btnFiltros.click().catch(() => {});
    }
  }

  fs.writeFileSync(
    `${OUT}/resultado.json`,
    JSON.stringify(
      {
        base: BASE,
        loginOk: logado,
        urlPosLogin: url,
        pageErrors,
        consoleErrors: consoleErrors.slice(0, 30),
        httpErrors: httpErrors.slice(0, 30),
        torreBodyLength: logado ? undefined : undefined,
      },
      null,
      2
    )
  );

  console.log("===============================================");
  console.log(`Login: ${logado ? "OK" : "FALHOU"}`);
  console.log(`Page errors: ${pageErrors.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log(`HTTP >=400: ${httpErrors.length}`);
  if (pageErrors.length) console.log(pageErrors.slice(0, 10).join("\n"));
  if (httpErrors.length) console.log(httpErrors.slice(0, 15).join("\n"));

  await browser.close();
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
