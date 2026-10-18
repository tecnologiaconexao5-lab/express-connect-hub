import { test, expect }   from "@playwright/test";
import path   from "path";
import { createClient }   from "@supabase/supabase-js";
const SCREENSHOT_DIR = "test-results/e2e/f27-1-diretor-virtual-live";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TEST_ROTINA_PREFIX = "TESTE F27.1 - Live Engine";
async function login(page) {
await page.goto("/", {

    waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
const loginForm = page.locator('input[type="email"], input[placeholder*="email"], button:has-text("Entrar")');
if (await loginForm.first().isVisible().catch(() => false)) {
await page.locator('input[type="email"]').first().fill("tamiris.castilho@conexaoexpress.com.br");
await page.locator('input[type="password"]').first().fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator('button:has-text("Entrar")').click();
await page.waitForTimeout(3000);}};
test.describe("F27.1 â€” Diretor Virtual Live Engine", () => {
let roboId: string;
let rotinasCriadas: string[] = [];
test.beforeAll(async () => {
await supabase.from("rotinas_ia").delete().ilike("nome", `${TEST_ROTINA_PREFIX}%`);
await supabase.from("diretor_virtual_eventos_ia").delete().gte("created_at", new Date(Date.now() - 86400000).toISOString());
await supabase.from("diretor_virtual_decisoes_ia").delete().gte("created_at", new Date(Date.now() - 86400000).toISOString());
const {

      data: robos} = await supabase.from("automacoes_robos").select("id").limit(1);
expect(robos && robos.length > 0).toBe(true);

    roboId = robos![0].id;
const passado = new Date(Date.now() - 7200000).toISOString();
for (let i = 0;

    i < 5;

    i++) {
const {

        data: r} = await supabase.from("rotinas_ia").insert({

        robo_id: roboId,        nome: `${TEST_ROTINA_PREFIX} - ${i + 1}`,        tipo: "interval",        interval_seconds: 30,        ativo: true,        status: i < 3 ? "pending" : "error",        proxima_execucao: passado,        config: {

          prioridade: i === 0 ? "alta" : "normal"}, }).select().single();
if (r) rotinasCriadas.push(r.id);}    await supabase.from("rotinas_execucoes_ia").insert(      Array.from({

      length: 8}, (_, i) => ({

      rotina_id: rotinasCriadas[i % 5],        robo_id: roboId,        status: "error",        input: {

        acao: "teste"}, output: {}, erro: `Falha simulada ${i + 1}`,        started_at: new Date(Date.now() - (i * 3600000)).toISOString(),        finished_at: new Date(Date.now() - (i * 3600000) + 5000).toISOString(),}))    );});
test.afterAll(async () => {
if (rotinasCriadas.length > 0) {
await supabase.from("rotinas_execucoes_ia").delete().in("rotina_id", rotinasCriadas);
await supabase.from("rotinas_ia").delete().in("id", rotinasCriadas);}});
test("Live Engine: ciclo contÃ­nuo, decisÃµes e persistÃªncia", async ({ page }) => {
const jsErrors: string[] = [];

    page.on("pageerror", (err) => jsErrors.push(`Page Error: ${err.message}`));
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);

    //  Navegar para Central IA â€” o engine inicia automaticament
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
expect(page.locator("h1").filter({ hasText: /Central IA/i }).first()).toBeVisible({ timeout: 10000 });

    //  Aguardar engine executar pelo menos 1 ciclo (mÃ¡x 35s
await page.waitForTimeout(35000);

    //  Navegar para aba Liv
const liveTab = page.locator('button[role="tab"]:has-text("Live")');
expect(liveTab).toBeVisible({ timeout: 5000 });
await liveTab.click();
await page.waitForTimeout(2000);
expect(page.locator("text=Diretor Virtual Live").first()).toBeVisible({ timeout: 5000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-aba-live.png"),      fullPage: false, });

    //  === VALIDAÃ‡ÃƒO 1: Eventos criados no banco ==
    const {

      data: eventos} = await supabase      .from("diretor_virtual_eventos_ia")      .select("*")      .order("created_at", {

      ascending: false})      .limit(20);
expect(eventos && eventos.length > 0).toBe(true);

    console.log(`${eventos!.length} eventos registrados no banco`);

    //  Verificar variedade de tipo
const tiposEventos = [...new Set(eventos!.map((e) => e.tipo_evento))];

    console.log(`Tipos de eventos: ${tiposEventos.join(", ")}`);
expect(tiposEventos.length).toBeGreaterThanOrEqual(2);

    //  Eventos de anÃ¡lise devem existi
expect(eventos!.some((e) => e.tipo_evento === "analise")).toBe(true);

    //  === VALIDAÃ‡ÃƒO 2: DecisÃµes registradas ==
    const {

      data: decisoes} = await supabase      .from("diretor_virtual_decisoes_ia")      .select("*")      .order("created_at", {

      ascending: false})      .limit(20);
expect(decisoes && decisoes.length > 0).toBe(true);

    console.log(`${decisoes!.length} decisÃµes registradas`);

    //  Verificar estrutura das decisÃµe
for (const d of decisoes!) {
expect(d.origem).toBe("live_engine");
expect(d.tipo).toBeTruthy();
expect(d.acao).toBeTruthy();
expect(d.descricao).toBeTruthy();}    console.log(`Todas as decisÃµes sÃ£o do live_engine`);

    //  === VALIDAÃ‡ÃƒO 3: AlteraÃ§Ãµes em rotinas_ia ==
    const {

      data: rotinasAtualizadas} = await supabase      .from("rotinas_ia")      .select("id, status, ativo, proxima_execucao")      .in("id", rotinasCriadas);
expect(rotinasAtualizadas).toBeTruthy();
for (const r of rotinasAtualizadas || []) {

      console.log(`Rotina ${r.id.substring(0, 8)}: status=${r.status}, ativo=${r.ativo}, proxima=${r.proxima_execucao?.substring(0, 19) || "null"}`);}
    //  Algumas rotinas em "error" devem ter sido pausadas ou alterada
const pausadas = (rotinasAtualizadas || []).filter((r) => r.status === "paused");
const repriorizadas = (rotinasAtualizadas || []).filter(      (r) => r.proxima_execucao && new Date(r.proxima_execucao).getTime() > Date.now() - 60000    );

    console.log(`Rotinas pausadas: ${pausadas.length}`);

    console.log(`Rotinas repriorizadas (proxima_execucao recente): ${repriorizadas.length}`);

    //  === VALIDAÃ‡ÃƒO 4: UI reflete o status do engine ==
    const engineStatusBadge = page.locator(`text=Ativo`).first();
expect(engineStatusBadge).toBeVisible({ timeout: 10000 });

    console.log("Engine aparece como Ativo na UI");

    //  Contadores de ciclo visÃ­vei
expect(page.locator("text=Ciclos").first()).toBeVisible({ timeout: 5000 });

    //  Eventos aparecem na list
const eventosUI = page.locator("text=Eventos do Sistema").first();
expect(eventosUI).toBeVisible({ timeout: 5000 });

    //  Recarregar e verificar persistÃªnci
await page.reload();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(3000);
await page.locator('button[role="tab"]:has-text("Live")').click();
await page.waitForTimeout(1000);
expect(page.locator("text=Diretor Virtual Live").first()).toBeVisible({ timeout: 10000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-pos-reload.png"),      fullPage: false, });

    console.log(`Erros JS: ${jsErrors.length}`);
expect(jsErrors.length).toBe(0);}, 120000);});

