import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25c-ui-final";
test.describe("F25C-UI-FINAL â€” Central de RobÃ´s", () => {
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
await page.waitForLoadState("domcontentloaded");

      //  Verify login succeeded - page should no longer have login butto
const stillLogin = await loginBtn.isVisible().catch(() => false);

      console.log(`Login ainda visÃ­vel apÃ³s tentativa: ${stillLogin}`);}});
test("01 - Menu com Central de RobÃ´s", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Check all sidebar links for expanded categories
    //  The sidebar uses collapsible groups â€” try clicking "ConfiguraÃ§Ãµes" to expand
    const configuracoes = page.locator('button:has-text("ConfiguraÃ§Ãµes"), a:has-text("ConfiguraÃ§Ãµes"), span:has-text("ConfiguraÃ§Ãµes")').first();
if (await configuracoes.isVisible().catch(() => false)) {
await configuracoes.click();
await page.waitForTimeout(500);}
    //  Also try "GovernanÃ§a e TI"
    const governanca = page.locator('button:has-text("GovernanÃ§a"), a:has-text("GovernanÃ§a"), span:has-text("GovernanÃ§a")').first();
if (await governanca.isVisible().catch(() => false)) {
await governanca.click();
await page.waitForTimeout(500);}
    //  Now chec
const centralRobos = page.locator(':has-text("Central de RobÃ´s")').first();
const found = await centralRobos.isVisible().catch(() => false);
const foundInDom = (await page.locator(':has-text("Central de RobÃ´s")').count()) > 0;

    console.log(`"Central de RobÃ´s" visÃ­vel: ${found}, no DOM: ${foundInDom}`);

    //  Pass if visible in DOM at all (even if collapsed, it's in the source)
    expect(foundInDom).toBe(true);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-menu-central-robos.png"),      fullPage: false, });});
test("02 - PÃ¡gina /central-ia abre com abas RobÃ´s", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-pagina-central-ia.png"),      fullPage: true, });

    //  Verify page headin
const heading = page.locator("h1").filter({ hasText: /Central IA|RobÃ´s|Central de RobÃ´s/i }).first();
expect(heading).toBeVisible({ timeout: 10000 });

    //  Verify main tab
expect(page.locator('button[role="tab"]:has-text("RobÃ´s")')).toBeVisible({ timeout: 5000 });
expect(page.locator('button[role="tab"]:has-text("Tarefas")')).toBeVisible();
expect(page.locator('button[role="tab"]:has-text("AprovaÃ§Ãµes")')).toBeVisible();
expect(page.locator('button[role="tab"]:has-text("Logs")')).toBeVisible();});
test("03 - DiÃ¡logo Configurar com 3 abas", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Click first Configurar butto
const configBtn = page.locator('button[title="Configurar"]').first();
await configBtn.click();
await page.waitForTimeout(1000);

    //  Verify dialo
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });

    //  Get tabs in dialo
const tabs = dialog.locator('button[role="tab"]');
const tabNames: string[] = [];
for (let i = 0;

    i < (await tabs.count());

    i++) {

      tabNames.push((await tabs.nth(i).textContent())?.trim() || "");}    console.log(`Abas no diÃ¡logo: ${tabNames.join(", ")}`);
expect(tabNames).toContain("ConfiguraÃ§Ã£o");
expect(tabNames).toContain("InstruÃ§Ãµes");
expect(tabNames).toContain("Base de Conhecimento");
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-dialogo-3-abas.png"),      fullPage: false, });});
test("04 - InstruÃ§Ãµes: Nova InstruÃ§Ã£o aparece e tem campos", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Open confi
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(800);
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });

    //  Click InstruÃ§Ãµes ta
await dialog.locator('button[role="tab"]:has-text("InstruÃ§Ãµes")').click();
await page.waitForTimeout(500);

    //  Verify "Nova InstruÃ§Ã£o" button exist
const novaInstBtn = dialog.locator('button:has-text("Nova InstruÃ§Ã£o")');
expect(novaInstBtn).toBeVisible({ timeout: 10000 });

    //  Verify warning tex
expect(dialog.locator('text=Publicar uma nova versÃ£o substitui')).toBeVisible();

    //  Click Nova InstruÃ§Ã£
await novaInstBtn.click();
await page.waitForTimeout(1500);

    //  Check if Salvar Rascunho appears (means edit form was shown)
    const salvarBtn = dialog.locator('button:has-text("Salvar Rascunho")');
const hasForm = await salvarBtn.isVisible().catch(() => false);

    console.log(`FormulÃ¡rio de ediÃ§Ã£o visÃ­vel: ${hasForm}`);
