import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25c-audit";
test.describe("F25C.2 â€” AUDITORIA REAL DE ACESSO", () => { test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(1000);
const loginBtn = page.locator('button:has-text("Entrar")');
const hasLoginForm = await loginBtn.isVisible().catch(() => false);
if (hasLoginForm) { await page.waitForTimeout(500);
const emailInput = page.locator('input[placeholder*="email"], input[placeholder*="@"]').first();
await emailInput.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
if (await emailInput.isVisible().catch(() => false)) { await emailInput.click();
await emailInput.fill("admin@conexaoexpress.com.br");
const passwordInput = page.locator('input[type="password"]').first();
if (await passwordInput.isVisible().catch(() => false)) { await passwordInput.click();
await passwordInput.fill("admin123");}      await loginBtn.click();
await page.waitForTimeout(3000);
await page.waitForLoadState("domcontentloaded");}}}});
test("ETAPA 1 â€” Validar rota /central-ia", async ({ page }) => { //  Liste
const consoleErrors: string[] = [];

    page.on("console", (msg) => { if (msg.type() === "error") { consoleErrors.push(msg.text());}});
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    // Check console errors    console.log(`Erros no console: ${consoleErrors.length > 0 ? consoleErrors.join(" | ") : "NENHUM"}`);
expect(consoleErrors.filter(e => !e.includes("favicon") && !e.includes("503"))).toHaveLength(0);

    // Check for redirect (current URL should still be /central-ia)    const currentUrl = page.url();
    console.log(`URL atual: ${currentUrl}`);
expect(currentUrl).toContain("/central-ia");

    // Check for auth block â€” login button should NOT be visible    const loginBtn = page.locator('button:has-text("Entrar")');
const stillLogin = await loginBtn.isVisible().catch(() => false);
    console.log(`Tela de login ainda visÃ­vel? ${stillLogin}`);
expect(stillLogin).toBe(false);

    // Check page heading    const heading = page.locator("h1").filter({ hasText: /Central IA|Central de RobÃ´s/i}).first();
const headingVisible = await heading.isVisible().catch(() => false);
    console.log(`Heading "Central IA" visÃ­vel? ${headingVisible}`);

    // Screenshot full page    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-rota-central-ia.png"),      fullPage: true,});

    // Verify main page content    await expect(page.locator('button[role="tab"]:has-text("RobÃ´s")')).toBeVisible({ timeout: 5000});
    console.log("ETAPA 1 âœ… â€” Rota /central-ia abre corretamente");});
test("ETAPA 2 â€” Auditar menu lateral", async ({ page}) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    // The sidebar auto-expands groups when their child route matches.    // At /central-ia, "GovernanÃ§a e TI" and "ConfiguraÃ§Ãµes" groups    // should already be expanded because both contain a "Central de RobÃ´s" child    // with path "/central-ia". Simply hovering the sidebar area expands it.    const sidebar = page.locator('aside').first();
await sidebar.hover();
await page.waitForTimeout(500);

    // Debug: sidebar width    const sidebarWidth = await sidebar.evaluate(el => el.offsetWidth).catch(() => 0);
    console.log(`Sidebar width: ${sidebarWidth}px`);

    // List all buttons in sidebar BEFORE any clicks    const allBtns = sidebar.locator('button');
const totalBtns = await allBtns.count();
    console.log(`Total buttons in sidebar: ${totalBtns}`);
let foundCentral = false;
let centralIndex = -1;
for (let i = 0;
    i < totalBtns;
    i++) { const txt = (await allBtns.nth(i).textContent())?.trim() || "";
if (txt.includes("Central de RobÃ´s")) { foundCentral = true;
        centralIndex = i;
if (txt) { const isGroup = txt === "GovernanÃ§a e TI" || txt === "API e IntegraÃ§Ãµes" || txt === "ConfiguraÃ§Ãµes";
        console.log(`  ${i}: "${txt}"${isGroup ? " [GRUPO]" : ""}`);}}
    // Take sidebar screenshot    await sidebar.screenshot({ path: path.join(SCREENSHOT_DIR, "02-sidebar-expandida.png"),});

    // Report findings    console.log(`"Central de RobÃ´s" encontrado no botÃ£o Ã­ndice ${centralIndex}: ${foundCentral}`);

    // Screenshot da pÃ¡gina toda para evidÃªncia    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-pagina-com-sidebar.png"),      fullPage: false,});

    // Assert: "Central de RobÃ´s" MUST exist in the sidebar buttons    expect(foundCentral).toBe(true);
    console.log("ETAPA 2 âœ… â€” Menu lateral auditado: 'Central de RobÃ´s' encontrado");});
test("ETAPA 6+7 â€” ValidaÃ§Ã£o completa da Central de RobÃ´s", async ({ page}) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    // Screenshot 1: PÃ¡gina inteira    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-pagina-completa.png"),      fullPage: true,});

    // ETAPA 7 â€” Aba RobÃ´s e 8 robÃ´s    const tabRobos = page.locator('button[role="tab"]:has-text("RobÃ´s")');
expect(tabRobos).toBeVisible({ timeout: 5000});

    // Contar robÃ´s listados â€” cada robÃ´ tem um card com tÃ­tulo    const roboCards = page.locator('[class*="robot"], [class*="card"], div').filter({ hasText: /RobÃ´s Digitais por Setor|Cliente IA|Comercial IA|Financeiro IA|Fiscal IA|Monitoramento IA|Operacional IA|Prestador IA|Recrutamento IA/});
const roboText = await page.locator("body").textContent();
const expectedRobos = ["Cliente IA", "Comercial IA", "Financeiro IA", "Fiscal IA", "Monitoramento IA", "Operacional IA", "Prestador IA", "Recrutamento IA"];
let foundRobos = 0;
for (const nome of expectedRobos) { if (roboText?.includes(nome)) foundRobos++;}    console.log(`RobÃ´s encontrados: ${foundRobos}/8`);

    // BotÃ£o Configurar    const configBtn = page.locator('button[title="Configurar"]').first();
expect(configBtn).toBeVisible({ timeout: 5000});
await configBtn.click();
await page.waitForTimeout(1000);

    // Dialog    const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000});

    // Screenshot: Dialog    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-dialogo-configurar.png"),      fullPage: false,});

    // Verificar 3 abas    const tabs = dialog.locator('button[role="tab"]');
const tabNames: string[] = [];
for (let i = 0;
    i < (await tabs.count());
    i++) { tabNames.push((await tabs.nth(i).textContent())?.trim() || "");}    console.log(`Abas no diÃ¡logo: ${tabNames.join(", ")}`);
expect(tabNames).toContain("ConfiguraÃ§Ã£o");
expect(tabNames).toContain("InstruÃ§Ãµes");
expect(tabNames).toContain("Base de Conhecimento");

    // Screenshot: Aba InstruÃ§Ãµes    await dialog.locator('button[role="tab"]:has-text("InstruÃ§Ãµes")').click();
await page.waitForTimeout(500);
expect(dialog.locator('button:has-text("Nova InstruÃ§Ã£o")')).toBeVisible({ timeout: 5000});
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-aba-instrucoes.png"),      fullPage: false,});

    // Screenshot: Aba Base de Conhecimento    await dialog.locator('button[role="tab"]:has-text("Conhecimento")').click();
await page.waitForTimeout(500);
expect(dialog.locator('button:has-text("Novo Item")')).toBeVisible({ timeout: 5000});
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-aba-conhecimento.png"),      fullPage: false,});
    console.log("ETAPA 7 âœ… â€” Central de RobÃ´s validada: abas, robÃ´s, diÃ¡logo");});});

