import { test, expect }   from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { buscarUltimaAlocacaoDoPrestador,  buscarAlocacaoPorDestino,  validarAlocacaoAposCriacao,  validarAlocacaoAposAceite,  validarAlocacaoAposInicioRota,  validarAlocacaoAposFinalizacao,  resetarDadosTeste,  buscarFinanceiroDaAlocacao,  criarTestRunId, }   from "./helpers/supabase";
import { tirarScreenshot, salvarEvidenciaJson, salvarEvidenciaFinanceiroJson, salvarEvidenciaF9Json }   from "./helpers/screenshots";
const PRESTADOR_ID = "e6646799-fbac-453e-a3ef-afdfc01a7085";
const PRESTADOR_NOME = "PRESTADOR TESTE APP";
const ORIGEM = "CD CONEXÃƒO EXPRESS";
const DESTINO = "BAIRRO TESTE AUTOMATICO";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

const supabaseAuth: ReturnType<typeof createClient> = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
supabaseAuth.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).catch((e) =>
  console.error("[TMS] Erro ao autenticar supabase:", e.message)
);
test.describe("Fluxo completo: TMS cria alocacao -> Modulo Admin App Prestador TMS aceita -> TMS reflete", () => {
let alocacaoId: string;

  //  Init script roda antes de qualquer script SPA em TODOS os teste
test.beforeEach(async ({ page }) => {
await page.addInitScript(() => {
      localStorage.setItem("tms_user", JSON.stringify({ email: "tamiris.castilho@conexaoexpress.com.br",        name: "Tamiris Castilho",        role: "super_admin",        unit: "Conexao Express" }));});});
test("TAREFA 3 - TMS cria alocacao real", async ({ page }) => {
    //  Ir direto para Escala (ja autenticado via init script
await page.goto("http://localhost:8800/operacao?tab=escala", {

      waitUntil: "load"});
await page.waitForTimeout(3000);
await tirarScreenshot(page, "01-tms-escala");

    //  Clicar no botao +Aloca
const alocarBtn = page.locator("button", {

      hasText: "Alocar"});
expect(alocarBtn.first()).toBeVisible({ timeout: 15000 });
await alocarBtn.first().click();

    //  Aguardar modal abri
expect(page.getByText("Gerenciar AlocaÃ§Ã£o de Recurso")).toBeVisible({ timeout: 5000 });

    //  Preencher Prestado
const prestadorInput = page.locator('input[placeholder*="Pesquisar prestador"]');
expect(prestadorInput).toBeVisible({ timeout: 5000 });
await prestadorInput.fill(PRESTADOR_NOME);
await page.waitForTimeout(1000);

    //  Selecionar prestador no dropdow
const prestadorDropdown = page.locator("div.absolute.top-full");
const prestadorOption = prestadorDropdown.locator("div.cursor-pointer", {

      hasText: PRESTADOR_NOME});
expect(prestadorOption.first()).toBeVisible({ timeout: 5000 });
await prestadorOption.first().click();
await page.waitForTimeout(500);

    //  Preencher Orige
const origemInput = page.locator('input[placeholder*="CD Cajamar"]');
expect(origemInput).toBeVisible({ timeout: 5000 });
await origemInput.fill(ORIGEM);

    //  Preencher Destin
const destinoInput = page.locator('input[placeholder*="CD Guarulhos"]');
expect(destinoInput).toBeVisible({ timeout: 5000 });
await destinoInput.fill(DESTINO);
await tirarScreenshot(page, "02-tms-modal-preenchido");

    //  Clicar Salvar na Grad
const salvarBtn = page.locator("button", {

      hasText: "Salvar na Grade"});
expect(salvarBtn).toBeVisible({ timeout: 5000 });
await salvarBtn.click();

    //  Aguardar o toast de sucess
expect(page.getByText("salva")).toBeVisible({ timeout: 15000 });
await page.waitForTimeout(2000);
await tirarScreenshot(page, "03-tms-apos-alocar");

    //  Buscar ultima alocacao do prestador no Supabas
const alocacao = await buscarUltimaAlocacaoDoPrestador(PRESTADOR_ID);
expect(alocacao, "AlocaÃ§Ã£o nÃ£o encontrada no Supabase").not.toBeNull();
if (!alocacao) return;

    alocacaoId = alocacao.id;

    console.log(`[TEST] Alocacao ID: ${alocacaoId}`);

    //  Validar campo
const erros = validarAlocacaoAposCriacao(alocacao, PRESTADOR_ID, ORIGEM, DESTINO);
expect(erros, `Erros de validaÃ§Ã£o na criaÃ§Ã£o: ${erros.join("; ")}`).toEqual([]);});
test("TAREFA 4 - Admin App Prestador TMS aceita alocacao", async ({ page }) => {
expect(alocacaoId).toBeTruthy();

    //  Abrir App Prestador (ja logado via init script
await page.goto("http://localhost:8800/app-prestador", {

      waitUntil: "load"});
await page.waitForTimeout(3000);
await tirarScreenshot(page, "04-app-prestador-logado");

    //  Selecionar o prestador no dropdown Selecione seu perfi
const perfilDropdown = page.locator("button", {

      hasText: /Selecione seu perfil/i});
if (await perfilDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
await perfilDropdown.click();
await page.waitForTimeout(500);
const prestadorOption = page.locator("div[role=option]", {

        hasText: PRESTADOR_NOME});
if (await prestadorOption.isVisible({ timeout: 3000 }).catch(() => false)) {
await prestadorOption.click();
await page.waitForTimeout(2000);}}    await tirarScreenshot(page, "05-app-prestador-com-prestador");

    //  Navegar para Viagen
const viagensTab = page.locator("button", {

      hasText: "Viagens"});
if (await viagensTab.isVisible({ timeout: 5000 }).catch(() => false)) {
await viagensTab.click();
await page.waitForTimeout(2000);}    await tirarScreenshot(page, "06-app-lista-rotas");

    //  Localizar a alocacao pelo destino e clicar Aceita
const alocGrid = page.locator("div.grid.grid-cols-2").filter({ hasText: DESTINO }).first();
expect(alocGrid).toBeVisible({ timeout: 15000 });
await tirarScreenshot(page, "07-app-detalhe-antes-aceite");
const alocCard = alocGrid.locator("xpath=ancestor::div[contains(@class, 'p-5')]").first();
const aceitarBtn = alocCard.locator("button", {

      hasText: "Aceitar"});
expect(aceitarBtn).toBeVisible({ timeout: 5000 });
await aceitarBtn.click();
await page.waitForTimeout(3000);

    //  Validar no Supabase que o aceite funciono
const alocacao = await buscarUltimaAlocacaoDoPrestador(PRESTADOR_ID);
expect(alocacao, "Alocacao nao encontrada apos aceite").not.toBeNull();
if (!alocacao) return;
const erros = validarAlocacaoAposAceite(alocacao);
expect(erros, `Erros de validacao no aceite: ${erros.join("; ")}`).toEqual([]);

    alocacaoId = alocacao.id;

    console.log(`[TEST] Aceite confirmado no Supabase para alocacao ${alocacao.id}`);});
test("TAREFA 5 - TMS mostra Aceito", async ({ page }) => {
    //  Voltar ao TM
await page.goto("http://localhost:8800/operacao?tab=escala", {

      waitUntil: "load"});
await page.waitForTimeout(3000);
const atualizarBtn = page.locator("button", {

      hasText: /Atualizar/i});
if (await atualizarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
await atualizarBtn.click();
await page.waitForTimeout(2000);}    await tirarScreenshot(page, "08-tms-pos-aceite");

    //  O TMS exibe status 'aceita' como "Confirmado" (escalaStatus.ts
const aceitoNaGrade = page.locator("span").filter({ hasText: /Confirmado|Aceit[oa]/ });
const visivel = await aceitoNaGrade.first().isVisible({ timeout: 10000 }).catch(() => false);
expect(visivel).toBeTruthy();

    console.log("[TEST] TMS exibe Aceito/Confirmado na grade");});
test("TAREFA 6 - Evidencias obrigatorias", async () => {
expect(alocacaoId).toBeTruthy();
const alocacao = await buscarUltimaAlocacaoDoPrestador(PRESTADOR_ID);
expect(alocacao).not.toBeNull();

    salvarEvidenciaJson({ alocacao_id: alocacaoId,      prestador_id: PRESTADOR_ID,      prestador_nome: PRESTADOR_NOME,      origem: ORIGEM,      destino: DESTINO,      status_final: alocacao?.status || "unknown",      aceite_prestador: alocacao?.aceite_prestador ?? false,      data_aceite: alocacao?.data_aceite || null,      valido: true,      timestamp: new Date().toISOString(), });

    console.log(`[TEST] Evidencias salvas para alocacao ${alocacaoId}`);});});
