import { test, expect }   from "@playwright/test";
import path   from "path";
import { createClient }   from "@supabase/supabase-js";
const SCREENSHOT_DIR = "test-results/e2e/f27-diretor-virtual";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TEST_ROTINA_PREFIX = "TESTE F27 - Lead prioritÃ¡rio";
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
test.describe("F27 â€” Diretor Virtual IA", () => {
test.beforeEach(async () => {
await supabase.from("rotinas_ia").delete().ilike("nome", `${TEST_ROTINA_PREFIX}%`);
await supabase.from("diretor_virtual_decisoes_ia").delete().gte("created_at", new Date(Date.now() - 86400000).toISOString());});
test("Fluxo completo: criar rotinas, forÃ§ar anÃ¡lise, validar decisÃµes e persistÃªncia", async ({ page }) => {
const jsErrors: string[] = [];

    page.on("pageerror", (err) => jsErrors.push(`Page Error: ${err.message}`));
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);

    //  === CRIAR ROTINAS DE TESTE VIA SUPABASE (para gerar mÃ©tricas) ==
    const {

      data: robos} = await supabase.from("automacoes_robos").select("id").limit(1);
expect(robos && robos.length > 0).toBe(true);
const roboId = robos![0].id;

    //  Criar mÃºltiplas rotinas com status atrasado para forÃ§ar decisÃµes
    const rotinasCriadas: string[] = [];
const passado = new Date(Date.now() - 3600000).toISOString();
for (let i = 0;

    i < 5;

    i++) {
const {

        data: r} = await supabase.from("rotinas_ia").insert({ robo_id: roboId,        nome: `${TEST_ROTINA_PREFIX} ${i + 1}`,        tipo: "interval",        interval_seconds: 30,        ativo: true,        status: "pending",        proxima_execucao: passado, }).select().single();
if (r) rotinasCriadas.push(r.id);}    console.log(`${rotinasCriadas.length} rotinas de teste criadas`);

    //  === NAVEGAR PARA CENTRAL IA ==
    await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
expect(page.locator("h1").filter({ hasText: /Central IA/i }).first()).toBeVisible({ timeout: 10000 });

    //  === ABRIR ABA DIRETOR VIRTUAL ==
    const diretorTab = page.locator('button[role="tab"]:has-text("Diretor Virtual")');
expect(diretorTab).toBeVisible({ timeout: 10000 });
await diretorTab.click();
await page.waitForTimeout(1000);

    //  Verificar que a aba abri
expect(page.locator("text=Diretor Virtual IA").first()).toBeVisible({ timeout: 10000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-aba-diretor.png"),      fullPage: false, });

    //  Verificar modo de operaÃ§Ã£
const modoSelect = page.locator('[role="combobox"]').first();
expect(modoSelect).toBeVisible({ timeout: 5000 });

    console.log("Modo de operaÃ§Ã£o visÃ­vel");

    //  === FORÃ‡AR CICLO DE ANÃLISE ==
    const forcarCicloBtn = page.locator('button:has-text("ForÃ§ar Ciclo")');
expect(forcarCicloBtn).toBeVisible({ timeout: 5000 });

    //  Aguardar o worker inicia
await page.waitForTimeout(2000);

    //  ForÃ§ar ciclo de anÃ¡lise manualment
await forcarCicloBtn.click();
await page.waitForTimeout(3000);

    //  Verificar notificaÃ§Ã£o de sucess
const toastMsg = page.locator("text=Ciclo:").first();
const temToast = await toastMsg.isVisible().catch(() => false);

    console.log(`Toast de ciclo visÃ­vel: ${temToast}`);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-apos-ciclo.png"),      fullPage: false, });

    //  === VALIDAR DECISÃ•ES NO BANCO ==
    const {

      data: decisoes} = await supabase      .from("diretor_virtual_decisoes_ia")      .select("*")      .order("created_at", {

      ascending: false})      .limit(10);
expect(decisoes && decisoes.length > 0).toBe(true);

    console.log(`${decisoes!.length} decisÃµes registradas no banco`);
const primeiraDecisao = decisoes![0];

    console.log(`Tipo: ${primeiraDecisao.tipo}, Impacto: ${primeiraDecisao.impacto}, AÃ§Ã£o: ${primeiraDecisao.acao}`);

    console.log(`DescriÃ§Ã£o: ${primeiraDecisao.descricao}`);

    console.log(`Status: ${primeiraDecisao.status}, Executado: ${primeiraDecisao.executado}`);
expect(primeiraDecisao.origem).toBe("system");
expect(primeiraDecisao.tipo).toBeTruthy();
expect(primeiraDecisao.acao).toBeTruthy();
expect(primeiraDecisao.descricao).toBeTruthy();

    //  Validar que foi persistido com dados completo
expect(primeiraDecisao.id).toBeTruthy();
expect(primeiraDecisao.created_at).toBeTruthy();

    //  === VALIDAR MÃ‰TRICAS NO BANCO ==
    const {

      data: metricas} = await supabase      .from("diretor_virtual_metricas_ia")      .select("*")      .order("risco_score", {

      ascending: false});
expect(metricas && metricas.length > 0).toBe(true);

    console.log(`${metricas!.length} mÃ©tricas registradas no banco`);
const primeiraMetrica = metricas![0];

    console.log(`RobÃ´: ${primeiraMetrica.robo_id}`);

    console.log(`Rotinas ativas: ${primeiraMetrica.rotinas_ativas}`);

    console.log(`Rotinas atrasadas: ${primeiraMetrica.rotinas_atrasadas}`);

    console.log(`Carga: ${primeiraMetrica.carga_percentual}%`);

    console.log(`Risco: ${primeiraMetrica.risco_score}`);
expect(primeiraMetrica.robo_id).toBeTruthy();
expect(primeiraMetrica.updated_at).toBeTruthy();

    //  === VALIDAR QUE DECISÃ•ES APARECEM NA UI ==
    await page.waitForTimeout(1000);

    //  Recarregar pÃ¡gina e verificar se dados persiste
await page.reload();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(2000);

    //  Navegar de volta para Diretor Virtua
await page.locator('button[role="tab"]:has-text("Diretor Virtual")').click();
await page.waitForTimeout(1000);

    //  Verificar se o histÃ³rico de decisÃµes aparec
const historico = page.locator("text=HistÃ³rico de DecisÃµes").first();
expect(historico).toBeVisible({ timeout: 10000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-pos-reload.png"),      fullPage: false, });

    //  Validar que as mÃ©tricas tambÃ©m carregara
const metricasLabel = page.locator("text=MÃ©tricas por RobÃ´").first();
expect(metricasLabel).toBeVisible({ timeout: 5000 });

    console.log("Dados persistiram apÃ³s reload");

    //  === VALIDAR AÃ‡Ã•ES DO DIRETOR NAS ROTINAS ===    // Verificar se alguma decisÃ£o de "repriorizar" foi executada ajustando proxima_execuca
const decisoesRepriorizar = decisoes!.filter((d) => d.acao === "repriorizar" && d.executado);

    console.log(`DecisÃµes de repriorizar executadas: ${decisoesRepriorizar.length}`);

    //  Verificar se rotinas tiveram proxima_execucao atualizad
const {

      data: rotinasAtualizadas} = await supabase      .from("rotinas_ia")      .select("id, status, proxima_execucao")      .in("id", rotinasCriadas);
if (rotinasAtualizadas) {
for (const r of rotinasAtualizadas) {

        console.log(`Rotina ${r.id.substring(0, 8)}: status=${r.status}, proxima=${r.proxima_execucao?.substring(0, 19)}`);}}
    //  === LIMPEZA ==
    await supabase.from("rotinas_ia").delete().in("id", rotinasCriadas);

    // === VALIDAÃ‡ÃƒO FINAL: SEM ERROS JS ===    console.log(`Erros JS: ${jsErrors.length}`);
expect(jsErrors.length).toBe(0);});});

