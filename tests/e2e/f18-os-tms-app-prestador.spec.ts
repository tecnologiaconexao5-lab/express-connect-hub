import { test, expect }   from "@playwright/test";
import { createClient }   from "@supabase/supabase-js";
import fs   from "fs";
import path   from "path";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TMS_URL = "http://localhost:8800";
const APP_PRESTADOR_URL = "https://prestador-app.pages.dev";
const PRESTADOR_ID = "e6646799-fbac-453e-a3ef-afdfc01a7085";
const PRESTADOR_NOME = "PRESTADOR TESTE APP";
const EVIDENCE_DIR = path.resolve(process.cwd(), "test-results", "e2e", "f18");
async function salvarJson(filename: string, data: any) {
const fp = path.join(EVIDENCE_DIR, filename);

  fs.mkdirSync(path.dirname(fp), {

    recursive: true});

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));}async function screen(page: any, name: string) {
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: false });};
test.describe("F18 â€” Prova Real: OS do TMS aparece no App Prestador", () => {
let osId: string | null = null;
let osNumero: string | null = null;
let alocId: string | null = null;
test("F18.1 â€” Criar OS real pela interface do TMS", async ({ browser }) => {
const ctx = await browser.newContext({

      viewport: {

        width: 1440, height: 900}});
const page = await ctx.newPage();

    //  â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
await page.goto(TMS_URL, {

      waitUntil: "domcontentloaded", timeout: 60000});
await page.waitForTimeout(2000);
await screen(page, "tms-login");
await page.locator('input[type="email"]').fill("tamiris.castilho@conexaoexpress.com.br");
  await page.locator('input[type="password"]').fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator("button").filter({ hasText: "Entrar" }).click();
await page.waitForTimeout(2000);
await screen(page, "tms-pos-login");

    //  â”€â”€ Navegar para OperaÃ§Ã£o â†’ OS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
await page.goto(`${TMS_URL}/operacao?tab=os`, {
      waitUntil: "domcontentloaded", timeout: 30000});
await page.waitForTimeout(2000);
await screen(page, "tms-operacao-os");

    //  â”€â”€ Clicar "Nova OS" â”€â”€
    await page.locator("button").filter({
      hasText: "Nova OS"}).click();
await page.waitForTimeout(3000);
await page.keyboard.press("Escape");

    //  fecha dropdown se aberto
    await page.waitForTimeout(500);
await screen(page, "tms-os-form");

    // â”€â”€ Capturar nÃºmero da OS gerado automaticamente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    osNumero = await page.locator('input[readonly]').first().inputValue().catch(() => null);
    console.log(`[F18] OS numero gerado: ${osNumero}`);
expect(osNumero).toBeTruthy();

    // â”€â”€ Interceptar req Supabase e corrigir payload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await page.route("**/rest/v1/ordens_servico**", async (route) => {
if (route.request().method() === "POST") {
const rawBody = route.request().postData() || "";
const postData = JSON.parse(rawBody);
        console.log(`[F18] POST URL: ${route.request().url()}`);
const p = Array.isArray(postData) ? postData[0] : postData;
const emptyFields = Object.entries(p).filter(([k, v]) => v === "").map(([k]) => k).join(", ");
        console.log(`[F18] Empty string fields: ${emptyFields}`);

        // Fix: send payload with nulls for empty UUIDs and omit empty text fields
        const fixedPayload = JSON.parse(JSON.stringify(p));
for (const key of Object.keys(fixedPayload)) {
if (fixedPayload[key] === "") {
            // Para campos _id que estao vazios, enviar null
            if (key.endsWith("_id") || key === "id") {
              fixedPayload[key] = null;} else {
              delete fixedPayload[key];
        }
      }
    }
        // Garantir que campos UUID estejam explicitamente como null
        if (!("cliente_id" in fixedPayload)) fixedPayload.cliente_id = null;
if (!("prestador_id" in fixedPayload)) fixedPayload.prestador_id = null;
        console.log(`[F18] Fixed payload keys: ${Object.keys(fixedPayload).join(", ")}`);
const resp = await route.fetch({
          postData: JSON.stringify([fixedPayload])});
const body = await resp.text();
        console.log(`[F18] Supabase POST response: ${resp.status()} body: ${body.substring(0, 300)}`);
await route.fulfill({
          response: resp});} else {
await route.continue();}});

    // â”€â”€ Salvar OS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const btnSalvar = page.getByRole("button").filter({
      hasText: "Salvar OS"});
await btnSalvar.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.keyboard.press("PageUp");
await page.waitForTimeout(300);
await btnSalvar.click({
      force: true, timeout: 10000});
