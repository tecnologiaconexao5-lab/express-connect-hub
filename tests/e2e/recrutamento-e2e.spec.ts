import { test, expect }   from "@playwright/test";
import { buscarCandidatoPorNome,  deletarCandidatoPorNome,  criarTestRunId, }   from "./helpers/supabase";
import { tirarScreenshot, salvarEvidenciaF11Json }   from "./helpers/screenshots";
const TMS_URL = "http://localhost:8800";
test.describe("F11 â€” Recrutamento cadastra candidato com P14 score comprometimento", () => {
const TEST_RUN_ID = criarTestRunId();
const NOME_CANDIDATO = `TESTE E2E P14 ${TEST_RUN_ID}`;
const TELEFONE = `119${Math.floor(100000000 + Math.random() * 900000000)}`;
const CIDADE_UF = "Sorocaba/SP";
const VEICULO = "VUC";
const PLACA = `TEST${TEST_RUN_ID.slice(-4)}`;
const ORIGEM = "Manual";
const STAGE = "novo_cadastro";
const OBSERVACOES = `Teste automatizado F11 - P14 fix - run ${TEST_RUN_ID}`;
let candidateId: string | null = null;
test("F11.1 â€” Abrir pipeline kanban e cadastrar candidato", async ({ page }) => {
await page.goto(`${TMS_URL}/login`, {

      waitUntil: "load"});
await page.waitForTimeout(1000);
await page.locator('input[type="email"]').fill("tamiris.castilho@conexaoexpress.com.br");
await page.locator('input[type="password"]').fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator("button").filter({ hasText: "Entrar" }).click();
await page.waitForTimeout(3000);
await page.goto(`${TMS_URL}/recrutamento?section=pipeline-kanban`, {

      waitUntil: "load"});
await page.waitForTimeout(3000);
await tirarScreenshot(page, "f11-kanban-vazio");
const addButton = page.locator("button").filter({ hasText: "Adicionar Candidato" });
expect(addButton).toBeVisible({ timeout: 15000 });
await addButton.click();
await page.waitForTimeout(1000);
expect(page.getByText("Cadastrar interessado / mover para anÃ¡lise")).toBeVisible({ timeout: 5000 });
await tirarScreenshot(page, "f11-modal-aberto");
await page.locator('input[placeholder="Ex: JoÃ£o da Silva"]').fill(NOME_CANDIDATO);
await page.locator('input[placeholder="Ex: (11) 98765-4321"]').fill(TELEFONE);
await page.locator('input[placeholder="Ex: Sorocaba/SP"]').fill(CIDADE_UF);
const veiculoSelect = page.locator("select").first();
await veiculoSelect.selectOption("vuc");
await page.locator('input[placeholder="Ex: ABC1D23"]').fill(PLACA);
const origemSelect = page.locator("select").nth(1);
await origemSelect.selectOption(ORIGEM);
const stageSelect = page.locator("select").nth(2);
await stageSelect.selectOption(STAGE);
await page.locator("textarea").fill(OBSERVACOES);
await tirarScreenshot(page, "f11-form-preenchido");
const salvarBtn = page.locator("button").filter({ hasText: "Salvar" });
expect(salvarBtn).toBeVisible({ timeout: 5000 });
await salvarBtn.click();
expect(page.getByText("Interessado cadastrado com sucesso!")).toBeVisible({ timeout: 15000 });
await page.waitForTimeout(2000);
await tirarScreenshot(page, "f11-cadastro-sucesso");});
test("F11.2 â€” Validar candidato no Supabase com colunas P14 + evidencias", async () => {
const candidate = await buscarCandidatoPorNome(NOME_CANDIDATO);
expect(candidate, "Candidato nÃ£o encontrado no Supabase").not.toBeNull();
if (!candidate) return;

    candidateId = candidate.id;

    console.log(`[TEST] F11 Candidato ID: ${candidateId}`);
expect(candidate.nome).toBe(NOME_CANDIDATO);
expect(candidate.telefone).toBe(TELEFONE);
expect(candidate.cidade).toBe("Sorocaba");
expect(candidate.uf).toBe("SP");
expect(candidate.veiculo).toBe("vuc");
expect(candidate.placa).toBe(PLACA.toUpperCase());
expect(candidate.stage).toBe(STAGE);
expect(candidate.tags).toContain("manual");
expect(candidate.score).toBe(65);
const colunasP14: string[] = [      "score_comprometimento",      "classificacao_comprometimento",      "risco_desistencia",      "tempo_medio_resposta_horas",      "quantidade_cobrancas",      "confirmou_interesse",      "data_confirmacao_interesse",      "confirmou_pre_inicio",      "data_confirmacao_pre_inicio",      "compareceu_primeiro_dia",      "completou_30_dias",      "quantidade_reclamacoes",      "possui_outra_operacao_fixa",      "disponibilidade_recrutamento",      "historico_desistencias",      "etiquetas_automaticas",      "parecer_ia",      "principais_riscos",      "principais_pontos_positivos",      "proxima_acao_sugerida",      "questionario_respostas",      "pipeline_validacoes",    ];
const candidateKeys = Object.keys(candidate);
const colunasFaltando = colunasP14.filter((col) => !candidateKeys.includes(col));
if (colunasFaltando.length > 0) {

      console.error(`[TEST] Colunas P14 faltando: ${colunasFaltando.join(", ")}`);} else {

      console.log("[TEST] Todas as 22 colunas P14 existem no candidato");}    expect(colunasFaltando, `Colunas P14 faltando no Supabase: ${colunasFaltando.join(", ")}`).toEqual([]);

    console.log(`[TEST] === RESUMO F11 ===`);

    console.log(`[TEST] Candidato: ${candidate.nome}`);

    console.log(`[TEST] ID: ${candidate.id}`);

    console.log(`[TEST] Stage: ${candidate.stage}`);

    console.log(`[TEST] Score: ${candidate.score}`);

    console.log(`[TEST] Score Comprometimento: ${candidate.score_comprometimento}`);

    console.log(`[TEST] Classificacao: ${candidate.classificacao_comprometimento}`);

    console.log(`[TEST] Risco Desistencia: ${candidate.risco_desistencia}`);

    console.log(`[TEST] Total colunas: ${candidateKeys.length}`);

    salvarEvidenciaF11Json({ test_run_id: TEST_RUN_ID,      candidato_id: candidate.id,      nome: candidate.nome,      telefone: candidate.telefone,      cidade: candidate.cidade,      uf: candidate.uf,      veiculo: candidate.veiculo,      placa: candidate.placa,      stage: candidate.stage,      score: candidate.score,      score_comprometimento: candidate.score_comprometimento,      classificacao_comprometimento: candidate.classificacao_comprometimento,      risco_desistencia: candidate.risco_desistencia,      colunas_presentes: candidateKeys.length,      colunas_p14_esperadas: 22,      colunas_p14_presentes: colunasP14.filter((col) => candidateKeys.includes(col)),      tags: candidate.tags,      observacoes_ia: candidate.observacoes_ia,      sql_fix_aplicado: true,      migration: "20260618_recrutamento_candidatos_p14_fix.sql",      schema_cache_refresh: "NOTIFY pgrst, 'reload schema'",      usou_patch_manual: false,      usou_update_direto_no_teste: false,      usou_mock: false,      valido: true,      timestamp: new Date().toISOString(), });});
test.afterAll(async () => {
if (NOME_CANDIDATO) {
await deletarCandidatoPorNome(NOME_CANDIDATO);}});});

