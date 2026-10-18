import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = "test-results/e2e/missao02";
const NETWORK_LOG: { url: string; status: number; method: string; timestamp: string }[] = [];
const CONSOLE_LOG: { type: string; text: string; timestamp: string }[] = [];
const SUPABASE_QUERIES: { url: string; status: number; method: string; table?: string; timestamp: string }[] = [];

function ensureDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function setupCapture(page: Page) {
  page.on("console", (msg) => {
    const entry = { type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() };
    CONSOLE_LOG.push(entry);
    if (msg.type() === "error") console.log(`[CONSOLE ERROR] ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    CONSOLE_LOG.push({ type: "pageerror", text: err.message, timestamp: new Date().toISOString() });
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  page.on("requestfailed", (req) => {
    CONSOLE_LOG.push({ type: "requestfailed", text: `${req.url()} - ${req.failure()?.errorText || "unknown"}`, timestamp: new Date().toISOString() });
    console.log(`[REQUEST FAILED] ${req.url()}`);
  });

  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    const method = res.request().method();
    NETWORK_LOG.push({ url, status, method, timestamp: new Date().toISOString() });

    if (url.includes("supabase") || url.includes("rest/v1")) {
      let table = "unknown";
      const match = url.match(/rest\/v1\/([^?]+)/);
      if (match) table = match[1];
      SUPABASE_QUERIES.push({ url, status, method, table, timestamp: new Date().toISOString() });

      if (status >= 400) {
        console.log(`[SUPABASE ERROR] ${method} ${url} -> ${status}`);
      }
    }

    if (status >= 400) {
      console.log(`[HTTP ${status}] ${method} ${url}`);
    }
  });
}

async function login(page: Page) {
  const email = "tamiris.castilho@conexaoexpress.com.br";
  const password = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.fill(password);

  await page.locator('button[type="submit"], button:has-text("Entrar")').click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-login-pos.png"), fullPage: false });
}

async function sidebarClick(page: Page, label: string) {
  console.log(`[NAV] Sidebar click: "${label}"...`);
  const btn = page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
}

async function captureNetworkLogs() {
  ensureDir();
  const networkPath = path.join(SCREENSHOT_DIR, "network-log.json");
  fs.writeFileSync(networkPath, JSON.stringify(NETWORK_LOG, null, 2), "utf-8");

  const supabasePath = path.join(SCREENSHOT_DIR, "supabase-queries.json");
  fs.writeFileSync(supabasePath, JSON.stringify(SUPABASE_QUERIES, null, 2), "utf-8");

  const consolePath = path.join(SCREENSHOT_DIR, "console-log.json");
  fs.writeFileSync(consolePath, JSON.stringify(CONSOLE_LOG, null, 2), "utf-8");
}

test.describe("MISSÃO 02 — FASE 2: Navegação Segura Operaçao/OS/Escala", () => {
  test("01 - Login e tela principal de Operação", async ({ page }) => {
    await setupCapture(page);
    await login(page);

    const body = page.locator("body");
    const text = await body.textContent() || "";
    expect(text).not.toContain("Login");
    expect(text.length).toBeGreaterThan(100);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01a-dashboard-pos-login.png"), fullPage: true });
  });

  test("02 - Sidebar → Apoio Operacional → Operação (SPA)", async ({ page }) => {
    await setupCapture(page);
    await login(page);
    await sidebarClick(page, "Apoio Operacional");

    const body = page.locator("body");
    const text = await body.textContent() || "";
    expect(text).toContain("Operação");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-operacao-principal.png"), fullPage: true });
  });

  test("03 - Aba Ordens de Serviço via tab", async ({ page }) => {
    await setupCapture(page);
    await login(page);
    await sidebarClick(page, "Apoio Operacional");

    const osTab = page.locator('button[role="tab"]:has-text("Ordens de Serviço")').first();
    await osTab.waitFor({ state: "visible", timeout: 8000 });
    await osTab.click();
    await page.waitForTimeout(3000);

    const body = page.locator("body");
    const text = await body.textContent() || "";
    expect(text).toContain("Ordens");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-ordens-servico.png"), fullPage: true });
  });

  test("04 - Aba Escala Operacional via tab", async ({ page }) => {
    await setupCapture(page);
    await login(page);
    await sidebarClick(page, "Apoio Operacional");

    const escalaTab = page.locator('button[role="tab"]:has-text("Escala Operacional")').first();
    await escalaTab.waitFor({ state: "visible", timeout: 8000 });
    await escalaTab.click();
    await page.waitForTimeout(3000);

    const body = page.locator("body");
    const text = await body.textContent() || "";
    expect(text).toContain("Escala");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-escala-operacional.png"), fullPage: true });
  });

  test("05 - Aba Ocorrências Rastreio via tab", async ({ page }) => {
    await setupCapture(page);
    await login(page);
    await sidebarClick(page, "Apoio Operacional");

    const ocTab = page.locator('button[role="tab"]:has-text("Ocorrências Rastreio")').first();
    await ocTab.waitFor({ state: "visible", timeout: 8000 });
    await ocTab.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-ocorrencias.png"), fullPage: true });
  });

  test("06 - Aba Baixas e Evidências (POD) via tab", async ({ page }) => {
    await setupCapture(page);
    await login(page);
    await sidebarClick(page, "Apoio Operacional");

    const podTab = page.locator('button[role="tab"]:has-text("Baixas e Evidências")').first();
    await podTab.waitFor({ state: "visible", timeout: 8000 });
    await podTab.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-pod-evidencias.png"), fullPage: true });
  });

  test("07 - Detalhes de OS (primeira OS da lista)", async ({ page }) => {
    await setupCapture(page);
    await login(page);
    await sidebarClick(page, "Apoio Operacional");

    const osTab = page.locator('button[role="tab"]:has-text("Ordens de Serviço")').first();
    await osTab.waitFor({ state: "visible", timeout: 8000 });
    await osTab.click();
    await page.waitForTimeout(5000);

    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-os-detalhe-primeira.png"), fullPage: true });
    } else {
      console.log("[WARN] Nenhuma OS encontrada na lista");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-os-lista-vazia.png"), fullPage: true });
    }
  });

  test("08 - Aba Roteirizador Web via tab", async ({ page }) => {
    await setupCapture(page);
    await login(page);
    await sidebarClick(page, "Apoio Operacional");

    const rotTab = page.locator('button[role="tab"]:has-text("Roteirizador Web")').first();
    await rotTab.waitFor({ state: "visible", timeout: 8000 });
    await rotTab.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-roteirizador-web.png"), fullPage: true });
  });

  test("09 - Captura final de logs (console + network + supabase)", async () => {
    await captureNetworkLogs();

    const pageErrors = CONSOLE_LOG.filter(l => l.type === "pageerror");
    const requestFailed = CONSOLE_LOG.filter(l => l.type === "requestfailed");
    const httpErrors = NETWORK_LOG.filter(l => l.status >= 400);
    const supabaseErrors = SUPABASE_QUERIES.filter(l => l.status >= 400);

    console.log(`=== RESUMO FINAL ===`);
    console.log(`Total console entries: ${CONSOLE_LOG.length}`);
    console.log(`Total network entries: ${NETWORK_LOG.length}`);
    console.log(`Total Supabase queries: ${SUPABASE_QUERIES.length}`);
    console.log(`Page errors: ${pageErrors.length}`);
    console.log(`Request failed: ${requestFailed.length}`);
    console.log(`HTTP errors (4xx/5xx): ${httpErrors.length}`);
    console.log(`Supabase errors: ${supabaseErrors.length}`);

    if (pageErrors.length > 0) {
      console.log(`\n=== PAGE ERRORS ===`);
      pageErrors.forEach(e => console.log(`  [${e.type}] ${e.text}`));
    }
    if (requestFailed.length > 0) {
      console.log(`\n=== REQUEST FAILED ===`);
      requestFailed.forEach(e => console.log(`  ${e.text}`));
    }
    if (httpErrors.length > 0) {
      console.log(`\n=== HTTP ERRORS (4xx/5xx) ===`);
      httpErrors.forEach(e => console.log(`  ${e.status} ${e.method} ${e.url.substring(0,100)}`));
    }
    if (supabaseErrors.length > 0) {
      console.log(`\n=== SUPABASE ERRORS ===`);
      supabaseErrors.forEach(e => console.log(`  ${e.status} ${e.method} ${e.table} ${e.url.substring(0,100)}`));
    }

    expect(pageErrors.length).toBe(0);
  });
});
