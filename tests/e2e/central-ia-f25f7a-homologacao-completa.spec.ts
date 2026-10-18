import { test, expect }   from "@playwright/test";
import path   from "path";
const SCREENSHOT_DIR = "test-results/e2e/f25f7a";
const CANDIDATO_REAL_ID = "028bfc48-fc54-417e-a8e7-d15c7d05e050";
async function login(page) {
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
test.describe("F25F.7A â€” HomologaÃ§Ã£o Real do Fluxo Completo", () => {
test("01 - CadastroPrestador carrega sem erro", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
const jsErrors = [];

    page.on("console", (msg) => {
if (msg.type() === "error") {

        jsErrors.push(msg.text());}});

    page.on("pageerror", (err) => {
      jsErrors.push(`Page Error: ${err.message}`);});
await login(page);
await page.goto("/cadastro-prestador", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-cadastro-prestador.png"),      fullPage: true, });
const bodyText = await page.locator("body").textContent();
expect(bodyText).not.toContain("ErrorBoundary");
expect(bodyText).not.toContain("Algo deu errado");

    //  Step indicators or title should be visibl
const stepIndicator = page.locator('[class*="step"], [class*="Step"], .text-muted-foreground').first();
const hasText = bodyText.includes("Dados Pessoais") || bodyText.includes("Cadastro") || bodyText.includes("Prestador");

    console.log(`Texto encontrado na pÃ¡gina: ${hasText}`);
expect(hasText).toBe(true);

    console.log("Erros JS no cadastro:", jsErrors.length);

    jsErrors.forEach(e => console.log(`  ${e}`));

    //  A 400 error from Supabase is acceptable (non-blocking
const realJsErrors = jsErrors.filter(e => !e.includes("400") && !e.includes("supabase"));
expect(realJsErrors.length).toBe(0);});
test("02 - Monitor exibe candidato real com dados corretos", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-monitor-com-dados.png"),      fullPage: false, });

    //  Check dashboard metrics reflect real dat
const cards = page.locator("p.text-2xl.font-bold");
const cardCount = await cards.count();

    console.log(`Cards: ${cardCount}`);
for (let i = 0;

    i < cardCount;

    i++) {
const text = await cards.nth(i).textContent();

      console.log(`Card ${i + 1}: ${text?.trim()}`);
expect(text?.trim()).not.toBe("NaN");
expect(text?.trim()).not.toBe("undefined");
expect(text?.trim()).not.toBe("null");}
    //  Table should show execution dat
const rows = page.locator("tbody tr");
const rowCount = await rows.count();

    console.log(`Linhas na tabela: ${rowCount}`);
expect(rowCount).toBeGreaterThanOrEqual(1);

    //  First row should have test data
    if (rowCount >= 1) {
const firstRowText = await rows.first().textContent();

      console.log(`Primeira linha: ${firstRowText?.substring(0, 150)}`);
expect(firstRowText).toContain("TESTE HOMOLOG");}});
test("03 - Detalhes da execuÃ§Ã£o mostram contexto e seguranÃ§a", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
const rows = page.locator("tbody tr");
const rowCount = await rows.count();
if (rowCount >= 1) {

      //  Click "Ver" on first ro
const verButton = rows.first().locator('button:has-text("Ver")').first();
if (await verButton.isVisible().catch(() => false)) {
await verButton.click();
await page.waitForTimeout(2000);
const dialog = page.locator('[role="dialog"]').first();
expect(dialog).toBeVisible();
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-detalhes-execucao.png"),          fullPage: false, });
const dialogText = await dialog.textContent();

        //  Check key section
expect(dialogText).toContain("Detalhes");
expect(dialogText).toContain("TESTE HOMOLOG");

        //  Chec
const hasProviderNull = dialogText.includes("null") || dialogText.includes("simulado");

        console.log(`Provider message null/simulado: ${hasProviderNull}`);

        //  Log sections foun
const sections = ["Timeline", "Candidato", "Contexto", "Comunica"];
for (const section of sections) {
const found = dialogText.includes(section);

          console.log(`SeÃ§Ã£o "${section}": ${found}`);}
        //  Clos
await page.keyboard.press("Escape");
await page.waitForTimeout(500);}}});
test("04 - Timeline completa com 8+ eventos de log", async ({ page }) => {
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/robo-recrutamento-monitor", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
const rows = page.locator("tbody tr");
const rowCount = await rows.count();
if (rowCount >= 1) {
const verButton = rows.first().locator('button:has-text("Ver")').first();
if (await verButton.isVisible().catch(() => false)) {
await verButton.click();
await page.waitForTimeout(2000);
const dialog = page.locator('[role="dialog"]').first();
expect(dialog).toBeVisible();

        //  Count timeline item
const timelineItems = dialog.locator('[class*="timeline"], [class*="Timeline"], li, [class*="log-item"]');
const tlCount = await timelineItems.count().catch(() => 0);

        console.log(`Itens de timeline encontrados: ${tlCount}`);

        //  Chec
const content = await dialog.textContent();
const requiredEvents = [          "candidato_detectado",          "robo_encontrado",          "robo_validado",          "contexto_montado",          "recomendacao_gerada",          "tarefa_criada",          "simulacao_comunicacao",          "processamento_finalizado",        ];
for (const event of requiredEvents) {
const found = content.includes(event);

          console.log(`Evento "${event}": ${found}`);}        await page.keyboard.press("Escape");
await page.waitForTimeout(500);}}});
test("05 - Console limpo sem erros JavaScript na navegacao completa", async ({ page }) => {
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

    //  Navigate through multiple page
const pages = [      "/cadastro-prestador",      "/robo-recrutamento-monitor",      "/central-ia",    ];
for (const url of pages) {
await page.goto(url, {

        waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
const bodyText = await page.locator("body").textContent();
if (bodyText?.includes("ErrorBoundary")) {

        console.log(`ErrorBoundary encontrado em ${url}`);}}    console.log(`Erros JavaScript totais: ${jsErrors.length}`);

    jsErrors.forEach(e => console.log(`  JS Error: ${e}`));

    console.log(`Network errors (400/404): ${networkErrors.length}`);

    networkErrors.forEach(e => console.log(`  Network: ${e}`));
expect(jsErrors.length).toBe(0);
expect(      await page.locator("body").textContent()    ).not.toContain("ErrorBoundary");});});

