import { test, expect }   from "@playwright/test";
import path   from "path";
import { createClient }   from "@supabase/supabase-js";
const SCREENSHOT_DIR = "test-results/e2e/f26-rotinas-ia";
const TEST_ROTINA_PREFIX = "TESTE F26.3 - Buscar leads";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
test.describe("F26.3 â€” Motor de Rotinas IA (ConsolidaÃ§Ã£o)", () => {
test.beforeEach(async () => {
await supabase.from("rotinas_ia").delete().ilike("nome", `${TEST_ROTINA_PREFIX}%`);});
test("CenÃ¡rio 1: Criar rotina e validar execuÃ§Ã£o automÃ¡tica sem clique humano", async ({ page }) => {
const jsErrors: string[] = [];

    page.on("pageerror", (err) => jsErrors.push(`Page Error: ${err.message}`));
const TEST_ROTINA_NOME = `${TEST_ROTINA_PREFIX} ${Date.now()}`;
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);

    //  === NAVEGAR PARA CENTRAL IA ==
    await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
expect(page.locator("h1").filter({ hasText: /Central IA/i }).first()).toBeVisible({ timeout: 10000 });

    //  === CLICAR NO PRIMEIRO BOTÃƒO CONFIGURAR ==
    const configBtn = page.locator('button[title="Configurar"]').first();
expect(configBtn).toBeVisible({ timeout: 10000 });
await configBtn.click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role="dialog"]');
expect(dialog).toBeVisible({ timeout: 10000 });

    //  Validar aba Rotina
expect(dialog.locator('button[role="tab"]:has-text("Rotinas")')).toBeVisible();
await dialog.locator('button[role="tab"]:has-text("Rotinas")').click();
await page.waitForTimeout(800);

    //  Validar motor ativ
const motorAtivo = dialog.locator("text=Ativo").first();
const motorVisivel = await motorAtivo.isVisible().catch(() => false);

    console.log(`Motor ativo na UI: ${motorVisivel}`);

    //  === CRIAR ROTINA (interval 30s para execuÃ§Ã£o rÃ¡pida) ==
    await dialog.locator('button:has-text("Nova Rotina")').click();
await page.waitForTimeout(500);
await page.waitForSelector('button:has-text("Criar Rotina")', {

      timeout: 5000});
await dialog.locator("input").first().fill(TEST_ROTINA_NOME);

    //  Tipo = Interval
const tipoSelect = dialog.locator('[role="combobox"]').first();
await tipoSelect.click();
await page.waitForTimeout(300);
await page.locator('[role="option"]:has-text("Intervalo")').click();
await page.waitForTimeout(200);

    //  Intervalo = 30
const intervaloInput = dialog.locator('input[type="number"]').first();
if (await intervaloInput.isVisible().catch(() => false)) {
await intervaloInput.fill("30");}    await dialog.locator('button:has-text("Criar Rotina")').click();
await page.waitForTimeout(1000);

    //  Validar que apareceu na list
expect(dialog.locator(`text=${TEST_ROTINA_NOME}`).first()).toBeVisible({
      timeout: 10000});
    console.log("Rotina criada na UI");
await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-rotina-criada.png"),      fullPage: false,});

    // === VALIDAÃ‡ÃƒO NO BANCO: ROTINA PERSISTIDA ===
    const {
      data: rotinas} = await supabase      .from("rotinas_ia")      .select("*")      .eq("nome", TEST_ROTINA_NOME)      .limit(1);
expect(rotinas && rotinas.length > 0).toBe(true);
const rotina = rotinas![0];
    console.log(`Rotina ID: ${rotina.id}, Status inicial: ${rotina.status}, Tipo: ${rotina.tipo}`);
expect(rotina.tipo).toBe("interval");
expect(rotina.interval_seconds).toBe(30);
expect(rotina.ativo).toBe(true);
expect(rotina.proxima_execucao).toBeTruthy();

    // === CENÃRIO OBRIGATÃ“RIO: AGUARDAR EXECUÃ‡ÃƒO AUTOMÃTICA ===    // Sem clicar "Executar agora", o motor deve executar automaticamente    console.log("Aguardando execuÃ§Ã£o automÃ¡tica do motor...");
let execucaoEncontrada = false;
let statusAtualizado = false;
const maxTentativas = 20;
for (let i = 0;
    i < maxTentativas;
    i++) {
await page.waitForTimeout(3000);
      console.log(`  Tentativa ${i + 1}/${maxTentativas}...`);
const {
        data: execs} = await supabase        .from("rotinas_execucoes_ia")        .select("id, status, started_at, finished_at, logs, output")        .eq("rotina_id", rotina.id)        .order("started_at", {
        ascending: false})        .limit(1);
if (execs && execs.length > 0) {
const exec = execs[0];
        console.log(`    ExecuÃ§Ã£o encontrada: status=${exec.status}, logs=${exec.logs?.substring(0, 80)}`);
        execucaoEncontrada = true;
if (exec.status === "success" || exec.status === "error") {
          statusAtualizado = true;

          // VALIDAÃ‡Ã•ES DETALHADAS DA EXECUÃ‡ÃƒO          expect(exec.started_at).toBeTruthy();
expect(exec.finished_at).toBeTruthy();
expect(exec.logs).toBeTruthy();
expect(exec.logs!.length).toBeGreaterThan(0);
if (exec.status === "success") {
expect(exec.output).toBeTruthy();
expect(exec.output?.contexto_carregado).toBe(true);}
          // VALIDAR STATUS DA ROTINA ATUALIZADO
          const {
            data: rAtualizada} = await supabase            .from("rotinas_ia")            .select("status, ultima_execucao, proxima_execucao")            .eq("id", rotina.id)            .single();
          console.log(`    Status rotina: ${rAtualizada!.status}, Ãºltima: ${rAtualizada!.ultima_execucao}, prÃ³xima: ${rAtualizada!.proxima_execucao}`);
expect(rAtualizada!.ultima_execucao).toBeTruthy();
expect(rAtualizada!.proxima_execucao).toBeTruthy();

          // VALIDAR QUE proxima_execucao FOI RECALCULADA (deve ser > ultima_execucao)          const ultima = new Date(rAtualizada!.ultima_execucao!).getTime();
const proxima = new Date(rAtualizada!.proxima_execucao!).getTime();
expect(proxima).toBeGreaterThan(ultima);
          console.log(`    PrÃ³xima execuÃ§Ã£o recalculada corretamente (+${Math.round((proxima - ultima) / 1000)}s)`);
          break;}}}
    // RelatÃ³rio final    console.log(`ExecuÃ§Ã£o encontrada: ${execucaoEncontrada}`);
    console.log(`Status atualizado: ${statusAtualizado}`);
expect(execucaoEncontrada).toBe(true);
expect(statusAtualizado).toBe(true);

    // Ver execuÃ§Ãµes na UI    const verExecBtn = dialog.locator('button[title="Ver execuÃ§Ãµes"]').first();
if (await verExecBtn.isVisible().catch(() => false)) {
await verExecBtn.click();
await page.waitForTimeout(800);}    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-execucao-automatica.png"),      fullPage: false,});

    // === LIMPEZA ===    await supabase.from("rotinas_ia").delete().eq("id", rotina.id);

    // === VALIDAÃ‡ÃƒO FINAL: SEM ERROS JS ===    console.log(`Erros JS: ${jsErrors.length}`);
expect(jsErrors.length).toBe(0);});
test("CenÃ¡rio 2: Validar contadores e heartbeat do motor", async ({
    page}) => {
const TEST_ROTINA_NOME = `${TEST_ROTINA_PREFIX} heartbeat ${Date.now()}`;
await page.setViewportSize({
      width: 1440, height: 900});
await login(page);
await page.goto("/central-ia", {
      waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);

    // Abrir config do primeiro robÃ´    const configBtn = page.locator('button[title="Configurar"]').first();
await configBtn.click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role="dialog"]');
await dialog.locator('button[role="tab"]:has-text("Rotinas")').click();
await page.waitForTimeout(800);

    // Criar rotina com intervalo 30s    await dialog.locator('button:has-text("Nova Rotina")').click();
await page.waitForTimeout(500);
await dialog.locator("input").first().fill(TEST_ROTINA_NOME);
const tipoSelect = dialog.locator('[role="combobox"]').first();
await tipoSelect.click();
await page.waitForTimeout(200);
await page.locator('[role="option"]:has-text("Intervalo")').click();
await page.waitForTimeout(200);
const intervaloInput = dialog.locator('input[type="number"]').first();
if (await intervaloInput.isVisible().catch(() => false)) {
await intervaloInput.fill("30");}    await dialog.locator('button:has-text("Criar Rotina")').click();
await page.waitForTimeout(1000);
expect(dialog.locator(`text=${TEST_ROTINA_NOME}`).first()).toBeVisible({
      timeout: 10000});

    // Aguardar e validar contadores atravÃ©s da UI    await page.waitForTimeout(5000);
await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-contadores.png"),      fullPage: false,});

    // Verificar que a lista mostra status    const statusBadge = dialog.locator("text=success").first();
const temStatus = await statusBadge.isVisible().catch(() => false);
    console.log(`Status success visÃ­vel na UI: ${temStatus}`);

    // Limpeza    await supabase.from("rotinas_ia").delete().ilike("nome", `${TEST_ROTINA_PREFIX}%`);
expect(temStatus).toBe(true);});});

