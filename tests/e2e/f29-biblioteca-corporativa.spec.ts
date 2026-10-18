import { test, expect }   from "@playwright/test";
import path   from "path";
import { createClient }   from "@supabase/supabase-js";
const SCREENSHOT_DIR = "test-results/e2e/f29-biblioteca-corporativa";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TEST_PREFIX = "TESTE F29 - Corporativo";
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
test.describe("F29 â€” Biblioteca Corporativa", () => {
let conhecimentoId: string;
let roboComercialId: string;
let roboFinanceiroId: string;
test.beforeAll(async () => {
await supabase.from("ia_conhecimento").delete().ilike("titulo", `${TEST_PREFIX}%`);
await supabase.from("ia_conhecimento_distribuicao").delete().gte("data_vinculo", new Date(Date.now() - 86400000).toISOString());
const {

      data: robos} = await supabase.from("automacoes_robos").select("id, nome, setor").limit(5);
expect(robos && robos.length >= 2).toBe(true);
const comercial = robos!.find((r) => r.setor === "Comercial");
const financeiro = robos!.find((r) => r.setor === "Financeiro");

    roboComercialId = comercial?.id || robos![0].id;

    roboFinanceiroId = financeiro?.id || robos![1].id;});
test("CenÃ¡rio completo: criar â†’ versionar â†’ vincular robÃ´s â†’ validar no banco â†’ UI", async ({ page }) => {
const jsErrors: string[] = [];

    page.on("pageerror", (err) => jsErrors.push(`Page Error: ${err.message}`));
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);

    //  === CENÃRIO 1: Criar conhecimento corporativo via Supabase ==
    const {

      data: conhecimento} = await supabase.from("ia_conhecimento").insert({ titulo: `${TEST_PREFIX} - Manual Comercial 2026`,      conteudo: "Manual oficial da equipe comercial da ConexÃ£o Express. Inclui polÃ­ticas de desconto, tabela de preÃ§os e procedimentos de negociaÃ§Ã£o.",      tipo_conhecimento: "procedimento",      categoria: "Comercial",      setor: "Comercial",      tags: ["manual", "comercial", "2026", "vendas"],      status: "ativo",      versao: 1,      robo_id: null,      validade_inicio: "2026-01-01",      validade_fim: "2026-12-31", }).select().single();
expect(conhecimento).toBeTruthy();

    conhecimentoId = conhecimento!.id;

    console.log(`Conhecimento criado: ${conhecimentoId}`);

    console.log(`Tipo: ${conhecimento!.tipo_conhecimento}, VersÃ£o: ${conhecimento!.versao}`);

    //  === VALIDAÃ‡ÃƒO 1: Conhecimento persistido com campos corretos ==
    const {

      data: conferencia} = await supabase      .from("ia_conhecimento")      .select("*")      .eq("id", conhecimentoId)      .single();
expect(conferencia!.titulo).toContain("Manual Comercial");
expect(conferencia!.tipo_conhecimento).toBe("procedimento");
expect(conferencia!.status).toBe("ativo");
expect(conferencia!.versao).toBe(1);
expect(conferencia!.robo_id).toBeNull();

    console.log("Conhecimento persistido com campos corretos (tipo_conhecimento, versao, status)");

    //  === CENÃRIO 2: Criar nova versÃ£o ==
    const {

      data: versao2} = await supabase.from("ia_conhecimento").insert({ titulo: `${TEST_PREFIX} - Manual Comercial 2026`,      conteudo: "VersÃ£o 2: AtualizaÃ§Ã£o das polÃ­ticas de desconto para 2026.2.",      tipo_conhecimento: "procedimento",      categoria: "Comercial",      setor: "Comercial",      tags: ["manual", "comercial", "2026", "vendas", "v2"],      status: "ativo",      versao: 2,      robo_id: null,      validade_inicio: "2026-06-01",      validade_fim: "2026-12-31", }).select().single();
expect(versao2).toBeTruthy();
expect(versao2!.versao).toBe(2);

    console.log(`Nova versÃ£o criada: v${versao2!.versao}`);

    //  === CENÃRIO 3: Vincular robÃ´s ==
    const vincular1 = await supabase.from("ia_conhecimento_distribuicao").insert({ conhecimento_id: conhecimentoId,      robo_id: roboComercialId,      obrigatorio: true,      prioridade: "alta", });
expect(vincular1.error).toBeFalsy();
const vincular2 = await supabase.from("ia_conhecimento_distribuicao").insert({ conhecimento_id: conhecimentoId,      robo_id: roboFinanceiroId,      obrigatorio: false,      prioridade: "normal", });
expect(vincular2.error).toBeFalsy();

    console.log("RobÃ´s vinculados ao conhecimento");

    //  === VALIDAÃ‡ÃƒO 2: DistribuiÃ§Ãµes registradas ==
    const {

      data: distribuicoes} = await supabase      .from("ia_conhecimento_distribuicao")      .select("*, automacoes_robos!inner(nome, setor)")      .eq("conhecimento_id", conhecimentoId)      .eq("ativo", true);
expect(distribuicoes && distribuicoes.length >= 2).toBe(true);

    console.log(`${distribuicoes!.length} distribuiÃ§Ãµes registradas`);

    //  === CENÃRIO 4: Upload de arquivo real ==
    const testPdfContent = JSON.stringify({ teste: true, timestamp: Date.now() });
const caminhoStorage = `corporativo/${conhecimentoId}/teste-f29-${Date.now()}.txt`;
const {

      error: uploadError} = await supabase.storage      .from("biblioteca-global")      .upload(caminhoStorage, new Blob([testPdfContent], {

      type: "text/plain"}), {

      cacheControl: "3600", upsert: false,});
expect(uploadError).toBeFalsy();

    console.log("Arquivo anexado ao conhecimento");
await supabase.from("treinamento_arquivos_ia").insert({ robo_id: roboComercialId,      conhecimento_id: conhecimentoId,      nome_original: "teste-f29.txt",      nome_armazenado: caminhoStorage.split("/").pop(),      tipo_arquivo: "texto",      mime_type: "text/plain",      tamanho_bytes: testPdfContent.length,      bucket: "biblioteca-global",      caminho_storage: caminhoStorage,      categoria: "corporativo",      tags: ["teste", "f29"],      versao: 1,      status: "ativo",      hash_arquivo: "teste-hash", });

    console.log("Registro de arquivo criado no banco");

    //  === CENÃRIO 5: Desvincular um robÃ´ ==
    const desvincular = await supabase      .from("ia_conhecimento_distribuicao")      .update({ ativo: false })      .eq("conhecimento_id", conhecimentoId)      .eq("robo_id", roboFinanceiroId);
expect(desvincular.error).toBeFalsy();

    console.log("RobÃ´ Financeiro desvinculado");
const {

      data: distribuicoesAtivas} = await supabase      .from("ia_conhecimento_distribuicao")      .select("*")      .eq("conhecimento_id", conhecimentoId)      .eq("ativo", true);
expect(distribuicoesAtivas!.length).toBe(1);
expect(distribuicoesAtivas![0].robo_id).toBe(roboComercialId);

    console.log("Apenas 1 distribuiÃ§Ã£o ativa restante");

    //  === CENÃRIO 6: Navegar na UI ==
    await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
expect(page.locator("h1").filter({ hasText: /Central IA/i }).first()).toBeVisible({ timeout: 10000 });

    //  Navegar para aba Biblioteca Corporativ
const bibliotecaTab = page.locator('button[role="tab"]:has-text("Biblioteca")');
expect(bibliotecaTab).toBeVisible({ timeout: 5000 });
await bibliotecaTab.click();
await page.waitForTimeout(2000);
expect(page.locator("text=Biblioteca Corporativa").first()).toBeVisible({ timeout: 5000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-aba-biblioteca.png"),      fullPage: false, });

    //  Verificar que o documento aparec
expect(page.locator("text=Manual Comercial 2026").first()).toBeVisible({ timeout: 5000 });

    console.log("Documento visÃ­vel na UI");

    //  Verificar badge de versÃ£
expect(page.locator("text=v1").first().or(page.locator("text=v2").first())).toBeVisible({ timeout: 5000 });

    //  Recarregar e verificar persistÃªnci
await page.reload();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(3000);
await page.locator('button[role="tab"]:has-text("Biblioteca")').click();
await page.waitForTimeout(1000);
expect(page.locator("text=Biblioteca Corporativa").first()).toBeVisible({ timeout: 10000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-pos-reload.png"),      fullPage: false, });

    //  === LIMPEZA ==
    await supabase.storage.from("biblioteca-global").remove([caminhoStorage]).catch(() => {});
await supabase.from("treinamento_arquivos_ia").delete().eq("conhecimento_id", conhecimentoId);
await supabase.from("ia_conhecimento_distribuicao").delete().eq("conhecimento_id", conhecimentoId);
await supabase.from("ia_conhecimento").delete().in("id", [conhecimentoId, versao2!.id]);

    console.log(`Erros JS: ${jsErrors.length}`);
expect(jsErrors.length).toBe(0);}, 120000);});

