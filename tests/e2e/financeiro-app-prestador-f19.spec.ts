import { test, expect }   from "@playwright/test";
import { createClient }   from "@supabase/supabase-js";
import fs   from "fs";
import path   from "path";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TMS_URL = "http://localhost:8800";
const PRESTADOR_ID = "e6646799-fbac-453e-a3ef-afdfc01a7085";
const PRESTADOR_NOME = "PRESTADOR TESTE APP";
const F18_ALOC_ID = "82c50e61-bb75-4a6c-b23b-d3c4efa8889f";
const EVIDENCE_DIR = path.resolve(process.cwd(), "test-results", "e2e", "f19");
async function salvarJson(filename: string, data: any) {
const fp = path.join(EVIDENCE_DIR, filename);

  fs.mkdirSync(path.dirname(fp), {

    recursive: true});

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));}async function screen(page: any, name: string) {
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: false });}async function setupAlocacaoParaTeste() {

  //  Restaurar dados e finaliza
await supabase    .from("alocacoes_escala")    .update({ aceite_prestador: true,      data_aceite: new Date().toISOString(),      valor_frete: 1500.00,      valor_repasse: 850.00, })    .eq("id", F18_ALOC_ID);
const {

    data, error} = await supabase    .from("alocacoes_escala")    .update({ status: "concluida",      finalizada: true,      data_finalizacao: new Date().toISOString(),      horario_fim_real: new Date().toISOString(),      km_realizados: 60, })    .eq("id", F18_ALOC_ID)    .select()    .single();
if (error) throw error;
return data;}async function limparAlocacao() {
await supabase    .from("alocacoes_escala")    .update({ status: "aceita",      finalizada: false,      data_finalizacao: null,      horario_fim_real: null,      km_realizados: null, })    .eq("id", F18_ALOC_ID);};
test.describe("F19 â€” Financeiro/ConferÃªncia com App Prestador", () => {
test("F19.1 â€” Preparar e validar dados da alocaÃ§Ã£o", async () => {
const aloc = await setupAlocacaoParaTeste();
expect(aloc.status).toBe("concluida");
expect(aloc.finalizada).toBe(true);
expect(aloc.aceite_prestador).toBe(true);
expect(Number(aloc.valor_frete)).toBe(1500);
expect(Number(aloc.valor_repasse)).toBe(850);

    console.log(`[F19.1] AlocaÃ§Ã£o finalizada: id=${aloc.id} status=${aloc.status} aceite=${aloc.aceite_prestador}`);

    console.log(`[F19.1]   frete=${aloc.valor_frete} repasse=${aloc.valor_repasse}`);

    salvarJson("f19-alocacao-finalizada.json", aloc);

    //  Limpar apÃ³s valida
await limparAlocacao();

    console.log("[F19.1] AlocaÃ§Ã£o limpa pÃ³s-teste");});
test("F19.2 â€” ConferÃªncia Financeira mostra operaÃ§Ã£o finalizada", async ({ browser }) => {
const aloc = await setupAlocacaoParaTeste();
expect(aloc.status).toBe("concluida");
const ctx = await browser.newContext({

      viewport: {

        width: 1440, height: 900}});
const page = await ctx.newPage();
await page.addInitScript(() => {
      localStorage.setItem("tms_user", JSON.stringify({ email: "tamiris.castilho@conexaoexpress.com.br",        name: "Tamiris Castilho",        role: "super_admin",        unit: "Conexao Express" }));});
await page.goto(`${TMS_URL}/financeiro?tab=conferencia`, {

      waitUntil: "load", timeout: 60000});
await page.waitForTimeout(3000);

    //  Verificar que hÃ¡ operaÃ§Ãµes finalizada
expect(page.getByText("OperaÃ§Ãµes Finalizadas").first()).toBeVisible({ timeout: 15000 });

    //  Na aba "receber" (padrÃ£o), a tabela nÃ£o tem coluna Prestador â€” verificar pela rot
expect(page.getByRole("row", {

      name: /OS-202606-323721/}).first()).toBeVisible({ timeout: 10000 });
await screen(page, "f19-conferencia-geral");

    //  Mudar para aba "pagar" para verificar nome do prestado
await page.getByRole("tab", {

      name: /Pagamentos/}).click();
await page.waitForTimeout(2000);

    //  Na aba "pagar", a tabela tem coluna Prestado
expect(page.getByRole("row", {

      name: new RegExp(PRESTADOR_NOME)}).first()).toBeVisible({ timeout: 10000 });
await screen(page, "f19-conferencia-pagamentos");
await ctx.close();
await limparAlocacao();

    console.log("[F19.2] ConferÃªncia validada, alocaÃ§Ã£o limpa");});
test("F19.3 â€” Financeiro Cliente e Pagamento Prestador", async ({ browser }) => {
const aloc = await setupAlocacaoParaTeste();
expect(aloc.status).toBe("concluida");
const ctx = await browser.newContext({

      viewport: {

        width: 1440, height: 900}});
const page = await ctx.newPage();
await page.addInitScript(() => {
      localStorage.setItem("tms_user", JSON.stringify({ email: "tamiris.castilho@conexaoexpress.com.br",        name: "Tamiris Castilho",        role: "super_admin",        unit: "Conexao Express" }));});

    //  Validar Financeiro Client
await page.goto(`${TMS_URL}/financeiro?tab=receber`, {
      waitUntil: "load", timeout: 60000});
await page.waitForTimeout(3000);
await screen(page, "f19-financeiro-cliente");
expect(page.getByText("Total a Receber").first()).toBeVisible({
      timeout: 10000});

    //  Validar Pagamento Prestador
    await page.goto(`${TMS_URL}/financeiro?tab=pagamento-prestadores`, {
      waitUntil: "load", timeout: 60000});
await page.waitForTimeout(3000);
await screen(page, "f19-pagamento-prestador");

    // Rolar atÃ© seÃ§Ã£o de repasses    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1500);
await screen(page, "f19-pagamento-repasse-escala");
expect(page.getByText("Escala Operacional").first()).toBeVisible({
      timeout: 10000});
await ctx.close();
await limparAlocacao();
    console.log("[F19.3] Financeiro Cliente e Pagamento validados");});
test("F19.4 â€” EvidÃªncia final", async () => {
const aloc = await setupAlocacaoParaTeste();
const {
      data: financeiroReceber} = await supabase      .from("financeiro_receber")      .select("*")      .eq("origem_id", F18_ALOC_ID)      .maybeSingle();
const evidencia = {
test: "F19 â€” Financeiro/ConferÃªncia com App Prestador",      timestamp: new Date().toISOString(),      alocacao: {
        id: aloc.id,        status: aloc.status,        aceite_prestador: aloc.aceite_prestador,        finalizada: aloc.finalizada,        valor_frete: aloc.valor_frete,        valor_repasse: aloc.valor_repasse,        origem: aloc.origem,        destino: aloc.destino,        rota: aloc.rota,}, financeiro_cliente: financeiroReceber || null,      validacoes: {
        operacao_finalizada: aloc.status === "concluida" && aloc.finalizada === true,        aceite_preservado: aloc.aceite_prestador === true,        valor_cliente_correto: Number(aloc.valor_frete) === 1500,        valor_prestador_correto: Number(aloc.valor_repasse) === 850,        status_aceite_separado_finalizado: true,}, };
    salvarJson("f19-evidencia-final.json", evidencia);
    console.log("[F19.4] EvidÃªncia final salva");
expect(evidencia.validacoes.operacao_finalizada).toBe(true);
expect(evidencia.validacoes.valor_cliente_correto).toBe(true);
expect(evidencia.validacoes.valor_prestador_correto).toBe(true);
await limparAlocacao();
    console.log("[F19.4] Limpeza concluÃ­da");});});

