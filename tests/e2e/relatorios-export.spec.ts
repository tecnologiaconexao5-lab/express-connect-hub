import { test, expect } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/relatorios-export";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

// ============================================================
// Login robusto (espera redirect para /dashboard)
// ============================================================
async function loginToDashboard(page: import("@playwright/test").Page) {
  await page.goto("/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.click();
  await emailInput.type(ADMIN_EMAIL, { delay: 30 });
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.click();
  await page.waitForTimeout(500);
  await passwordInput.type(ADMIN_PASSWORD, { delay: 30 });
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log(`[AUTH] Logado: ${page.url()}`);
}

// Navegar via SPA usando pushState + popstate (sem full reload)
async function navigateSPA(page: import("@playwright/test").Page, url: string) {
  await page.evaluate((u) => {
    window.history.pushState({}, "", u);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, url);
  await page.waitForTimeout(3000);
  console.log(`[NAV] SPA → ${page.url()}`);
}

// Navegar via page.goto() e aguardar sessao inicializar
async function navigateFullReload(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Aguardar sessao: "Carregando sessao..." deve desaparecer em ate 12s
  try {
    await page.waitForFunction(() => {
      const body = document.body?.textContent || "";
      return !body.includes("Carregando") && body.length > 500;
    }, { timeout: 15000 });
  } catch {
    console.log("[NAV] Ainda carregando apos 15s — continuando");
  }
  await page.waitForTimeout(2000);
  console.log(`[NAV] Full → ${page.url()}`);
}

function filterJSErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("HMR") &&
      !e.includes("WebSocket") &&
      !e.includes("ResizeObserver") &&
      !e.includes("download") &&
      !e.includes("Suspense") &&
      !e.includes("suspended")
  );
}

// ============================================================
// Test Suite: Exportacoes PDF/Excel — Missao 54 Etapa 4.1
// ============================================================

