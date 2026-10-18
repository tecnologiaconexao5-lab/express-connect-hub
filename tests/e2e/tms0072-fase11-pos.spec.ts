import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import * as path from "path";

const BASE = "test-results/e2e/fase11-pos";
if (!existsSync(BASE)) mkdirSync(BASE, { recursive: true });

test.use({ storageState: "tests/e2e/.auth/storageState.json" });

test.describe("TMS-007.2 FASE 11.4-11.5 — Pós-cancelamento", () => {
  test("Verificar financeiro pós-cancelamento + console/network", async ({ page }) => {
    test.setTimeout(120000);

    const errs: { type: string; msg: string; url?: string }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") errs.push({ type: "console.error", msg: msg.text() });
    });
    page.on("pageerror", (err) => errs.push({ type: "pageerror", msg: err.message }));
    page.on("response", (resp) => {
      if (resp.status() >= 400) errs.push({ type: `HTTP ${resp.status()}`, msg: `${resp.url()}`, url: resp.url() });
    });

    // 1. Navigate to /financeiro
    await page.goto("/financeiro", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${BASE}/01-financeiro.png`, fullPage: true });

    // 2. Check tabs load
    const tabs = page.locator('button[role="tab"]');
    const tabCount = await tabs.count();
    console.log(`[FASE11.4] Tabs in Financeiro: ${tabCount}`);

    // 3. Check body loaded (not "Carregando sessão")
    const bodyText = await page.locator("body").textContent().catch(() => "");
    expect(bodyText?.includes("Carregando sessão")).toBeFalsy();
    expect(bodyText?.length).toBeGreaterThan(100);

    // 4. Try navigating to Contas a Receber tab
    const crTab = page.locator('button[role="tab"]:has-text("Receber")').first();
    if (await crTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await crTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${BASE}/02-receber.png`, fullPage: true });
    }

    // 5. Summary
    const httpErrors = errs.filter(e => e.type.startsWith("HTTP"));
    const jsErrors = errs.filter(e => e.type === "console.error" || e.type === "pageerror");
    console.log(`[FASE11.5] HTTP errors: ${httpErrors.length} | JS errors: ${jsErrors.length}`);

    // Log all errors
    if (errs.length > 0) {
      writeFileSync(path.join(BASE, "errors.json"), JSON.stringify(errs, null, 2));
    }

    // No JS errors (HTTP 304/404 from Supabase may be acceptable)
    expect(jsErrors.length).toBe(0);
  });
});
