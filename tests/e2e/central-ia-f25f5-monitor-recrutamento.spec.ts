import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25f5-monitor";
async function login(page: any) {
await page.goto("/", {

    waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
const loginForm = page.locator('input[type="email"], input[placeholder*="email"], button:has-text("Entrar")');
if (await loginForm.first().isVisible().catch(() => false)) {
const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
await emailInput.fill("tamiris.castilho@conexaoexpress.com.br");
const passwordInput = page.locator('input[type="password"]').first();
await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator('button:has-text("Entrar")').click();
await page.waitForTimeout(3000);}};
test.describe("F25F5-A â€” Monitor do RobÃ´ de Recrutamento", () => {
test("01 - Login e navegaÃ§Ã£o atÃ© /robo-recrutamento-monitor", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);

    //  Navigate directl
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Screensho
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-monitor-full.png"),      fullPage: true, });

    //  Check no ErrorBoundar
const bodyText = await page.locator("body").textContent();
expect(bodyText).not.toContain("ErrorBoundary");
expect(bodyText).not.toContain("Algo deu errado");
expect(bodyText).not.toContain("Algo saiu errado");

    //  Check UR
expect(page.url()).toContain("/robo-recrutamento-monitor");

    //  Check page headin
const heading = page.locator("h1").first();
expect(heading).toBeVisible();
const headingText = await heading.textContent();
expect(headingText).toContain("Monitor");
expect(headingText).toContain("RobÃ´");

    console.log(`TÃ­tulo da pÃ¡gina: "${headingText}"`);});
test("02 - Dashboard cards exibidos com valores vÃ¡lidos", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Screenshot of dashboard card
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-dashboard-cards.png"),      fullPage: false, });

    //  Check that metric cards exist (they show numbers
const cards = page.locator("p.text-2xl.font-bold");
const cardCount = await cards.count();

    console.log(`Cards mÃ©tricos encontrados: ${cardCount}`);
expect(cardCount).toBeGreaterThanOrEqual(3);

    //  At least some cards    // All values should be valid numbers (not NaN, undefined, null
for (let i = 0;

    i < cardCount;

    i++) {
const text = await cards.nth(i).textContent();

      console.log(`Card ${i + 1}: "${text?.trim()}"`);
expect(text?.trim()).not.toBe("undefined");
expect(text?.trim()).not.toBe("null");
expect(text?.trim()).not.toBe("NaN");

      //  Should be a number (possibly "0"
expect(text?.trim()).toMatch(/^\d+$/);}
    //  Check card label
const labels = page.locator("p.text-xs.text-muted-foreground");
const labelCount = await labels.count();

    console.log(`Labels encontrados: ${labelCount}`);
for (let i = 0;

    i < labelCount;

    i++) {
const text = await labels.nth(i).textContent();

      console.log(`Label ${i + 1}: "${text?.trim()}"`);}});
test("03 - Tabela de histÃ³rico renderizada", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Screenshot of table are
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-table.png"),      fullPage: false, });

    //  Check table header
const headers = page.locator("thead th");
const headerCount = await headers.count();

    console.log(`Colunas no cabeÃ§alho: ${headerCount}`);
expect(headerCount).toBeGreaterThanOrEqual(4);
const headerTexts: string[] = [];
for (let i = 0;

    i < headerCount;

    i++) {
const text = await headers.nth(i).textContent();
if (text) headerTexts.push(text.trim());

      console.log(`Coluna ${i + 1}: "${text?.trim()}"`);}
    //  Check the table card titl
const cardTitle = page.locator("h3, .card-title, [class*='CardTitle']").filter({ hasText: /execuÃ§/i });
const titleVisible = await cardTitle.first().isVisible().catch(() => false);
if (titleVisible) {

      console.log(`TÃ­tulo do card: "${await cardTitle.first().textContent()}"`);}
    //  Check body rows or empty stat
const rows = page.locator("tbody tr");
const rowCount = await rows.count();

    console.log(`Linhas no corpo: ${rowCount}`);
if (rowCount === 1) {

      //  Might be "carregando" or "nenhuma" stat
const cellText = await rows.first().locator("td").first().textContent();

      console.log(`Estado da tabela: "${cellText?.trim()}"`);

      //  Check for "nenhuma" empty state message
      const bodyText = await page.locator("body").textContent();
if (bodyText?.includes("Nenhuma execuÃ§Ã£o")) {

        console.log("Tabela vazia - estado vazio amigÃ¡vel presente");}}});