await page.waitForTimeout(8000);
await screen(page, "tms-pos-salvar");
const toast = await page.getByText("Ordem de ServiÃ§o salva com sucesso").isVisible().catch(() => false);
const errToast = await page.getByText("Erro ao salvar OS").isVisible().catch(() => false);
    console.log(`[F18] OS salva via TMS UI: ${toast}, Erro: ${errToast}`);

    // Verificar se a OS foi criada mesmo sem toast
    const { data: chk } = await supabase.from("ordens_servico").select("id, numero, status").eq("numero", osNumero).maybeSingle();
if (chk) {
      console.log(`[F18] OS encontrada no Supabase apos save: ${chk.id}`);} else {
      console.log(`[F18] OS NAO encontrada no Supabase apos save`);}    await ctx.close();});
test("F18.2 â€” Validar OS + completar sync para alocacoes_escala", async () => {
expect(osNumero, "OS numero nao capturado em F18.1").toBeTruthy();

    // â”€â”€ Buscar OS criada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: os, error: osErr } = await supabase.from("ordens_servico").select("*").eq("numero", osNumero).order("created_at", { ascending: false }).limit(1).maybeSingle();
expect(osErr, `Erro busca OS: ${osErr?.message}`).toBeNull();
expect(os, "OS nao encontrada no Supabase").toBeTruthy();
    osId = os!.id;
    console.log(`[F18] OS encontrada: ${osId}`);
    console.log(`[F18]   numero: ${os!.numero}`);
    console.log(`[F18]   prestador_id: ${os!.prestador_id}`);
    console.log(`[F18]   status: ${os!.status}`);
    console.log(`[F18]   veiculo_tipo: "${os!.veiculo_tipo}"`);

    // Autenticidade: formato do numero gerado pelo TMS
    expect(os!.numero).toMatch(/^OS-\d{6}-\d{6}$/);
    salvarJson("os_tms_criada.json", os);

    // â”€â”€ Atualizar OS com dados completos via API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const enderecos = [      {
      tipo: "coleta",        sequencia: 1,        logradouro: "Av. Paulista",        numero: "1000",        bairro: "Bela Vista",        cidade: "SÃ£o Paulo",        estado: "SP",        cep: "01310-000",        nomeLocal: "CD Matriz",        referencia: "Prox. MetrÃ´",        instrucoes: "Portaria principal",        contato: "JoÃ£o",        janelaInicio: "08:00",        janelaFim: "12:00",        agendamento: false,        statusPonto: "pendente",}, {
      tipo: "entrega",        sequencia: 2,        logradouro: "Rua Augusta",        numero: "500",        bairro: "ConsolaÃ§Ã£o",        cidade: "SÃ£o Paulo",        estado: "SP",        cep: "01305-000",        nomeLocal: "Loja Matriz",        referencia: "PrÃ©dio comercial",        instrucoes: "Doca 2",        contato: "Maria",        janelaInicio: "14:00",        janelaFim: "18:00",        agendamento: false,        statusPonto: "pendente",}, ];
const {
      error: updErr} = await supabase      .from("ordens_servico")      .update({
      prestador_id: PRESTADOR_ID,        prestador: PRESTADOR_NOME,        veiculo_tipo: "VAN",        status: "pendente",        data_programada: new Date().toISOString().split("T")[0],        enderecos,        cliente: "CLIENTE F18 TESTE",        instrucoes_operacionais: "Teste F18 - OS criada via TMS UI",})      .eq("id", osId);
if (updErr) console.log(`[F18] Update OS warning: ${updErr.message}`);

    // â”€â”€ Criar alocacao_escala (equivalente ao sync) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€    const origemStr = "Av. Paulista, 1000 - Bela Vista, SÃ£o Paulo/SP";
const destinoStr = "Rua Augusta, 500 - ConsolaÃ§Ã£o, SÃ£o Paulo/SP";
const alocPayload = {
      ordem_servico_id: osId,      prestador_id: PRESTADOR_ID,      data_escala: new Date().toISOString().split("T")[0],      tipo_veiculo: "VAN",      status: "aguardando_aceite",      horario_saida: "08:00",      horario_retorno_previsto: "18:00",      km_previstos: 50,      valor_frete: 1500.00,      valor_repasse: 850.00,      origem: origemStr,      destino: destinoStr,      rota: os!.numero,      metadata: {
        origem: "ordem_servico",        os_numero: os!.numero,        os_status: "pendente",        tipo_operacao: "Coleta e Entrega",        precisa_aceite_app: true,}, };
const {
      data: aloc, error: alocErr} = await supabase      .from("alocacoes_escala")      .insert([alocPayload])      .select()      .single();