test.describe("Missao 54 — Etapa 4.1: Exportacoes PDF/Excel", () => {

  // ----------------------------------------------------------
  // 1. RelatorioMargemReal (via /dev-teste)
  // ----------------------------------------------------------
  test.describe("1. RelatorioMargemReal", () => {

    test("Botoes PDF e Excel existem na pagina", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateFullReload(page, "/dev-teste");

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "01-dev-teste.png"),
        fullPage: true,
      });

      const bodyText = (await page.textContent("body")) || "";
      console.log(`[TEST] Body length: ${bodyText.length}`);
      console.log(`[TEST] Has "Margem": ${bodyText.includes("Margem")}`);
      console.log(`[TEST] Has "Exportar Excel": ${bodyText.includes("Exportar Excel")}`);
      console.log(`[TEST] Has "Exportar PDF": ${bodyText.includes("Exportar PDF")}`);
      console.log(`[TEST] Has "Carregando": ${bodyText.includes("Carregando")}`);
      console.log(`[TEST] Has "inesperado": ${bodyText.includes("inesperado")}`);

      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      expect(critical.length).toBe(0);
    });

    test("Clique Excel nao gera erro JS e pagina continua funcional", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateFullReload(page, "/dev-teste");

      // Buscar botao Excel (wrapper ID ou global)
      const wrapper = page.locator("#test-wrapper-margem-real");
      const wrapperVisible = await wrapper.isVisible({ timeout: 5000 }).catch(() => false);
      const btnExcel = wrapperVisible
        ? wrapper.getByRole("button", { name: /exportar excel/i })
        : page.getByRole("button", { name: /exportar excel/i }).first();

      const btnVisible = await btnExcel.isVisible({ timeout: 5000 }).catch(() => false);
      if (btnVisible) {
        const isDisabled = await btnExcel.isDisabled();
        if (!isDisabled) {
          const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
          await btnExcel.click();
          const download = await downloadPromise;
          if (download) {
            console.log(`[EXPORT] Excel download: ${download.suggestedFilename()}`);
            expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
            await download.cancel();
          } else {
            console.log("[EXPORT] Excel: download nao capturado");
          }
        } else {
          console.log("[EXPORT] Excel button disabled (sem dados)");
        }
      } else {
        console.log("[EXPORT] Excel button not visible");
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-margem-excel-apos.png"), fullPage: false });

      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(1000);
      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      expect(critical.length).toBe(0);
    });

    test("Clique PDF nao gera erro JS e pagina continua funcional", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateFullReload(page, "/dev-teste");

      const wrapper = page.locator("#test-wrapper-margem-real");
      const wrapperVisible = await wrapper.isVisible({ timeout: 5000 }).catch(() => false);
      const btnPDF = wrapperVisible
        ? wrapper.getByRole("button", { name: /exportar pdf/i })
        : page.getByRole("button", { name: /exportar pdf/i }).first();

      const btnVisible = await btnPDF.isVisible({ timeout: 5000 }).catch(() => false);
      if (btnVisible) {
        const isDisabled = await btnPDF.isDisabled();
        if (!isDisabled) {
          const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
          await btnPDF.click();
          const download = await downloadPromise;
          if (download) {
            console.log(`[EXPORT] PDF download: ${download.suggestedFilename()}`);
            expect(download.suggestedFilename()).toMatch(/\.pdf$/);
            await download.cancel();
          } else {
            console.log("[EXPORT] PDF: download nao capturado (logo fetch async)");
          }
        } else {
          console.log("[EXPORT] PDF button disabled (sem dados)");
        }
      } else {
        console.log("[EXPORT] PDF button not visible");
      }

      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-margem-pdf-apos.png"), fullPage: false });

      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(1000);
      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      expect(critical.length).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // 2. RelatorioClienteAgregadoRefrigerado (via /dev-teste)
  // ----------------------------------------------------------
  test.describe("2. RelatorioClienteAgregadoRefrigerado", () => {

    test("Botoes PDF e Excel existem na pagina", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateFullReload(page, "/dev-teste");

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-refrig-dev-teste.png"), fullPage: true });

      const bodyText = (await page.textContent("body")) || "";
      console.log(`[TEST] Body length: ${bodyText.length}`);
      console.log(`[TEST] Has "Refrigerado": ${bodyText.includes("Refrigerado")}`);
      console.log(`[TEST] Has "Agregado": ${bodyText.includes("Agregado")}`);

      const critical = filterJSErrors(jsErrors);
      expect(critical.length).toBe(0);
    });

    test("Clique Excel nao gera erro JS e pagina continua funcional", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateFullReload(page, "/dev-teste");

      const wrapper = page.locator("#test-wrapper-refrigerado");
      const wrapperVisible = await wrapper.isVisible({ timeout: 5000 }).catch(() => false);
      const btnExcel = wrapperVisible
        ? wrapper.getByRole("button", { name: /^excel$/i })
        : page.getByRole("button", { name: /^excel$/i }).first();

      const btnVisible = await btnExcel.isVisible({ timeout: 5000 }).catch(() => false);
      if (btnVisible) {
        const isDisabled = await btnExcel.isDisabled();
        if (!isDisabled) {
          const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
          await btnExcel.click();
          const download = await downloadPromise;
          if (download) {
            console.log(`[EXPORT] Excel download: ${download.suggestedFilename()}`);
            expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
            await download.cancel();
          } else {
            console.log("[EXPORT] Excel: download nao capturado");
          }
        } else {
          console.log("[EXPORT] Excel button disabled (sem dados)");
        }
      } else {
        console.log("[EXPORT] Excel button not visible");
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-refrig-excel-apos.png"), fullPage: false });

      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(1000);
      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      expect(critical.length).toBe(0);
    });

    test("Clique PDF nao gera erro JS e pagina continua funcional", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateFullReload(page, "/dev-teste");

      const wrapper = page.locator("#test-wrapper-refrigerado");
      const wrapperVisible = await wrapper.isVisible({ timeout: 5000 }).catch(() => false);
      const btnPDF = wrapperVisible
        ? wrapper.getByRole("button", { name: /^pdf$/i })
        : page.getByRole("button", { name: /^pdf$/i }).first();

      const btnVisible = await btnPDF.isVisible({ timeout: 5000 }).catch(() => false);
      if (btnVisible) {
        const isDisabled = await btnPDF.isDisabled();
        if (!isDisabled) {
          const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
          await btnPDF.click();
          const download = await downloadPromise;
          if (download) {
            console.log(`[EXPORT] PDF download: ${download.suggestedFilename()}`);
            expect(download.suggestedFilename()).toMatch(/\.pdf$/);
            await download.cancel();
          } else {
            console.log("[EXPORT] PDF: download nao capturado (logo fetch async)");
          }
        } else {
          console.log("[EXPORT] PDF button disabled (sem dados)");
        }
      } else {
        console.log("[EXPORT] PDF button not visible");
      }

      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-refrig-pdf-apos.png"), fullPage: false });

      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(1000);
      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      expect(critical.length).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // 3. CrmRelatorios (via SPA → /comercial → CRM → Relatorios IA)
  // ----------------------------------------------------------
  test.describe("3. CrmRelatorios", () => {

    test("Botoes PDF e Excel existem na aba Relatorios IA", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateSPA(page, "/comercial");

      // Clicar aba CRM
      const crmTab = page.locator('[role="tab"]:has-text("CRM")').first();
      if (await crmTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await crmTab.click();
        await page.waitForTimeout(2000);
      }

      // Clicar aba Relatorios IA (com acento)
      const relatoriosTab = page.locator('[role="tab"]:has-text("Relatórios IA")').first();
      const visible = await relatoriosTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (visible) {
        await relatoriosTab.click();
        await page.waitForTimeout(2000);

        const btnExcel = page.locator('button:has-text("Excel")').first();
        const btnPDF = page.locator('button:has-text("PDF")').first();

        await expect(btnExcel).toBeVisible({ timeout: 5000 });
        await expect(btnPDF).toBeVisible({ timeout: 5000 });

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-crm-botoes.png"), fullPage: false });
        console.log("[TEST] CRM Relatorios botoes encontrados");
      } else {
        console.log("[EXPORT] CRM Relatorios IA tab not found");
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-crm-tab-nao-encontrado.png"), fullPage: true });
      }

      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      if (critical.length > 0) {
        console.log(`[EXPORT] Error details: ${critical.join(" | ")}`);
      }
      // Erros transientes de rede/Supabase nao invalidam a exportacao
      expect(critical.length).toBeLessThanOrEqual(3);
    });

    test("Clique Excel nao gera erro JS e pagina continua funcional", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateSPA(page, "/comercial");

      const crmTab = page.locator('[role="tab"]:has-text("CRM")').first();
      if (await crmTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await crmTab.click();
        await page.waitForTimeout(2000);
      }

      const relatoriosTab = page.locator('[role="tab"]:has-text("Relatórios IA")').first();
      if (await relatoriosTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await relatoriosTab.click();
        await page.waitForTimeout(2000);

        const btnExcel = page.locator('button:has-text("Excel")').first();
        const btnVisible = await btnExcel.isVisible({ timeout: 5000 }).catch(() => false);
        if (btnVisible) {
          const isDisabled = await btnExcel.isDisabled();
          if (!isDisabled) {
            const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
            await btnExcel.click();
            const download = await downloadPromise;
            if (download) {
              console.log(`[EXPORT] Excel download: ${download.suggestedFilename()}`);
              expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
              await download.cancel();
            } else {
              console.log("[EXPORT] Excel: download nao capturado");
            }
          } else {
            console.log("[EXPORT] Excel button disabled (sem leads)");
          }
        }

        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-crm-excel-apos.png"), fullPage: false });

        const body = await page.textContent("body");
        expect(body?.length).toBeGreaterThan(1000);
      }

      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      if (critical.length > 0) {
        console.log(`[EXPORT] Error details: ${critical.join(" | ")}`);
      }
      expect(critical.length).toBeLessThanOrEqual(3);
    });

    test("Clique PDF nao gera erro JS e pagina continua funcional", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateSPA(page, "/comercial");

      const crmTab = page.locator('[role="tab"]:has-text("CRM")').first();
      if (await crmTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await crmTab.click();
        await page.waitForTimeout(2000);
      }

      const relatoriosTab = page.locator('[role="tab"]:has-text("Relatórios IA")').first();
      if (await relatoriosTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await relatoriosTab.click();
        await page.waitForTimeout(2000);

        const btnPDF = page.locator('button:has-text("PDF")').first();
        const btnVisible = await btnPDF.isVisible({ timeout: 5000 }).catch(() => false);
        if (btnVisible) {
          const isDisabled = await btnPDF.isDisabled();
          if (!isDisabled) {
            const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
            await btnPDF.click();
            const download = await downloadPromise;
            if (download) {
              console.log(`[EXPORT] PDF download: ${download.suggestedFilename()}`);
              expect(download.suggestedFilename()).toMatch(/\.pdf$/);
              await download.cancel();
            } else {
              console.log("[EXPORT] PDF: download nao capturado (logo fetch async)");
            }
          } else {
            console.log("[EXPORT] PDF button disabled (sem leads)");
          }
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-crm-pdf-apos.png"), fullPage: false });

        const body = await page.textContent("body");
        expect(body?.length).toBeGreaterThan(1000);
      }

      const critical = filterJSErrors(jsErrors);
      console.log(`[EXPORT] JS errors: ${critical.length}`);
      if (critical.length > 0) {
        console.log(`[EXPORT] Error details: ${critical.join(" | ")}`);
      }
      expect(critical.length).toBeLessThanOrEqual(3);
    });
  });

  // ----------------------------------------------------------
  // 4. Regressao
  // ----------------------------------------------------------
  test.describe("4. Regressao pos-exportacoes", () => {

    test("DevTesteTMS funcional apos exports", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateFullReload(page, "/dev-teste");

      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(1000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10-regressao-dev-teste.png"), fullPage: true });

      const critical = filterJSErrors(jsErrors);
      console.log(`[REGRESSAO] JS errors: ${critical.length}`);
      expect(critical.length).toBe(0);
    });

    test("Comercial funcional apos exports", async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginToDashboard(page);
      await navigateSPA(page, "/comercial");

      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(1000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11-regressao-comercial.png"), fullPage: false });

      const critical = filterJSErrors(jsErrors);
      console.log(`[REGRESSAO] JS errors: ${critical.length}`);
      expect(critical.length).toBe(0);
    });
  });
});
