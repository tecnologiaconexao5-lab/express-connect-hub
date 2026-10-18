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
test.describe("F25C-CHECK â€” DiÃ¡logo de ConfiguraÃ§Ã£o", () => { test("07 - Clicar botÃ£o Configurar no primeiro robÃ´", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Find all buttons with gear/settings ico
const gearButtons = page.locator('button:has(svg[class*="Settings"])');
const gearCount = await gearButtons.count();

    console.log(`BotÃµes com Ã­cone Settings: ${gearCount}`);

    //  Also look for button[title="Configurar"]
    const configButtons = page.locator('button[title="Configurar"]');
const configCount = await configButtons.count();

    console.log(`BotÃµes com title="Configurar": ${configCount}`);

    //  Try to click the first gear butto
if (gearCount > 0) { await gearButtons.first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-apos-clicar-config.png"),        fullPage: false, });

      //  Chec
const dialog = page.locator('[role="dialog"]');
const dialogVisible = await dialog.isVisible().catch(() => false);

      console.log(`DiÃ¡logo visÃ­vel: ${dialogVisible}`);
if (dialogVisible) { //  Get tabs inside dialo
const dialogTabs = dialog.locator('[role="tab"], button[role="tab"]');
const dtCount = await dialogTabs.count();

        console.log(`Abas no diÃ¡logo: ${dtCount}`);
for (let i = 0;

        i < dtCount;

        i++) { const text = await dialogTabs.nth(i).textContent();

          console.log(`  Aba: "${text?.trim()}"`);}
        //  Get all button text in dialo
const dialogButtons = dialog.locator("button, span, div[role=tab]");
const dbCount = await dialogButtons.count();
for (let i = 0;

        i < Math.min(dbCount, 20);

        i++) { const txt = await dialogButtons.nth(i).textContent();
if (txt?.trim()) console.log(`  Elemento no diÃ¡logo: "${txt.trim()}"`);}}}});
test("08 - Clicar 'Novo RobÃ´' e ver se diÃ¡logo tem abas de instruÃ§Ãµes", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Click "Novo RobÃ´" button (this should open a dialog
const novoRoboBtn = page.locator('button:has-text("Novo RobÃ´")');
await novoRoboBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-novo-robo-dialog.png"),      fullPage: false, });
const dialog = page.locator('[role="dialog"]');
const dialogVisible = await dialog.isVisible().catch(() => false);

    console.log(`DiÃ¡logo "Novo RobÃ´" visÃ­vel: ${dialogVisible}`);
if (dialogVisible) { const allText = await dialog.textContent();

      console.log(`ConteÃºdo do diÃ¡logo: "${allText?.slice(0, 500)}"`);

      //  Check for InstruÃ§Ãµes and Conhecimento tabs
      const hasInstrucoes = allText?.includes("InstruÃ§Ãµes") || allText?.includes("instruÃ§Ãµes");
const hasConhecimento = allText?.includes("Conhecimento") || allText?.includes("Base de Conhecimento");

      console.log(`Aba InstruÃ§Ãµes presente: ${hasInstrucoes}`);

      console.log(`Aba Base de Conhecimento presente: ${hasConhecimento}`);

      //  Get role=tab button
const tabs = dialog.locator('button[role="tab"]');
const tabCount = await tabs.count();

      console.log(`Tabs no diÃ¡logo: ${tabCount}`);
for (let i = 0;

      i < tabCount;

      i++) { const text = await tabs.nth(i).textContent();

        console.log(`  Tab ${i + 1}: "${text?.trim()}"`);}}});
test("09 - Verificar se diÃ¡logo de robÃ´ existente tem InstruÃ§Ãµes e Conhecimento", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Find a robot's config button - look for Settings icon buttons inside robot cards
    // The robot cards are in a grid
    const gearButtons = page.locator('button:has(svg[class*="Settings"])');
const gearCount = await gearButtons.count();
if (gearCount > 0) { await gearButtons.first().click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role="dialog"]');
if (await dialog.isVisible().catch(() => false)) {
        //  Click on the InstruÃ§Ãµes tab if it exists
        const instrucoesTab = dialog.locator('button:has-text("InstruÃ§Ãµes")');
const temInstrucoes = await instrucoesTab.count();

        console.log(`Aba "InstruÃ§Ãµes" encontrada: ${temInstrucoes > 0}`);
if (temInstrucoes > 0) { await instrucoesTab.click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-aba-instrucoes-content.png"),            fullPage: false, });

          //  Check for Nova InstruÃ§Ã£o button
          const novaInstBtn = dialog.locator('button:has-text("Nova")');

          console.log(`BotÃµes com "Nova": ${await novaInstBtn.count()}`);}
        //  Click on Conhecimento ta
const conhecTab = dialog.locator('button:has-text("Conhecimento")');
const temConhec = await conhecTab.count();

        console.log(`Aba "Base de Conhecimento" encontrada: ${temConhec > 0}`);
if (temConhec > 0) { await conhecTab.click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-aba-conhecimento-content.png"),            fullPage: false, });}
        //  Print all content of dialo
const dialogText = await dialog.textContent();

        console.log("=== CONTEÃšDO DO DIÃLOGO ===");

        console.log(dialogText?.slice(0, 1500));}}});
test("10 - Verificar se ConfiguraÃ§Ã£o tab aparece para robÃ´ existente", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Click settings on the first car
const configBtn = page.locator('button:has(svg[class*="Settings"])');
if (await configBtn.first().isVisible().catch(() => false)) { await configBtn.first().click();
await page.waitForTimeout(800);

      //  Get dialog conten
const dialog = page.locator('[role="dialog"]');
const dialogText = await dialog.textContent();

      console.log("=== TEXTO COMPLETO DO DIÃLOGO ===");

      console.log(dialogText);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10-dialog-completo.png"),        fullPage: false, });}});});

