import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25c-check";
async function login(page: any) { await page.goto("/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(1000);

  //  Check if we're on login page
  const loginForm = page.locator('input[type="email"], input[placeholder*="email"], button:has-text("Entrar")');
if (await loginForm.first().isVisible().catch(() => false)) { //  Fill credential
const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
await emailInput.fill("tamiris.castilho@conexaoexpress.com.br");
const passwordInput = page.locator('input[type="password"]').first();
await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator('button:has-text("Entrar")').click();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);}};
test.describe("F25C-CHECK â€” LocalizaÃ§Ã£o Visual Central IA", () => { test("01 - Abrir /central-ia e capturar tela cheia", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-central-ia-full.png"),      fullPage: true, });

    //  Find the page headin
const pageHeading = page.locator("h1, h2").filter({ hasText: /Central IA|RobÃ´s|AutomaÃ§Ã£o|Central de RobÃ´s/i }).first();
const headingText = await pageHeading.textContent();

    console.log(`TÃ­tulo da pÃ¡gina: "${headingText}"`);
expect(await pageHeading.isVisible()).toBe(true);});
test("02 - Capturar abas visÃ­veis no topo", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Find all tabs with different selectors
    const tabs = page.locator('[role="tab"], button[role="tab"], [class*="tab"] button, [data-state="active"]');
const tabCount = await tabs.count();

    console.log(`Elementos encontrados: ${tabCount}`);

    //  Try to find TabsLis
const tabsList = page.locator('[role="tablist"]');
if (await tabsList.isVisible().catch(() => false)) { const tabButtons = tabsList.locator("button");
const btnCount = await tabButtons.count();

      console.log(`Abas no tablist: ${btnCount}`);
for (let i = 0;

      i < btnCount;

      i++) { const text = await tabButtons.nth(i).textContent();

        console.log(`  Aba ${i + 1}: "${text?.trim()}"`);}}
    //  Log all button text on pag
const allButtons = page.locator("button");
const allBtnCount = await allButtons.count();
for (let i = 0;

    i < Math.min(allBtnCount, 40);

    i++) { const txt = await allButtons.nth(i).textContent();
if (txt?.trim()) console.log(`  BotÃ£o: "${txt.trim()}"`);}    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-tabs-topo.png"),      fullPage: false, });});
test("03 - Encontrar botÃµes de configuraÃ§Ã£o nos robÃ´s", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Look for settings/gear icons and buttons
    const settingsButtons = page.locator('button[title*="Config"], button[aria-label*="Config"], svg[class*="Settings"]');
const settingsCount = await settingsButtons.count();

    console.log(`BotÃµes de configuraÃ§Ã£o: ${settingsCount}`);

    //  Also look for any button with gear/settings icon
    const gearIcons = page.locator('button:has(svg[class*="settings"]), button:has(svg[class*="cog"]), button:has(svg[class*="Settings"])');
const gearCount = await gearIcons.count();

    console.log(`BotÃµes com Ã­cone de engrenagem: ${gearCount}`);

    //  Generic: loo
const allButtons = page.locator("button");
const count = await allButtons.count();

    console.log(`Total de botÃµes: ${count}`);
for (let i = 0;

    i < count;

    i++) { const txt = await allButtons.nth(i).textContent();
const html = await allButtons.nth(i).getAttribute("class");
if (txt?.trim() || html) { console.log(`  BotÃ£o ${i}: texto="${txt?.trim()}", class="${html?.slice(0, 60)}"`);}}    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-botoes-config.png"),      fullPage: false, });});
test("04 - Listar todo o conteÃºdo textual da pÃ¡gina", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Get all text from the main content are
const bodyText = await page.locator("body").textContent();

    //  Extract interesting line
const lines = bodyText?.split("\n").map(l => l.trim()).filter(l => l.length > 2 && l.length < 100) || [];

    console.log("=== CONTEÃšDO DA PÃGINA ===");
for (const line of lines.slice(0, 80)) { console.log(`  "${line}"`);}    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-pagina-completa.png"),      fullPage: true, });});
test("05 - Verificar se sidebar tem Central IA", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Chec
const sidebarLinks = page.locator('a:has-text("Central IA"), span:has-text("Central IA"), div:has-text("Central IA")');
const linkCount = await sidebarLinks.count();

    console.log(`ReferÃªncias "Central IA" na pÃ¡gina: ${linkCount}`);
for (let i = 0;

    i < linkCount;

    i++) { const visible = await sidebarLinks.nth(i).isVisible();
const text = await sidebarLinks.nth(i).textContent();

      console.log(`  "${text?.trim()}" â†’ visÃ­vel: ${visible}`);}    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-sidebar.png"),      fullPage: false, });});
test("06 - Registrar estrutura DOM da pÃ¡gina", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Log the page structur
const structure = await page.evaluate(() => { function getStructure(el: Element, depth = 0): string { if (depth > 6) return "";
const tag = el.tagName.toLowerCase();
const id = el.id ? `#${el.id}` : "";
const cls = Array.from(el.classList).slice(0, 3).join(".");
const text = (el.textContent || "").trim().slice(0, 80);
let result = "  ".repeat(depth) + `<${tag}${id ? ` id="${id}"` : ""}${cls ? ` class="${cls}"` : ""}>`;
if (text && depth < 3) result += ` "${text}"`;

        result += `\n`;
for (const child of Array.from(el.children).slice(0, 15)) { result += getStructure(child, depth + 1); }
return result; }
return getStructure(document.body); });

    console.log("=== ESTRUTURA DOM ===");

    console.log(structure.slice(0, 3000));
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-dom-structure.png"),      fullPage: true, });});});

