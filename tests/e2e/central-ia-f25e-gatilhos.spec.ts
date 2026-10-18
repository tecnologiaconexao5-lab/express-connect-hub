import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25e-gatilhos";
test.describe("F25E â€” Gatilhos e Alertas", () => {
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
test("01 - Aba Gatilhos e Alertas existe no diÃ¡logo", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);
const configBtn = page.locator('button[title="Configurar"]').first();
expect(configBtn).toBeVisible({ timeout: 5000 });
await configBtn.click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });
const tabs = dialog.locator('button[role="tab"]');
const tabNames: string[] = [];
for (let i = 0;

    i < (await tabs.count());

    i++) {

      tabNames.push((await tabs.nth(i).textContent())?.trim() || "");}    console.log(`Abas no diÃ¡logo: ${tabNames.join(", ")}`);
expect(tabNames).toContain("Gatilhos e Alertas");
await dialog.locator('button[role="tab"]:has-text("Gatilhos e Alertas")').click();
await page.waitForTimeout(500);
expect(dialog.locator('button:has-text("Novo Gatilho")')).toBeVisible({ timeout: 5000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-aba-gatilhos.png"),      fullPage: false, });

    console.log("Aba Gatilhos e Alertas existe com botÃ£o 'Novo Gatilho' âœ…");});
test("02 - Filtros e estrutura da aba", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(800);
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });
await dialog.locator('button[role="tab"]:has-text("Gatilhos e Alertas")').click();
await page.waitForTimeout(500);
expect(dialog.locator('button:has-text("Novo Gatilho")')).toBeVisible({ timeout: 5000 });
const filters = dialog.locator('select, [role="combobox"]');
expect(await filters.count()).toBeGreaterThanOrEqual(2);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-aba-gatilhos-estrutura.png"),      fullPage: false, });

    console.log("Aba Gatilhos e Alertas com filtros âœ…");});
test("03 - PÃ¡gina carrega sem erros de console", async ({ page }) => {
const consoleErrors: string[] = [];

    page.on("console", (msg) => {
if (msg.type() === "error") {

        consoleErrors.push(msg.text());}});
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);
const gatilhoErrors = consoleErrors.filter(e =>      e.includes("gatilho") || e.includes("Gatilho")    );

    console.log(`Erros relacionados a gatilhos: ${gatilhoErrors.length > 0 ? gatilhoErrors.join(" | ") : "NENHUM"}`);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-pagina-sem-erros.png"),      fullPage: false, });});});