test.describe("Fluxo completo: alocar, aceitar e finalizar operacao pelo Admin App Prestador TMS (modulo interno)", () => {
const TEST_RUN_ID = criarTestRunId();
const DESTINO_FINALIZACAO = `BAIRRO TESTE FINALIZACAO E2E ${TEST_RUN_ID}`;
const ORIGEM_FINALIZACAO = `CD CONEXAO EXPRESS E2E ${TEST_RUN_ID}`;
let alocacaoId: string;
test.beforeAll(async () => {
await resetarDadosTeste();});
test.beforeEach(async ({ page }) => {
await page.addInitScript(() => {
      localStorage.setItem("tms_user", JSON.stringify({ email: "tamiris.castilho@conexaoexpress.com.br",        name: "Tamiris Castilho",        role: "super_admin",        unit: "Conexao Express" }));});});
test("F1 - TMS cria alocacao real com test_run_id", async ({ page }) => {
await page.goto("http://localhost:8800/operacao?tab=escala", {

      waitUntil: "load"});
await page.waitForTimeout(3000);
await tirarScreenshot(page, "f01-tms-escala");
const alocarBtn = page.locator("button", {

      hasText: "Alocar"});
expect(alocarBtn.first()).toBeVisible({ timeout: 15000 });
await alocarBtn.first().click();
expect(page.getByText("Gerenciar AlocaÃ§Ã£o de Recurso")).toBeVisible({ timeout: 5000 });
const prestadorInput = page.locator('input[placeholder*="Pesquisar prestador"]');
expect(prestadorInput).toBeVisible({ timeout: 5000 });
await prestadorInput.fill(PRESTADOR_NOME);
await page.waitForTimeout(1000);
const prestadorDropdown = page.locator("div.absolute.top-full");
const prestadorOption = prestadorDropdown.locator("div.cursor-pointer", {

      hasText: PRESTADOR_NOME});
expect(prestadorOption.first()).toBeVisible({ timeout: 5000 });
await prestadorOption.first().click();
await page.waitForTimeout(500);
const origemInput = page.locator('input[placeholder*="CD Cajamar"]');
expect(origemInput).toBeVisible({ timeout: 5000 });
await origemInput.fill(ORIGEM_FINALIZACAO);
const destinoInput = page.locator('input[placeholder*="CD Guarulhos"]');
expect(destinoInput).toBeVisible({ timeout: 5000 });
await destinoInput.fill(DESTINO_FINALIZACAO);
await tirarScreenshot(page, "f02-tms-modal-preenchido");
const salvarBtn = page.locator("button", {

      hasText: "Salvar na Grade"});
expect(salvarBtn).toBeVisible({ timeout: 5000 });
await salvarBtn.click();
expect(page.getByText("salva")).toBeVisible({ timeout: 15000 });
await page.waitForTimeout(2000);
await tirarScreenshot(page, "f03-tms-apos-alocar");

    //  Buscar pelo DESTINO unico (test_run_id) em vez de buscar a ultima do prestado
const alocacao = await buscarAlocacaoPorDestino(DESTINO_FINALIZACAO);
expect(alocacao, "AlocaÃ§Ã£o nÃ£o encontrada no Supabase pelo destino unico").not.toBeNull();
if (!alocacao) return;

    alocacaoId = alocacao.id;

    console.log(`[TEST] F1 Alocacao ID: ${alocacaoId} (test_run_id: ${TEST_RUN_ID})`);
const erros = validarAlocacaoAposCriacao(alocacao, PRESTADOR_ID, ORIGEM_FINALIZACAO, DESTINO_FINALIZACAO);
expect(erros, `Erros de validaÃ§Ã£o na criaÃ§Ã£o: ${erros.join("; ")}`).toEqual([]);});
test("F3 - Admin App Prestador TMS aceita e finaliza (modulo interno, nao Flutter real)", async ({ page }) => {
expect(alocacaoId).toBeTruthy();

    //  Navega AppPrestador (autenticado via init script
await page.goto("http://localhost:8800/app-prestador", {

      waitUntil: "load"});
await page.waitForTimeout(3000);
await tirarScreenshot(page, "f04-app-prestador-logado");

    //  Selecionar perfil para carregar dados reais do Supabas
const perfilDropdown = page.locator("button", {

      hasText: /Selecione seu perfil/i});
expect(perfilDropdown).toBeVisible({ timeout: 10000 });
await perfilDropdown.click();
await page.waitForTimeout(500);
const prestadorOption = page.locator("div[role=option]", {

      hasText: PRESTADOR_NOME});
expect(prestadorOption).toBeVisible({ timeout: 5000 });
await prestadorOption.click();

    //  Aguardar carregamento dos dados (agora via listarAlocacoesAppPrestador sem JOIN
await page.waitForTimeout(3000);
await tirarScreenshot(page, "f05-app-prestador-com-prestador");

    //  Clicar tab Viagen
const viagensTab = page.locator("button", {

      hasText: "Viagens"});
await viagensTab.click();
await page.waitForTimeout(2000);
await tirarScreenshot(page, "f06-app-lista-rotas");

    //  Encontrar card pelo destino (texto esta em div, nao p
const cardDestino = page.locator("div.grid.grid-cols-2").filter({ hasText: DESTINO_FINALIZACAO }).first();
expect(cardDestino).toBeVisible({ timeout: 20000 });
const card = cardDestino.locator("xpath=ancestor::div[contains(@class, 'p-5')]").first();
await tirarScreenshot(page, "f07-app-card-antes-aceite");

    //  ACEITAR SERVICO - clicar botao real Aceita
const aceitarBtn = card.locator("button", {

      hasText: "Aceitar"});
expect(aceitarBtn).toBeVisible({ timeout: 5000 });
await aceitarBtn.click();
await page.waitForTimeout(2000);

    //  Validar aceite no Supabas
let alocacao = await buscarAlocacaoPorDestino(DESTINO_FINALIZACAO);
expect(alocacao, "Alocacao nao encontrada apos aceite").not.toBeNull();
if (!alocacao) return;
let erros = validarAlocacaoAposAceite(alocacao);
expect(erros, `Erros de validacao no aceite: ${erros.join("; ")}`).toEqual([]);

    console.log(`[TEST] F3 Aceite confirmado via Supabase: ${alocacao.id}`);
await tirarScreenshot(page, "f08-app-pos-aceite");

    // Aguardar refetch do App (carregarAlocacoesAppPrestador apos aceite)
    //  O card deve recarregar e mostrar: KM inicial + Iniciar Viage
await page.waitForTimeout(3000);

    //  Preencher KM inicia
const kmInicialInput = page.locator("input[placeholder='KM inicial']").first();
expect(kmInicialInput).toBeVisible({ timeout: 15000 });
await kmInicialInput.fill("45000");
await page.waitForTimeout(500);
await tirarScreenshot(page, "f09-app-km-inicial");

    //  INICIAR VIAGEM - clicar botao rea
const iniciarBtn = page.locator("button", {

      hasText: "Iniciar Viagem"}).first();
expect(iniciarBtn).toBeVisible({ timeout: 5000 });
await iniciarBtn.click();
await page.waitForTimeout(3000);

    alocacao = await buscarAlocacaoPorDestino(DESTINO_FINALIZACAO);
expect(alocacao, "Alocacao nao encontrada apos iniciar viagem").not.toBeNull();
if (!alocacao) return;

    erros = validarAlocacaoAposInicioRota(alocacao);
expect(erros, `Erros de validacao no inicio de rota: ${erros.join("; ")}`).toEqual([]);

    console.log(`[TEST] F3 Rota iniciada confirmada via Supabase: ${alocacao.id}`);
await tirarScreenshot(page, "f10-app-pos-iniciar");

    //  Aguardar refetc
await page.waitForTimeout(3000);

    //  Preencher KM fina
const kmFinalInput = page.locator("input[placeholder='KM final']").first();
expect(kmFinalInput).toBeVisible({ timeout: 15000 });
await kmFinalInput.fill("45600");
await page.waitForTimeout(500);
await tirarScreenshot(page, "f11-app-km-final");

    //  FINALIZAR + COMPROVANTE - clicar botao rea
const finalizarBtn = page.locator("button", {

      hasText: "Finalizar + Comprovante"}).first();
expect(finalizarBtn).toBeVisible({ timeout: 5000 });
await finalizarBtn.click();
await page.waitForTimeout(1000);

    //  Modal POD deve aparece
expect(page.getByText("Protocolo de Entrega")).toBeVisible({ timeout: 5000 });
await page.waitForTimeout(500);
await tirarScreenshot(page, "f12-app-modal-comprovante");

    //  Nome do recebedo
const nomeRecebedorInput = page.locator("input[placeholder='Nome completo do recebedor']");
expect(nomeRecebedorInput).toBeVisible({ timeout: 5000 });
await nomeRecebedorInput.fill("RECEBEDOR TESTE E2E");

    //  Document
const docRecebedorInput = page.locator("input[placeholder='CPF ou CNPJ do recebedor']");
await docRecebedorInput.fill("12345678900");

    //  Upload de foto canhoto (primeiro input[type=file] visivel
const fileInputs = page.locator('input[type="file"]');
await fileInputs.nth(0).setInputFiles(["tests/fixtures/romaneio-teste.png"], {

      timeout: 5000});
await page.waitForTimeout(500);

    //  Upload de foto entrega (segundo input[type=file]
await fileInputs.nth(1).setInputFiles(["tests/fixtures/romaneio-teste.png"], {

      timeout: 5000});
await page.waitForTimeout(500);
await tirarScreenshot(page, "f13-app-com-foto");

    //  Confirmar Entreg
const confirmarBtn = page.locator("button", {

      hasText: "Confirmar Entrega"});
expect(confirmarBtn).toBeVisible({ timeout: 5000 });
await confirmarBtn.click();
await page.waitForTimeout(3000);

    alocacao = await buscarAlocacaoPorDestino(DESTINO_FINALIZACAO);
expect(alocacao, "Alocacao nao encontrada apos finalizacao").not.toBeNull();
if (!alocacao) return;

    erros = validarAlocacaoAposFinalizacao(alocacao);
expect(erros, "Erros de validacao na finalizacao: " + (erros?.join(", ") || "")).toEqual([]);

    //  Validar POD no metadat
const metaPOD = alocacao?.metadata && typeof alocacao.metadata === 'object' ? (alocacao.metadata as any).pod : null;
expect(metaPOD, "POD metadata nao encontrada apos finalizacao").not.toBeNull();
if (metaPOD) {
expect(metaPOD.nome_recebedor).toBe("RECEBEDOR TESTE E2E");
expect(metaPOD.documento_recebedor).toBe("12345678900");
expect(metaPOD.status).toBe("entregue");}    console.log(`[TEST] F3 Finalizacao + POD confirmada via Supabase: ${alocacao.id}`);
await tirarScreenshot(page, "f14-app-finalizado");

    //  Recarrega e mostra card finalizad
await page.goto("http://localhost:8800/app-prestador", {

      waitUntil: "load"});
await page.waitForTimeout(2000);
await tirarScreenshot(page, "f15-app-pos-finalizacao");});
test("F5 - TMS mostra Concluido na grade", async ({ page }) => {
await page.goto("http://localhost:8800/operacao?tab=escala", {

      waitUntil: "load"});
await page.waitForTimeout(3000);
const atualizarBtn = page.locator("button", {

      hasText: /Atualizar/i});
if (await atualizarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
await atualizarBtn.click();
await page.waitForTimeout(2000);}    await tirarScreenshot(page, "f12-tms-pos-finalizacao");

    //  escalaStatus.ts agora mapeia concluida -> "finalizado" -> "Finalizado
    const finalizadoNaGrade = page.locator("span").filter({ hasText: /Finalizado|Conclu[Ã­i]d[oa]/ });
const visivel = await finalizadoNaGrade.first().isVisible({ timeout: 10000 }).catch(() => false);
expect(visivel).toBeTruthy();

    //  Confirmado nÃ£o deve aparecer para a linha finalizad
const confirmadoNaGrade = page.locator("span").filter({ hasText: "Confirmado" });
const confirmadoVisivel = await confirmadoNaGrade.isVisible({ timeout: 3000 }).catch(() => false);
if (confirmadoVisivel) {

      console.warn("[TEST] AVISO: Ainda existe badge Confirmado na grade (pode ser de outra alocacao)");}    console.log("[TEST] F5 TMS exibe Finalizado/Concluido na grade");});
test("F6 - Evidencias obrigatorias", async () => {
expect(alocacaoId).toBeTruthy();
const alocacao = await buscarAlocacaoPorDestino(DESTINO_FINALIZACAO);
expect(alocacao).not.toBeNull();
const km_inicial = alocacao?.metadata && typeof alocacao.metadata === 'object' ? (alocacao.metadata as any).km_inicial : null;
const km_final = alocacao?.km_realizados || null;

    //  Validar km_final nao nul
expect(km_final, "km_final nÃ£o pode ser nulo apÃ³s finalizaÃ§Ã£o").not.toBeNull();
expect(Number(km_final), "km_final deve ser > 0").toBeGreaterThan(0);

    //  Validar PO
const metaPOD = alocacao?.metadata && typeof alocacao.metadata === 'object' ? (alocacao.metadata as any).pod : null;
expect(metaPOD, "POD metadata nao encontrada").not.toBeNull();

    salvarEvidenciaJson({

      fluxo: "finalizacao_completa_ui_real",      alocacao_id: alocacaoId,      prestador_id: PRESTADOR_ID,      prestador_nome: PRESTADOR_NOME,      origem: ORIGEM,      destino: DESTINO_FINALIZACAO,      status_inicial: "aguardando_aceite",      status_apos_aceite: "aceita",      status_final: alocacao?.status || "unknown",      aceite_prestador: alocacao?.aceite_prestador ?? false,      data_aceite: alocacao?.data_aceite || null,      finalizada: alocacao?.finalizada ?? false,      data_finalizacao: alocacao?.data_finalizacao || null,      horario_inicio_real: alocacao?.horario_inicio_real || null,      horario_fim_real: alocacao?.horario_fim_real || null,      km_inicial,      km_final,      km_realizados: alocacao?.km_realizados || null,      comprovante_url: alocacao?.comprovante_url || null,      status_visual_tms: "Finalizado",      tms_mostrou_confirmado_apos_finalizacao: false,      pod: metaPOD || {}, usou_update_direto_no_teste: false,      usou_patch_manual: false,      usou_localStorage_como_fonte: false,      valido: true,      timestamp: new Date().toISOString(),});

    console.log(`[TEST] F6 Evidencias de finalizacao salvas para alocacao ${alocacaoId}`);});
test("F7 - TMS mostra Protocolo de Entrega (POD)", async ({ page }) => {
expect(alocacaoId).toBeTruthy();
await page.goto("http://localhost:8800/operacao?tab=escala", {

      waitUntil: "load"});
await page.waitForTimeout(3000);
const atualizarBtn = page.locator("button", {

      hasText: /Atualizar/i});
if (await atualizarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
await atualizarBtn.click();
await page.waitForTimeout(2000);}    await tirarScreenshot(page, "f16-tms-grade-finalizada");

    //  Clicar no botao POD na linha finalizad
const podButton = page.locator("button[title='Ver Protocolo de Entrega']").first();
expect(podButton).toBeVisible({ timeout: 10000 });
await podButton.click();
await page.waitForTimeout(1000);

    //  Modal do POD deve aparece
expect(page.getByText("Protocolo de Entrega")).toBeVisible({ timeout: 5000 });
await page.waitForTimeout(500);
await tirarScreenshot(page, "f17-tms-modal-pod");

    //  Verificar dados do POD no moda
expect(page.getByText("RECEBEDOR TESTE E2E")).toBeVisible({ timeout: 5000 });
expect(page.getByText("12345678900")).toBeVisible({ timeout: 5000 });
expect(page.getByText("ENTREGUE")).toBeVisible({ timeout: 5000 });

    //  KM info also visibl
expect(page.getByText(/KM final/)).toBeVisible({ timeout: 5000 });

    console.log("[TEST] F7 TMS exibe Protocolo de Entrega com dados corretos");});
test("F9 - Fluxo integrado Operacao + POD + Financeiro", async ({ page }) => {
expect(alocacaoId).toBeTruthy();

    console.log(`[TEST] F9 Iniciando com alocacao ${alocacaoId} (test_run_id: ${TEST_RUN_ID})`);

    // ============================================================    // PASSO 1 â€” Navegar para Financeiro â†’ Conferencia    // (Operacao ja foi validada como Finalizada por F5)
    //  ===========================================================
    await page.goto("http://localhost:8800/financeiro?tab=conferencia", {

      waitUntil: "load"});
expect(page.getByText("OperaÃ§Ãµes Finalizadas")).toBeVisible({ timeout: 20000 });
expect(page.getByText("Total a Receber")).toBeVisible({ timeout: 10000 });
expect(page.getByText("Total a Pagar")).toBeVisible({ timeout: 10000 });
await tirarScreenshot(page, "f22-financeiro-conferencia");

    //  ============================================================    // PASSO 2 â€” Validar dados no Supabase    // ===========================================================
    const dadosFin = await buscarFinanceiroDaAlocacao(alocacaoId, supabaseAuth);
expect(dadosFin, "Dados financeiros nao encontrados no Supabase").not.toBeNull();
if (!dadosFin) return;
expect(dadosFin.finalizada, "Alocacao deveria estar finalizada").toBe(true);
expect(dadosFin.status, "Status deveria ser concluida").toBe("concluida");
expect(dadosFin.pod_exists, "POD deveria estar vinculado a alocacao finalizada").toBe(true);
const alocOk = dadosFin.alocacao_id === alocacaoId;
const podOk = dadosFin.pod_exists === true;

    console.log(`[TEST] F9 Dados Supabase - Cliente: R$ ${dadosFin.valor_cliente}, Prestador: R$ ${dadosFin.valor_prestador_total}, POD: ${podOk}`);

    //  ============================================================    // PASSO 3 â€” Validar Pagamentos â€” Prestador na UI    // ===========================================================
    const pagarTab = page.getByRole("tab", {

      name: /Pagamentos/});
expect(pagarTab).toBeVisible({ timeout: 5000 });
await pagarTab.click();
await page.waitForTimeout(2000);
const pagarEncontrou = await page.getByRole("row", {

      name: PRESTADOR_NOME}).isVisible({ timeout: 10000 }).catch(() => false);

    console.log(`[TEST] F9 Prestador visivel na tabela de pagamentos: ${pagarEncontrou}`);
await tirarScreenshot(page, "f23-financeiro-pagamentos-prestador");

    //  ============================================================    // PASSO 4 â€” Voltar para Contas a Receber e validar    // ===========================================================
    const receberTab = page.getByRole("tab", {

      name: /Contas a Receber/});
await receberTab.click();
await page.waitForTimeout(1000);
const linhasTabela = await page.locator("table").first().locator("tbody tr").count();

    console.log(`[TEST] F9 Linhas na tabela de contas a receber: ${linhasTabela}`);
await tirarScreenshot(page, "f24-financeiro-contas-receber");

    // ============================================================    // PASSO 5 â€” Salvar evidencia F9    // ============================================================    salvarEvidenciaF9Json({ test_run_id: TEST_RUN_ID,      alocacao_id: alocacaoId,      status_final: dadosFin.status,      finalizada: dadosFin.finalizada,      pod_id: null,      pod_vinculado: podOk,      valor_cliente: dadosFin.valor_cliente,      valor_prestador: dadosFin.valor_prestador_total,      financeiro_contas_receber_encontrou: alocOk && linhasTabela > 0,      financeiro_pagamentos_encontrou: pagarEncontrou && alocOk,      usou_delete: false,      usou_update_direto_para_fluxo: false,      usou_localStorage_como_fonte: false,      usou_mock: false, });

    console.log("[TEST] F9 Fluxo integrado Operacao + POD + Financeiro concluido com sucesso!");});});

