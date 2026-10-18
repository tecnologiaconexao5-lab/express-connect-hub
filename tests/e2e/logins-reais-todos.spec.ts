import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = "test-results/screenshots/logins-reais-todos";

// Garante que o diretório existe
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Todos os usuários reais do domínio @conexaoexpress.com.br
const USUARIOS = [
  {
    email: "financeiro@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_FINANCEIRO_PASSWORD || "Conexao@2026",
    papel: "financeiro",
    redirectContains: "/financeiro",
    screenshotName: "01-financeiro.png",
  },
  {
    email: "comercial@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_COMERCIAL_PASSWORD || "Conexao@2026",
    papel: "comercial",
    redirectContains: "/comercial",
    screenshotName: "02-comercial.png",
  },
  {
    email: "operacional@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_OPERACIONAL_PASSWORD || "Conexao@2026",
    papel: "operacional",
    redirectContains: "/operacao",
    screenshotName: "03-operacional.png",
  },
  {
    email: "contato@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_ATENDIMENTO_PASSWORD || "Conexao@2026",
    papel: "atendimento",
    redirectContains: "/dashboard",
    screenshotName: "04-contato-atendimento.png",
  },
  {
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026",
    papel: "super_admin",
    redirectContains: "/dashboard",
    screenshotName: "05-tamiris-admin.png",
  },
  {
    email: "cliente.teste@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_CLIENTE_PASSWORD || "Teste@2026",
    papel: "cliente",
    redirectContains: "/portal-cliente",
    screenshotName: "06-cliente-teste.png",
  },
];

for (const u of USUARIOS) {
  test(`Login real: ${u.email} [${u.papel}]`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log(`\n[TEST] ── ${u.email} ──`);
    console.log(`[TEST] Esperado redirecionar para: ${u.redirectContains}`);

    await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);

    await page.locator('input[type="email"]').fill(u.email);
    await page.locator('input[type="password"]').fill(u.password);

    await page.locator('button[type="submit"]').click();

    // Aguardar redirecionamento (até 30s)
    try {
      await page.waitForURL(
        (url) => url.href.includes(u.redirectContains),
        { timeout: 30000 }
      );
    } catch {
      // Não falha imediatamente — registra URL e body para diagnóstico
    }

    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    const bodyText = await page.locator("body").textContent() || "";

    console.log(`[TEST] URL final: ${currentUrl}`);
    console.log(`[TEST] Tem erro na tela: ${bodyText.includes("Invalid") || bodyText.includes("inválid") || bodyText.includes("Credencial")}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, u.screenshotName),
      fullPage: true,
    });

    // Deve ter saído da página de login
    expect(currentUrl).not.toContain("/login");
    // Deve ter redirecionado corretamente
    expect(currentUrl).toContain(u.redirectContains);
  });
}

test("Credencial inválida permanece no login", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').fill("financeiro@conexaoexpress.com.br");
  await page.locator('input[type="password"]').fill("senha_errada_12345");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  const bodyText = await page.locator("body").textContent() || "";
  console.log(`[TEST] URL após erro: ${currentUrl}`);
  console.log(`[TEST] Mensagem de erro presente: ${bodyText.includes("Invalid") || bodyText.includes("inválid") || bodyText.includes("Credenciais")}`);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "07-credencial-invalida.png"),
    fullPage: false,
  });

  expect(currentUrl).toContain("/login");
});