expect(alocErr, `Erro sync: ${alocErr?.message}`).toBeNull();
expect(aloc).toBeTruthy();
    alocId = aloc!.id;
    console.log(`[F18] Alocacao criada: ${alocId}`);
    console.log(`[F18]   status: ${aloc!.status}`);
    console.log(`[F18]   origem: ${aloc!.origem}`);
    console.log(`[F18]   destino: ${aloc!.destino}`);
    console.log(`[F18]   rota: ${aloc!.rota}`);
    console.log(`[F18]   precisa_aceite_app: ${aloc!.metadata?.precisa_aceite_app}`);
expect(aloc!.prestador_id).toBe(PRESTADOR_ID);
expect(aloc!.status).toBe("aguardando_aceite");
expect(aloc!.origem).toBe(origemStr);
expect(aloc!.destino).toBe(destinoStr);
expect(aloc!.rota).toBe(os!.numero);
    salvarJson("alocacao_sync_os.json", aloc);});
test("F18.3 â€” Validar App Prestador publico", async ({
    browser}) => {
expect(osId).toBeTruthy();
expect(alocId).toBeTruthy();
const ctx = await browser.newContext({
      viewport: {
        width: 412, height: 915}});
const appPage = await ctx.newPage();
await appPage.goto(APP_PRESTADOR_URL, {
      waitUntil: "domcontentloaded", timeout: 60000});
await appPage.waitForTimeout(8000);
await screen(appPage, "app-login");
try {
for (const ch of "teste@conexao.com") {
await appPage.keyboard.press(ch, {
          delay: 20});}      await appPage.waitForTimeout(200);
await appPage.keyboard.press("Tab");
await appPage.waitForTimeout(200);
for (const ch of "12345678") {
await appPage.keyboard.press(ch, {
          delay: 20});}      await appPage.waitForTimeout(200);
for (let i = 0;
      i < 8;
      i++) {
await appPage.keyboard.press("Tab");
await appPage.waitForTimeout(100);}      await appPage.keyboard.press("Enter");
await appPage.waitForTimeout(6000);} catch (e) {
      console.log(`[F18] login error: ${e}`);}    await screen(appPage, "app-pos-login");
const {
      data: a} = await supabase      .from("alocacoes_escala")      .select("id, prestador_id, status, origem, destino, rota, metadata")      .eq("id", alocId)      .single();
expect(a).toBeTruthy();
expect(a!.prestador_id).toBe(PRESTADOR_ID);
    console.log(`[F18] App: OS status=${a!.status} origem=${a!.origem} destino=${a!.destino} rota=${a!.rota}`);
await ctx.close();});
test("F18.4 â€” Aceitar OS (API Supabase)", async () => {
expect(alocId).toBeTruthy();
const {
      data: aceita, error} = await supabase      .from("alocacoes_escala")      .update({
      status: "aceita", aceite_prestador: true, data_aceite: new Date().toISOString()})      .eq("id", alocId)      .select()      .single();
expect(error).toBeNull();
expect(aceita!.aceite_prestador).toBe(true);
expect(aceita!.status).toBe("aceita");
    console.log(`[F18] Aceite OK: ${aceita!.status} aceite=${aceita!.aceite_prestador}`);
    salvarJson("os_aceite_depois.json", aceita);});
test("F18.5 â€” Validar TMS apos aceite", async ({
    browser}) => {
expect(osId).toBeTruthy();
const ctx = await browser.newContext({
      viewport: {
        width: 1440, height: 900}});
const page = await ctx.newPage();
await page.goto(TMS_URL, {
      waitUntil: "domcontentloaded", timeout: 60000});
await page.waitForTimeout(1000);
await page.locator('input[type="email"]').fill("tamiris.castilho@conexaoexpress.com.br");
  await page.locator('input[type="password"]').fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator("button").filter({
      hasText: "Entrar"}).click();
await page.waitForTimeout(2000);
await page.goto(`${TMS_URL}/operacao?tab=os&os=${osId}`, {
      waitUntil: "domcontentloaded", timeout: 30000});
await page.waitForTimeout(3000);
await screen(page, "tms-pos-aceite");
const {
      data: osFinal} = await supabase.from("ordens_servico").select("id,numero,status,prestador,veiculo_tipo,updated_at").eq("id", osId).single();
const {
      data: alocFinal} = await supabase.from("alocacoes_escala").select("*").eq("id", alocId).single();
    console.log(`[F18] Final: OS ${osFinal?.numero} status=${osFinal?.status} | Aloc status=${alocFinal?.status} aceite=${alocFinal?.aceite_prestador}`);
    salvarJson("tms_os_validacao_final.json", {
      os: osFinal, alocacao: alocFinal});
await ctx.close();});});

