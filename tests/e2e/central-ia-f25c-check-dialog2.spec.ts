import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25c-check";
async function login(page: any) { await page.goto("/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(1000);
const loginForm = page.locator('input[type="email"], input[placeholder*="email"], button:has-text("Entrar")');
if (await loginForm.first().isVisible().catch(() => false)) { const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
await emailInput.fill("tamiris.castilho@conexaoexpress.com.br");
const passwordInput = page.locator('input[type="password"]').first();
await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator('button:has-text("Entrar")').click();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);}};
test.describe("F25C-CHECK â€” DiÃ¡logo Config RobÃ´", () => { test("07 - Clicar Configurar no primeiro robÃ´ e ver diÃ¡logo", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Click first Configurar button (title="Configurar"
const configBtn = page.locator('button[title="Configurar"]').first();
await configBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-dialog-apos-configurar.png"),      fullPage: false, });

    //  Check dialo
const dialog = page.locator('[role="dialog"]');
const visible = await dialog.isVisible().catch(() => false);

    console.log(`DiÃ¡logo visÃ­vel: ${visible}`);
expect(visible).toBe(true);

    //  Get all tabs in dialo
const tabs = dialog.locator('button[role="tab"]');
const tabCount = await tabs.count();

    console.log(`Abas no diÃ¡logo: ${tabCount}`);
for (let i = 0;

    i < tabCount;

    i++) { const text = await tabs.nth(i).textContent();

      console.log(`  Aba ${i + 1}: "${text?.trim()}"`);}
    //  Print dialog conten
const dialogText = await dialog.textContent();

    console.log("=== CONTEÃšDO DO DIÃLOGO (primeiros 1000 chars) ===");

    console.log(dialogText?.slice(0, 1000));});
test("08 - Clicar InstruÃ§Ãµes e ver conteÃºdo", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role="dialog"]');
const instrucoesTab = dialog.locator('button[role="tab"]:has-text("InstruÃ§Ãµes")');
const hasInst = await instrucoesTab.count();

    console.log(`Aba InstruÃ§Ãµes existe: ${hasInst > 0}`);
if (hasInst > 0) { await instrucoesTab.click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-aba-instrucoes.png"),        fullPage: false, });
const content = await dialog.textContent();

      console.log("ConteÃºdo apÃ³s clicar InstruÃ§Ãµes:");

      console.log(content?.slice(0, 800));

      //  Check for Nova InstruÃ§Ã£o button
      const novaBtn = dialog.locator('button:has-text("Nova InstruÃ§Ã£o")');

      console.log(`BotÃ£o "Nova InstruÃ§Ã£o": ${await novaBtn.count()}`);} else { //  Let's also try with different text match
      const allTabs = dialog.locator('button[role="tab"]');
const count = await allTabs.count();

      console.log(`Todas as abas (${count}):`);
for (let i = 0;

      i < count;

      i++) { const t = await allTabs.nth(i).textContent();

        console.log(`  [${i}] "${t?.trim()}"`);}}});
test("09 - Clicar Base de Conhecimento e ver conteÃºdo", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role="dialog"]');
const conhTab = dialog.locator('button[role="tab"]:has-text("Conhecimento")');
const hasConh = await conhTab.count();

    console.log(`Aba Conhecimento existe: ${hasConh > 0}`);
if (hasConh > 0) { await conhTab.click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-aba-conhecimento.png"),        fullPage: false, });
const content = await dialog.textContent();

      console.log("ConteÃºdo apÃ³s clicar Conhecimento:");

      console.log(content?.slice(0, 800));
const novoBtn = dialog.locator('button:has-text("Novo Item")');

      console.log(`BotÃ£o "Novo Item": ${await novoBtn.count()}`);}});
test("10 - Verificar se Novo RobÃ´ tem abas InstruÃ§Ãµes/Conhecimento", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Find and click Novo RobÃ
const novoBtn = page.locator('button:has-text("Novo RobÃ´")');
const exists = await novoBtn.count();

    console.log(`BotÃ£o "Novo RobÃ´" existe: ${exists > 0}`);
if (exists > 0) { await novoBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10-novo-robo-dialog.png"),        fullPage: false, });

      //  Wait a bit mor
await page.waitForTimeout(500);
const dialog = page.locator('[role="dialog"]');
const visible = await dialog.isVisible().catch(() => false);

      console.log(`DiÃ¡logo visÃ­vel: ${visible}`);
if (visible) { const tabs = dialog.locator('button[role="tab"]');
const tabCount = await tabs.count();

        console.log(`Abas no diÃ¡logo Novo RobÃ´: ${tabCount}`);
for (let i = 0;

        i < tabCount;

        i++) { const text = await tabs.nth(i).textContent();

          console.log(`  Aba: "${text?.trim()}"`);}}}});});

