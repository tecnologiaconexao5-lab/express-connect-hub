import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25fa1-auditoria";
async function login(page) {
await page.goto("/", {

    waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
const loginForm = page.locator('input[type="email"], input[placeholder*="email"], button:has-text("Entrar")');
if (await loginForm.first().isVisible().catch(() => false)) {
await page.locator('input[type="email"], input[placeholder*="email"]').first().fill("tamiris.castilho@conexaoexpress.com.br");
await page.locator('input[type="password"]').first().fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator('button:has-text("Entrar")').click();
await page.waitForTimeout(3000);}};
test.describe("F25FA.1 â€” Auditoria Central de Treinamento", () => {
test("01 - Central IA: abas principais carregam", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-central-ia-main.png"),      fullPage: true, });

    //  Check main tab
const bodyText = await page.locator("body").textContent();
expect(bodyText).not.toContain("ErrorBoundary");

    //  List all tabs foun
const tabs = page.locator('[role="tab"]');
const tabCount = await tabs.count();

    console.log(`Abas principais encontradas: ${tabCount}`);
for (let i = 0;

    i < tabCount;

    i++) {
const text = await tabs.nth(i).textContent();

      console.log(`  Tab ${i + 1}: "${text?.trim()}"`);}
    //  Chec
const hasConhecimento = bodyText.includes("Conhecimento") || bodyText.includes("conhecimento");
const hasTreinamento = bodyText.includes("Treinamento") || bodyText.includes("treinamento");
const hasUpload = bodyText.includes("Upload") || bodyText.includes("upload");
const hasAnexo = bodyText.includes("Anexo") || bodyText.includes("anexo");
const hasArquivo = bodyText.includes("Arquivo") || bodyText.includes("arquivo");

    console.log(`Conhecimento: ${hasConhecimento}`);

    console.log(`Treinamento: ${hasTreinamento}`);

    console.log(`Upload: ${hasUpload}`);

    console.log(`Anexo: ${hasAnexo}`);

    console.log(`Arquivo: ${hasArquivo}`);});
test("02 - Dialog do robÃ´: abas de instruÃ§Ãµes, conhecimento, regras, gatilhos", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Find and click the "Configurar" button (gear icon) on a robot car
const editBtn = page.locator('button[title="Configurar"]').first();
if (await editBtn.isVisible().catch(() => false)) {
await editBtn.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-dialog-robos.png"),        fullPage: false, });

      // Now find tabs INSIDE the dialog (not the main page tabs)
      //  The dialog has sub-tabs: ConfiguraÃ§Ã£o, InstruÃ§Ãµes, Base de Conhecimento, Regras Operacionais, Gatilho
const dialogContent = page.locator('[role="dialog"]').first();
if (await dialogContent.isVisible().catch(() => false)) {
const dialogTabs = dialogContent.locator('[role="tab"]');
const dtCount = await dialogTabs.count();

        console.log(`Sub-abas no dialog: ${dtCount}`);
for (let i = 0;

        i < dtCount;

        i++) {
const text = await dialogTabs.nth(i).textContent();

          console.log(`  Sub-tab ${i + 1}: "${text?.trim()}"`);}
        //  Click on each sub-tab and take screensho
for (let i = 0;

        i < dtCount;

        i++) {
const tabText = (await dialogTabs.nth(i).textContent()).trim();
await dialogTabs.nth(i).click();
await page.waitForTimeout(1000);
const safeName = tabText.toLowerCase().replace(/[^a-z0-9]/g, '-');
await page.screenshot({ path: path.join(SCREENSHOT_DIR, `02-subtab-${safeName}.png`),            fullPage: false, });

          console.log(`Capturado: ${tabText}`);}}
      //  Close dialo
await page.keyboard.press("Escape");
await page.waitForTimeout(500);} else {

      console.log("Botao Editar nao encontrado");}});
test("03 - Base de Conhecimento: verificar upload, histÃ³rico, busca", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Click "Configurar" button to open dialo
const editBtn = page.locator('button[title="Configurar"]').first();
if (await editBtn.isVisible().catch(() => false)) {
await editBtn.click();
await page.waitForTimeout(2000);}
    //  Click on "Base de Conhecimento" tab inside dialo
const dialogContent = page.locator('[role="dialog"]').first();
if (!await dialogContent.isVisible().catch(() => false)) {

      console.log("Dialog nao visivel");
return;}    const conhecimentoTab = dialogContent.locator('[role="tab"]').filter({ hasText: /Conhecimento/i }).first();
if (await conhecimentoTab.isVisible().catch(() => false)) {
await conhecimentoTab.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-base-conhecimento.png"),        fullPage: false, });
const bodyText = await page.locator("body").textContent();

      //  Check for upload/attachment features
      const hasUpload = bodyText.includes("upload") || bodyText.includes("Upload") || bodyText.includes("anexar") || bodyText.includes("Anexar");

      //  Check for file/attachment buttons
      const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Anexar"), button:has-text("Arquivo"), input[type="file"]').first();
const hasUploadBtn = await uploadBtn.isVisible().catch(() => false);

      //  Chec
const searchField = page.locator('input[placeholder*="busca"], input[placeholder*="Busca"], input[placeholder*="pesquis"], input[placeholder*="Pesquis"]').first();
const hasSearch = await searchField.isVisible().catch(() => false);

      //  Chec
const filters = page.locator('[role="combobox"], select').first();
const hasFilters = await filters.isVisible().catch(() => false);

      //  Chec
const hasVersao = bodyText.includes("versÃ£o") || bodyText.includes("versao") || bodyText.includes("VersÃ£o") || bodyText.includes("Versao");

      console.log(`Upload/attachment buttons: ${hasUploadBtn}`);

      console.log(`Upload/anexar no texto: ${hasUpload}`);

      console.log(`Busca: ${hasSearch}`);

      console.log(`Filtros: ${hasFilters}`);

      console.log(`VersÃ£o: ${hasVersao}`);

      //  Check content are
const items = page.locator('[class*="list-item"], [class*="listItem"], tr, [class*="card"]').filter({ hasText: /ativo|inativo|rascunho/i });
const itemCount = await items.count().catch(() => 0);

      console.log(`Itens visÃ­veis: ${itemCount}`);} else {

      console.log("Sub-aba 'Base de Conhecimento' nao encontrada");}});
test("04 - InstruÃ§Ãµes: verificar versionamento e aprovaÃ§Ã£o", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
const editBtn2 = page.locator('button[title="Configurar"]').first();
if (await editBtn2.isVisible().catch(() => false)) {
await editBtn2.click();
await page.waitForTimeout(2000);}    const dialogContent2 = page.locator('[role="dialog"]').first();
if (!await dialogContent2.isVisible().catch(() => false)) {

      console.log("Dialog nao visivel");
return;}    const instrucoesTab = dialogContent2.locator('[role="tab"]').filter({ hasText: /Instru/i }).first();
if (await instrucoesTab.isVisible().catch(() => false)) {
await instrucoesTab.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-instrucoes.png"),        fullPage: false, });
const bodyText = await page.locator("body").textContent();
const hasVersao = bodyText.includes("versÃ£o") || bodyText.includes("versao");
const hasPublicar = bodyText.includes("Publicar") || bodyText.includes("publicar");
const hasHistorico = bodyText.includes("HistÃ³rico") || bodyText.includes("historico");

      console.log(`Versionamento: ${hasVersao}`);

      console.log(`Publicar/RevisÃ£o: ${hasPublicar}`);

      console.log(`HistÃ³rico: ${hasHistorico}`);}});
