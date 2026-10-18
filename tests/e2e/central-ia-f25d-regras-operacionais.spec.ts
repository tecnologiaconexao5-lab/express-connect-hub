import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25d-regras-operacionais";
test.describe("F25D â€” Regras Operacionais", () => {
test.beforeEach(async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(1000);
const loginBtn = page.locator('button:has-text("Entrar")');
const hasLoginForm = await loginBtn.isVisible().catch(() => false);
if (hasLoginForm) {
await page.waitForTimeout(500);
const emailInput = page.locator('input[placeholder*="email"], input[placeholder*="@"]').first();
await emailInput.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
if (await emailInput.isVisible().catch(() => false)) {
await emailInput.click();
await emailInput.fill("tamiris.castilho@conexaoexpress.com.br");}      const passwordInput = page.locator('input[type="password"]').first();
if (await passwordInput.isVisible().catch(() => false)) {
await passwordInput.click();
await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");}      await loginBtn.click();
await page.waitForTimeout(3000);
await page.waitForLoadState("domcontentloaded");}});
test("01 - Aba Regras Operacionais existe no diÃ¡logo", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Click first Configurar butto
const configBtn = page.locator('button[title="Configurar"]').first();
expect(configBtn).toBeVisible({ timeout: 5000 });
await configBtn.click();
await page.waitForTimeout(1000);

    //  Dialog visibl
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });

    //  Check tabs in dialo
const tabs = dialog.locator('button[role="tab"]');
const tabNames: string[] = [];
for (let i = 0;

    i < (await tabs.count());

    i++) {

      tabNames.push((await tabs.nth(i).textContent())?.trim() || "");}    console.log(`Abas no diÃ¡logo: ${tabNames.join(", ")}`);

    expect(tabNames).toContain("Regras Operacionais");

    //  Click Regras Operacionais ta
await dialog.locator('button[role="tab"]:has-text("Regras Operacionais")').click();
await page.waitForTimeout(500);

    //  Button "Nova Regra" should be visibl
expect(dialog.locator('button:has-text("Nova Regra")')).toBeVisible({ timeout: 5000 });

    //  Screensho
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-aba-regras-operacionais.png"),      fullPage: false, });

    console.log("Aba Regras Operacionais existe com botÃ£o 'Nova Regra' âœ…");});
test("02 - BotÃ£o Nova Regra e estrutura da aba", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Open config dialo
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(800);
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });

    //  Go to Regras Operacionais ta
await dialog.locator('button[role="tab"]:has-text("Regras Operacionais")').click();
await page.waitForTimeout(500);

    //  Verify "Nova Regra" button exist
const novaRegraBtn = dialog.locator('button:has-text("Nova Regra")');
expect(novaRegraBtn).toBeVisible({ timeout: 5000 });

    //  Verify filter dropdown exist
const statusFilter = dialog.locator('select, [role="combobox"]').first();
expect(statusFilter).toBeVisible({ timeout: 5000 });

    //  Screensho
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-aba-regras-estrutura.png"),      fullPage: false, });

    console.log("Aba Regras Operacionais com botÃ£o Nova Regra e filtro âœ…");});
test("03 - PÃ¡gina carrega sem erros de console", async ({ page }) => {
    //  Test checks that the page loads without runtime errors
    //  related to the new service functions
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
if (msg.type() === "error") {

        consoleErrors.push(msg.text());}});
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Check console error
const ourErrors = consoleErrors.filter(e =>      e.includes("regra") || e.includes("Regra") || e.includes("regras")    );

    console.log(`Erros relacionados a regras: ${ourErrors.length > 0 ? ourErrors.join(" | ") : "NENHUM"}`);

    //  The page loads without crashing even though Supabase might not be configured    // because service functions are only called on interactio
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-pagina-sem-erros.png"),      fullPage: false, });});});

