import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("TMS-006.3 V", () => {
  test("HML001 visivel na interface", async ({ page }) => {
    await loginAdmin(page, "tms0063-v2");
    await page.goto("http://localhost:8800/cadastros/veiculos", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const body = await page.locator("body").innerText();
    expect(body).toContain("HML001");
    console.log("[TEST] HML001 encontrado na lista!");

    // Verify via DOM directly
    const placaVisible = page.locator("text=HML001");
    await expect(placaVisible.first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "test-results/e2e/tms0063/07-lista-hml.png", fullPage: false });
  });
});