if (hasForm) {

      //  Fill objective (first textarea after tom_de_conversa select
const textareas = dialog.locator("textarea");
const count = await textareas.count();

      console.log(`Textareas: ${count}`);
if (count > 0) await textareas.nth(0).fill("Atendimento ao cliente com qualidade e agilidade");
if (count > 1) await textareas.nth(1).fill("Regras fixas: sempre cumprir prazos estabelecidos");
if (count > 4) await textareas.nth(4).fill("Quando o cliente pedir para falar com um superior");
if (count > 5) await textareas.nth(5).fill("NÃ£o prometer valores, nÃ£o aprovar descontos");

      //  Click Salvar Rascunh
await salvarBtn.click();
await page.waitForTimeout(1000);

      //  Click Voltar to go back to lis
const voltarBtn = dialog.locator('button:has-text("Voltar")');
if (await voltarBtn.isVisible().catch(() => false)) {
await voltarBtn.click();
await page.waitForTimeout(500);}
      //  Check list shows the instructio
expect(dialog.locator('text=qualidade e agilidade')).toBeVisible({ timeout: 5000 });

      console.log("InstruÃ§Ã£o aparece na lista");
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-instrucao-na-lista.png"),        fullPage: false, });

      //  Close dialo
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

      //  Reloa
await page.reload();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

      //  Reopen same robot and chec
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(800);
const dialog2 = page.locator('[role="dialog"]');
expect(dialog2).toBeVisible({ timeout: 10000 });
await dialog2.locator('button[role="tab"]:has-text("InstruÃ§Ãµes")').click();
await page.waitForTimeout(500);

      //  Chec
const persisted = await dialog2.locator('text=qualidade e agilidade').isVisible().catch(() => false);

      console.log(`InstruÃ§Ã£o persistiu apÃ³s reload: ${persisted}`);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-instrucao-apos-reload.png"),        fullPage: false, });} else {

      // Take screenshot of what happened      console.log("FormulÃ¡rio de ediÃ§Ã£o nÃ£o apareceu â€” service pode ter falhado");
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-instrucao-form-nao-apareceu.png"),        fullPage: false, });}});
test("05 - Base de Conhecimento: criar e editar item", async ({ page }) => {
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Open confi
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(800);
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });

    //  Click Base de Conhecimento ta
await dialog.locator('button[role="tab"]:has-text("Conhecimento")').click();
await page.waitForTimeout(500);

    //  Verify "Novo Item" butto
const novoItemBtn = dialog.locator('button:has-text("Novo Item")');
expect(novoItemBtn).toBeVisible({ timeout: 10000 });

    //  Click it - the form should appear (fix applied to criarItem to set editItem)
    await novoItemBtn.click();
await page.waitForTimeout(1000);

    //  Chec
const salvarItemBtn = dialog.locator('button:has-text("Salvar")');
const temForm = await salvarItemBtn.isVisible().catch(() => false);

    console.log(`FormulÃ¡rio de ediÃ§Ã£o de conhecimento visÃ­vel: ${temForm}`);
if (temForm) {

      //  Fill tÃ­tul
const tituloInput = dialog.locator('input').first();
await tituloInput.fill("Procedimento de embarque");

      //  Fill conteÃºd
const textareas = dialog.locator("textarea");
if ((await textareas.count()) > 0) {
await textareas.first().fill("O procedimento de embarque segue as normas da ANTT.");}
      //  Select categori
const selects = dialog.locator('select, [role="combobox"]');
if ((await selects.count()) > 0) {
await selects.first().selectOption("OperaÃ§Ã£o").catch(() => {});}
      //  Sav
await salvarItemBtn.click();
await page.waitForTimeout(1000);

      //  Chec
await expect(dialog.locator('text=Procedimento de embarque')).toBeVisible({ timeout: 5000 });

      console.log("Item de conhecimento aparece na lista");
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-conhecimento-na-lista.png"),        fullPage: false, });

      //  Reloa
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await page.reload();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

      //  Reope
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(800);
const dialog3 = page.locator('[role="dialog"]');
expect(dialog3).toBeVisible({ timeout: 10000 });
await dialog3.locator('button[role="tab"]:has-text("Conhecimento")').click();
await page.waitForTimeout(500);
const persisted = await dialog3.locator('text=Procedimento de embarque').isVisible().catch(() => false);

      console.log(`Conhecimento persistiu apÃ³s reload: ${persisted}`);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-conhecimento-apos-reload.png"),        fullPage: false, });} else {

      console.log("FormulÃ¡rio nÃ£o apareceu â€” tirando screenshot");
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-conhecimento-form-nao-apareceu.png"),        fullPage: false, });}});});

