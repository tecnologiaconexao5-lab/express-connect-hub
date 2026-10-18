import { test, expect } from "@playwright/test";
import * as path from "path";
import { loginAdmin } from "./helpers/auth";

const SCREENSHOT_DIR = "test-results/e2e/m108a";

interface ConsoleError {
  text: string;
  type: string;
  url: string;
}

interface Network404 {
  url: string;
  status: number;
  method: string;
}

test.describe("M108-A — Estabilização do TMS (7 bugs corrigidos)", () => {
  let consoleErrors: ConsoleError[] = [];
  let network404s: Network404[] = [];
  let allConsoleEntries: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    network404s = [];
    allConsoleEntries = [];

    page.on("console", (msg) => {
      const text = msg.text();
      allConsoleEntries.push(`[${msg.type()}] ${text}`);

      if (msg.type() === "error" || msg.type() === "warning") {
        if (
          text.includes("Objects are not valid") ||
          text.includes("React child") ||
          text.includes("{value, label}") ||
          text.includes("404") ||
          text.includes("Failed to load resource") ||
          text.includes("TenantContext") ||
          text.includes("ErrorBoundary") ||
          text.includes("Minified React error")
        ) {
          consoleErrors.push({
            text,
            type: msg.type(),
            url: page.url(),
          });
        }
      }
    });

    page.on("response", (response) => {
      if (response.status() === 404) {
        network404s.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        });
      }
    });
  });

  test("01 - Login não deve ter erros de renderização", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.waitForTimeout(3000);

    const renderErrors = consoleErrors.filter(
      e => e.text.includes("Objects are not valid") || e.text.includes("React child") || e.text.includes("Minified React error")
    );
    expect(renderErrors.length).toBe(0);
  });

  test("02 - Operação não deve crashar", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.goto("/operacao", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-operacao.png"),
      fullPage: false,
    });

    const renderErrors = consoleErrors.filter(
      e => e.text.includes("Objects are not valid") || e.text.includes("React child") || e.text.includes("Minified React error")
    );
    expect(renderErrors.length).toBe(0);

    const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
    expect(hasErrorBoundary).toBe(false);
  });

  test("03 - Ordens de Serviço - abas carregam sem crash", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.goto("/operacao?tab=os", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-os.png"),
      fullPage: false,
    });

    const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
    expect(hasErrorBoundary).toBe(false);

    const renderErrors = consoleErrors.filter(
      e => e.text.includes("Objects are not valid") || e.text.includes("React child") || e.text.includes("Minified React error")
    );
    expect(renderErrors.length).toBe(0);
  });

  test("04 - Escala Operacional carrega sem erro", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.goto("/operacao?tab=escala", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-escala.png"),
      fullPage: false,
    });

    const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
    expect(hasErrorBoundary).toBe(false);

    const renderErrors = consoleErrors.filter(
      e => e.text.includes("Objects are not valid") || e.text.includes("React child") || e.text.includes("Minified React error")
    );
    expect(renderErrors.length).toBe(0);
  });

  test("05 - Comercial carrega sem erro", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.goto("/comercial", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(8000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-comercial.png"),
      fullPage: false,
    });

    const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
    expect(hasErrorBoundary).toBe(false);

    const renderErrors = consoleErrors.filter(
      e => e.text.includes("Objects are not valid") || e.text.includes("React child") || e.text.includes("Minified React error")
    );
    expect(renderErrors.length).toBe(0);
  });

  test("06 - Navegação ampla sem erros de renderização", async ({ page }) => {
    await loginAdmin(page, "m108a-01");

    const rotas = [
      "/dashboard",
      "/operacao",
      "/operacao?tab=os",
      "/operacao?tab=escala",
      "/operacao?tab=ocorrencias",
      "/operacao?tab=pod",
      "/comercial",
      "/cadastros",
      "/cadastros/clientes",
      "/cadastros/prestadores",
      "/cadastros/veiculos",
      "/financeiro",
      "/frota",
      "/relatorios",
      "/contratos",
    ];

    for (const rota of rotas) {
      console.log(`[TEST] Navegando para ${rota}`);
      await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
      if (hasErrorBoundary) {
        console.log(`[ERRO] ErrorBoundary ativado em ${rota}`);
        console.log(`Console errors até agora:`);
        consoleErrors.forEach(e => console.log(JSON.stringify(e)));
      }
      expect(hasErrorBoundary).toBe(false);
    }

    const renderErrors = consoleErrors.filter(
      e => e.text.includes("Objects are not valid") || e.text.includes("React child") || e.text.includes("Minified React error")
    );
    expect(renderErrors.length).toBe(0);
  });

  test("07 - Veículos - Detalhe carrega sem crash", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.goto("/cadastros/veiculos", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07-veiculos.png"),
      fullPage: false,
    });

    const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
    expect(hasErrorBoundary).toBe(false);
  });

  test("08 - Financeiro - MargemPorOS sem crash", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.goto("/financeiro", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "08-financeiro.png"),
      fullPage: false,
    });

    const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
    expect(hasErrorBoundary).toBe(false);
  });

  test("09 - Comercial - Tabela de Valores sem crash", async ({ page }) => {
    await loginAdmin(page, "m108a-01");
    await page.goto("/comercial", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    const tabelaBtn = page.locator('button:has-text("Tabela de Valores"), a:has-text("Tabela de")').first();
    if (await tabelaBtn.isVisible().catch(() => false)) {
      await tabelaBtn.click();
      await page.waitForTimeout(3000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "09-tabela-valores.png"),
      fullPage: false,
    });

    const hasErrorBoundary = await page.locator('text=Algo inesperado aconteceu').isVisible().catch(() => false);
    expect(hasErrorBoundary).toBe(false);
  });
});