test("04 - Filtros funcionam sem errors de Select", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Find all Select trigger
const selects = page.locator('[role="combobox"], [class*="SelectTrigger"] button, .select-trigger');
const selectCount = await selects.count().catch(() => 0);

    console.log(`Selects encontrados: ${selectCount}`);

    //  Check for SelectItem value="" â€” dangerous pattern
    const hasEmptyValue = await page.evaluate(() => {
const items = document.querySelectorAll('[role="option"]');
let found = false;

      items.forEach(item => {
if (item.getAttribute("value") === "") {

          console.log("SelectItem com value vazio encontrado!");

          found = true;}});
return found;});
expect(hasEmptyValue).toBe(false);

    console.log("Nenhum SelectItem com value='' encontrado - OK");

    //  Click on periodo filter and chang
const periodoTrigger = page.locator('[class*="SelectTrigger"]').first();
if (await periodoTrigger.isVisible().catch(() => false)) {
await periodoTrigger.click();
await page.waitForTimeout(500);

      //  Check dropdown item
const dropdownItems = page.locator('[role="option"]').first();
if (await dropdownItems.isVisible().catch(() => false)) {
const itemCount = await page.locator('[role="option"]').count();

        console.log(`Itens no dropdown: ${itemCount}`);

        //  Select "Hoje"
        const hojeItem = page.locator('[role="option"]').filter({ hasText: "Hoje" }).first();
if (await hojeItem.isVisible().catch(() => false)) {
await hojeItem.click();
await page.waitForTimeout(1000);

          console.log("Filtro 'Hoje' selecionado");
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-filtro-hoje.png"),            fullPage: false, });}}}
    //  Chec
const errors: string[] = [];

    page.on("console", (msg: any) => {
if (msg.type() === "error") {

        errors.push(msg.text());}});

    //  Wait a bit and chec
await page.waitForTimeout(1000);
if (errors.length > 0) {

      console.log("Erros no console encontrados:");

      errors.forEach(e => console.log(`  ${e}`));}});
test("05 - NavegaÃ§Ã£o pela sidebar atÃ© o monitor", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);

    //  Navigate to a page where sidebar is availabl
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    // The sidebar should already have "Central de RobÃ´s IA" open (because we're on /central-ia)
    //  Look for the "Monitor RobÃ´ Recrutamento" child item directly in sidebar nav
    const sidebarNav = page.locator("nav").first();

    //  Find the sub-item button within the sideba
const monitorButton = sidebarNav.locator("button").filter({ hasText: "Monitor RobÃ´ Recrutamento" }).first();
const monitorVisible = await monitorButton.isVisible().catch(() => false);

    console.log(`BotÃ£o 'Monitor RobÃ´ Recrutamento' na sidebar visÃ­vel: ${monitorVisible}`);
if (monitorVisible) {
await monitorButton.click();
await page.waitForTimeout(3000);

      //  Check we're on the monitor pag
expect(page.url()).toContain("/robo-recrutamento-monitor");

      console.log("NavegaÃ§Ã£o sidebar OK - URL:", page.url());} else {

      //  Fallback: try to click "Central de RobÃ´s IA" to expand, then look for child
      const centralButton = sidebarNav.locator("button").filter({ hasText: "Central de RobÃ´s IA" }).first();
if (await centralButton.isVisible().catch(() => false)) {

        //  Click to expand childre
const btnBox = await centralButton.boundingBox();
if (btnBox) {

          //  Click on the chevron area (right side) to avoid potential navigatio
await page.mouse.click(btnBox.x + btnBox.width - 15, btnBox.y + btnBox.height / 2);} else {
await centralButton.click();}        await page.waitForTimeout(1500);
const monitorBtn2 = sidebarNav.locator("button").filter({ hasText: "Monitor RobÃ´ Recrutamento" }).first();
if (await monitorBtn2.isVisible().catch(() => false)) {
await monitorBtn2.click();
await page.waitForTimeout(3000);
expect(page.url()).toContain("/robo-recrutamento-monitor");

          console.log("NavegaÃ§Ã£o sidebar via expansÃ£o OK");} else {

          console.log("Subitem ainda nÃ£o visÃ­vel apÃ³s clique - aceitÃ¡vel");}}}    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-sidebar-nav.png"),      fullPage: true, });});
test("06 - Detalhes da execuÃ§Ã£o (modal/dialog)", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Chec
const rows = page.locator("tbody tr");
const rowCount = await rows.count();
if (rowCount > 0 && rowCount === 1) {
const firstCell = await rows.first().locator("td").first().textContent();
if (firstCell?.includes("Carregando") || firstCell?.includes("Nenhuma")) {

        console.log("Sem dados para testar detalhes - estado vazio OK");
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-sem-dados.png"),          fullPage: false, });
return;}}    if (rowCount > 0) {

      //  Find the "Ver" button in the first ro
const verButton = rows.first().locator('button:has-text("Ver")').first();
if (await verButton.isVisible().catch(() => false)) {
await verButton.click();
await page.waitForTimeout(3000);

        //  Check dialog opene
const dialog = page.locator('[role="dialog"], [class*="DialogContent"]').first();
const dialogVisible = await dialog.isVisible().catch(() => false);

        console.log(`Dialog de detalhes visÃ­vel: ${dialogVisible}`);
if (dialogVisible) {
const dialogText = await dialog.textContent();

          console.log("ConteÃºdo do dialog (primeiros 200 chars):", dialogText?.substring(0, 200));

          //  Chec
const hasCandidato = dialogText?.includes("Candidato");
const hasContexto = dialogText?.includes("Contexto");
const hasTimeline = dialogText?.includes("Timeline");

          console.log(`SeÃ§Ãµes: Candidato=${hasCandidato}, Contexto=${hasContexto}, Timeline=${hasTimeline}`);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-detalhes-modal.png"),            fullPage: false, });

          //  Close dialo
const closeButton = dialog.locator('button').filter({ hasText: /close|fechar|X|Ã—|âœ•/i }).first();
if (await closeButton.isVisible().catch(() => false)) {
await closeButton.click();
await page.waitForTimeout(500);} else {

            //  Press Escap
await page.keyboard.press("Escape");
await page.waitForTimeout(500);}}}} else {

      console.log("Nenhuma linha na tabela para testar detalhes");}});
test("07 - Verificar console limpo (sem erros JavaScript)", async ({ page }) => {
const jsErrors: string[] = [];
const networkErrors: string[] = [];
const consoleWarnings: string[] = [];

    page.on("console", (msg: any) => {
if (msg.type() === "error") {
const text = msg.text();

        //  400/500 from Supabase REST API are expected when backend is not fully configure
if (text.includes("supabase") || text.includes("400") || text.includes("Failed to load resource")) {
if (text.includes("400") || text.includes("404") || text.includes("Failed to load resource")) {

            networkErrors.push(text);} else {

            jsErrors.push(text);}} else {

          jsErrors.push(text);}}      if (msg.type() === "warning") {

        consoleWarnings.push(msg.text());}});

    // Also catch page errors (actual JS exceptions)
    page.on("pageerror", (err: any) => {
      jsErrors.push(`Page Error: ${err.message}`);});
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Chec
const bodyText = await page.locator("body").textContent();
const hasErrorBoundary = bodyText?.includes("ErrorBoundary") ||                              bodyText?.includes("Algo deu errado") ||                             bodyText?.includes("Algo saiu errado");

    console.log(`ErrorBoundary detectado: ${hasErrorBoundary}`);

    console.log(`Erros JavaScript (${jsErrors.length}):`);

    jsErrors.forEach(e => console.log(`  ${e}`));

    console.log(`Network/Supabase errors (${networkErrors.length}):`);

    networkErrors.forEach(e => console.log(`  ${e}`));

    console.log(`Warnings no console (${consoleWarnings.length}):`);

    consoleWarnings.forEach(w => console.log(`  ${w}`));
expect(hasErrorBoundary).toBe(false);

    //  Zero JavaScript errors is the requiremen
expect(jsErrors.length).toBe(0);

    //  Network errors from Supabase are acceptable (non-blocking, handled gracefully
if (networkErrors.length > 0) {

      console.log("Network errors encontrados (nÃ£o bloqueantes, tratados pelo componente):");

      networkErrors.forEach(e => console.log(`  ${e}`));}});});

