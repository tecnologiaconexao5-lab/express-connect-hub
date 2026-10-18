import { test, expect }   from "@playwright/test";
import path   from "path";
import { createClient }   from "@supabase/supabase-js";
const SCREENSHOT_DIR = "test-results/e2e/f28-comunicacao-robos";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
test.describe("F28 â€” ComunicaÃ§Ã£o entre RobÃ´s", () => {
let roboComercialId: string;
let roboFinanceiroId: string;
test.beforeAll(async () => {
await supabase.from("ia_comunicacoes_robos").delete().gte("created_at", new Date(Date.now() - 86400000).toISOString());
await supabase.from("ia_comunicacoes_fila_robos").delete().gte("created_at", new Date(Date.now() - 86400000).toISOString());
const {

      data: robos} = await supabase.from("automacoes_robos").select("id, nome, setor").limit(5);
expect(robos && robos.length >= 2).toBe(true);
const comercial = robos!.find((r) => r.setor === "Comercial");
const financeiro = robos!.find((r) => r.setor === "Financeiro");

    roboComercialId = comercial?.id || robos![0].id;

    roboFinanceiroId = financeiro?.id || robos![1].id;

    console.log(`RobÃ´ Comercial: ${roboComercialId}`);

    console.log(`RobÃ´ Financeiro: ${roboFinanceiroId}`);});
test("Fluxo completo: solicitaÃ§Ã£o â†’ resposta â†’ escalonamento â†’ validaÃ§Ã£o no banco", async ({ page }) => {
const jsErrors: string[] = [];

    page.on("pageerror", (err) => jsErrors.push(`Page Error: ${err.message}`));
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);

    //  === CENÃRIO 1: Criar solicitaÃ§Ã£o do Comercial para o Financeiro ==
    const {

      data: solicitacao} = await supabase.from("ia_comunicacoes_robos").insert({

      origem_robo_id: roboComercialId,      destino_robo_id: roboFinanceiroId,      tipo: "solicitacao",      assunto: "SolicitaÃ§Ã£o de dados financeiros do cliente XPTO",      mensagem: "Preciso dos dados de faturamento e limite de crÃ©dito do cliente XPTO para liberaÃ§Ã£o de frete.",      contexto: {

        cliente: "XPTO", tipo_dado: "financeiro", urgencia: "alta"}, prioridade: "high",      status: "pendente",}).select().single();
expect(solicitacao).toBeTruthy();
const solicitacaoId = solicitacao!.id;

    console.log(`SolicitaÃ§Ã£o criada: ${solicitacaoId}`);

    //  Inserir na fil
await supabase.from("ia_comunicacoes_fila_robos").insert({

      robo_id: roboFinanceiroId,      tipo_evento: "comunicacao_solicitacao",      payload: {

        comunicacao_id: solicitacaoId, origem_id: roboComercialId}, });

    //  === VALIDAÃ‡ÃƒO 1: Mensagem persistida ==
    const {

      data: msgBanco} = await supabase      .from("ia_comunicacoes_robos")      .select("*")      .eq("id", solicitacaoId)      .single();
expect(msgBanco).toBeTruthy();
expect(msgBanco!.origem_robo_id).toBe(roboComercialId);
expect(msgBanco!.destino_robo_id).toBe(roboFinanceiroId);
expect(msgBanco!.tipo).toBe("solicitacao");
expect(msgBanco!.assunto).toContain("XPTO");
expect(msgBanco!.status).toBe("pendente");

    console.log("Mensagem persistida com campos corretos");

    //  === CENÃRIO 2: Responder Ã  solicitaÃ§Ã£o ==
    const resposta = await supabase.from("ia_comunicacoes_robos").update({ resposta_texto: "Cliente XPTO possui faturamento de R$ 500.000/mÃªs e limite de crÃ©dito disponÃ­vel de R$ 50.000. LiberaÃ§Ã£o autorizada.",      resposta_robo_id: roboFinanceiroId,      status: "respondido", }).eq("id", solicitacaoId);
expect(resposta.error).toBeFalsy();

    //  Inserir fila de respost
await supabase.from("ia_comunicacoes_fila_robos").insert({

      robo_id: roboComercialId,      tipo_evento: "comunicacao_resposta",      payload: {

        comunicacao_id: solicitacaoId, resposta: "Dados financeiros fornecidos"}, });

    //  === VALIDAÃ‡ÃƒO 2: Resposta registrada ==
    const {

      data: msgRespondida} = await supabase      .from("ia_comunicacoes_robos")      .select("*")      .eq("id", solicitacaoId)      .single();
expect(msgRespondida!.status).toBe("respondido");
expect(msgRespondida!.resposta_texto).toContain("R$ 500.000");
expect(msgRespondida!.resposta_robo_id).toBe(roboFinanceiroId);

    console.log("Resposta registrada com dados corretos");

    //  === CENÃRIO 3: Escalonamento ao Diretor Virtual ==
    const {

      data: escalonamento} = await supabase.from("ia_comunicacoes_robos").insert({

      origem_robo_id: roboComercialId,      destino_robo_id: roboFinanceiroId,      tipo: "escalonamento",      assunto: "Escalonamento: divergÃªncia de dados financeiros",      mensagem: "Os dados recebidos do Financeiro divergem do sistema interno. NecessÃ¡rio revisÃ£o do Diretor Virtual.",      contexto: {

        comunicacao_original_id: solicitacaoId, divergencia: "limite_credito", valor_sistema: 30000, valor_recebido: 50000}, prioridade: "critical",      status: "pendente",}).select().single();
expect(escalonamento).toBeTruthy();

    console.log(`Escalonamento criado: ${escalonamento!.id}`);

    //  === VALIDAÃ‡ÃƒO 3: Escalonamento registrado ==
    const {

      data: escalonamentoBanco} = await supabase      .from("ia_comunicacoes_robos")      .select("*")      .eq("id", escalonamento!.id)      .single();
expect(escalonamentoBanco!.tipo).toBe("escalonamento");
expect(escalonamentoBanco!.prioridade).toBe("critical");
expect(escalonamentoBanco!.status).toBe("pendente");

    console.log("Escalonamento registrado no banco");

    //  === VALIDAÃ‡ÃƒO 4: Fila com itens pendentes ==
    const {

      data: filaPendente} = await supabase      .from("ia_comunicacoes_fila_robos")      .select("*")      .eq("status", "pending");
expect(filaPendente && filaPendente.length >= 2).toBe(true);

    console.log(`${filaPendente!.length} itens na fila pendente`);

    //  === CENÃRIO 4: Navegar na UI e verificar dados ==
    await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);
expect(page.locator("h1").filter({ hasText: /Central IA/i }).first()).toBeVisible({ timeout: 10000 });

    //  Navegar para aba ComunicaÃ§Ã£
const comunicacaoTab = page.locator('button[role="tab"]:has-text("ComunicaÃ§Ã£o")');
expect(comunicacaoTab).toBeVisible({ timeout: 5000 });
await comunicacaoTab.click();
await page.waitForTimeout(2000);
expect(page.locator("text=ComunicaÃ§Ã£o entre RobÃ´s").first()).toBeVisible({ timeout: 5000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-aba-comunicacao.png"),      fullPage: false, });

    //  Verificar se as mensagens aparece
expect(page.locator("text=SolicitaÃ§Ã£o de dados financeiros").first()).toBeVisible({ timeout: 5000 });
expect(page.locator("text=Cliente XPTO possui faturamento").first()).toBeVisible({ timeout: 5000 });

    console.log("Mensagens visÃ­veis na UI");

    //  Recarregar e verificar persistÃªnci
await page.reload();
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(3000);
await page.locator('button[role="tab"]:has-text("ComunicaÃ§Ã£o")').click();
await page.waitForTimeout(1000);
expect(page.locator("text=ComunicaÃ§Ã£o entre RobÃ´s").first()).toBeVisible({ timeout: 10000 });
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-pos-reload.png"),      fullPage: false, });

    console.log(`Erros JS: ${jsErrors.length}`);
expect(jsErrors.length).toBe(0);}, 120000);});