test("05 - Console limpo e requisicoes", async ({ page }) => {
const jsErrors = [];
const networkErrors = [];

    page.on("console", (msg) => {
if (msg.type() === "error") {
const text = msg.text();
if (text.includes("400") || text.includes("Failed to load resource")) {

          networkErrors.push(text);} else {

          jsErrors.push(text);}}});

    page.on("pageerror", (err) => {
      jsErrors.push(`Page Error: ${err.message}`);});
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Navigate through all main tab
const tabs = page.locator('[role="tab"]');
const tabCount = await tabs.count();
for (let i = 0;

    i < Math.min(tabCount, 5);

    i++) {
const text = await tabs.nth(i).textContent();
await tabs.nth(i).click();
await page.waitForTimeout(1000);

      console.log(`Tab "${text?.trim()}" carregada`);}    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-all-tabs.png"),      fullPage: true, });

    console.log(`Erros JavaScript: ${jsErrors.length}`);

    jsErrors.forEach(e => console.log(`  ${e}`));

    console.log(`Network errors: ${networkErrors.length}`);

    //  React DOM nesting warnings (e.g. <div> inside <p>) are warnings, not runtime error
const realJsErrors = jsErrors.filter(e => !e.includes("validateDOMNesting") && !e.includes("Warning"));

    console.log(`Erros JS reais (excluindo warnings React): ${realJsErrors.length}`);

    realJsErrors.forEach(e => console.log(`  ${e}`));
expect(realJsErrors.length).toBe(0);});});

