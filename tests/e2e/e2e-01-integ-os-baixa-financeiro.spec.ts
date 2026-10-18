// ============================================================================
// E2E-01-INTEG + E2E-02-FIN
// Fluxo completo: Criação da OS/Alocação no TMS -> Baixa no App Prestador ->
//                 Geração automática do Lançamento Financeiro.
// ----------------------------------------------------------------------------
// Cadeia testada:
//   TMS (Escala) cria alocação
//     -> trigger M66 (alocacoes_escala) cria/atualiza:
//          ordens_servico, financeiro_receber, financeiro_pagar,
//          pagamentos_prestadores
//   App Prestador dá a baixa (finaliza com POD)
//     -> status=concluida/finalizada -> trigger M66 cria composicao_financeira_os
//   E2E-02-FIN reconcilia os valores em CENTAVOS EXATOS e checa duplicidade.
//
// Pré-requisitos de ambiente (ver cabeçalho de helpers/financeiro.ts):
//   - Ambiente NÃO produtivo (o global-setup bloqueia produção)
//   - PLAYWRIGHT_TAMIRIS_PASSWORD
//   - E2E_PRESTADOR_ID / E2E_PRESTADOR_NOME (ou defaults abaixo)
//   - SUPABASE_SERVICE_ROLE_KEY (recomendado para leitura sem RLS)
// ============================================================================
import { test, expect, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import {
  criarClienteDados,
  buscarAlocacaoPorDestino,
  buscarAlocacaoPorId,
  capturarSnapshotFinanceiro,
  calcularEsperado,
  reconciliar,
  type AlocacaoFinanceira,
} from "./helpers/financeiro";

// ---------------------------------------------------------------------------
// Configuração por ambiente (sem hard-code de dados de produção)
// ---------------------------------------------------------------------------
const PRESTADOR_ID = process.env.E2E_PRESTADOR_ID || "e6646799-fbac-453e-a3ef-afdfc01a7085";
const PRESTADOR_NOME = process.env.E2E_PRESTADOR_NOME || "PRESTADOR TESTE APP";

const VALOR_FRETE = Number(process.env.E2E_VALOR_FRETE || "1000.00");
const VALOR_REPASSE = Number(process.env.E2E_VALOR_REPASSE || "700.00");
const VALOR_PEDAGIO = Number(process.env.E2E_VALOR_PEDAGIO || "50.00");
const VALOR_ADICIONAL = Number(process.env.E2E_VALOR_ADICIONAL || "30.00");
const VALOR_DESCONTO = Number(process.env.E2E_VALOR_DESCONTO || "80.00");

function novoRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const RUN_ID = novoRunId();
const ORIGEM = `CD ORIGEM E2E ${RUN_ID}`;
const DESTINO = `DESTINO E2E ${RUN_ID}`;

// Estado compartilhado entre os 3 passos (execução serial).
let alocacaoId = "";

test.describe.configure({ mode: "serial" });

test.describe("E2E-01-INTEG / E2E-02-FIN — OS TMS -> Baixa App -> Financeiro", () => {
  test.skip(
    !process.env.PLAYWRIGHT_TAMIRIS_PASSWORD,
    "Defina PLAYWRIGHT_TAMIRIS_PASSWORD (+ E2E_PRESTADOR_ID) para executar em ambiente QA.",
  );

  test.beforeAll(async () => {
    // Preflight: garante que o prestador alvo existe (evita falha tardia no dropdown).
    const client = await criarClienteDados();
    const { data, error } = await client
      .from("prestadores")
      .select("id, nome_completo")
      .eq("id", PRESTADOR_ID)
      .maybeSingle();
    if (error || !data) {
      throw new Error(
        `[E2E-01] Prestador alvo não encontrado (id=${PRESTADOR_ID}). ` +
          `Ajuste E2E_PRESTADOR_ID/E2E_PRESTADOR_NOME. ${error?.message ?? ""}`,
      );
    }
  });

  // =========================================================================
  // PASSO 1 — TMS cria a OS/Alocação (E2E-01-INTEG)
  // =========================================================================
  test("PASSO 1 — TMS cria a alocação/OS na Escala", async ({ page }) => {
    await loginAdmin(page, "e2e01-p1");
    await page.goto("/operacao?tab=escala", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const alocarBtn = page.getByRole("button", { name: /Alocar/ }).first();
    await expect(alocarBtn).toBeVisible({ timeout: 15000 });
    await alocarBtn.click();

    await expect(page.getByText("Gerenciar Alocação de Recurso")).toBeVisible({ timeout: 8000 });

    // Prestador (SearchableSelect)
    const prestadorInput = page.locator('input[placeholder*="Pesquisar prestador"]').first();
    await expect(prestadorInput).toBeVisible({ timeout: 8000 });
    await prestadorInput.fill(PRESTADOR_NOME);
    await page.waitForTimeout(900);
    await clicarOpcaoDropdown(page, PRESTADOR_NOME);

    // Origem / Destino únicos
    await page.locator('input[placeholder*="CD Cajamar"]').first().fill(ORIGEM);
    await page.locator('input[placeholder*="CD Guarulhos"]').first().fill(DESTINO);

    // Valores financeiros (disparam o gatilho M66 ao salvar)
    await preencherValorSeExistir(page, ["Valor frete", "Valor Frete", "Frete"], VALOR_FRETE);
    await preencherValorSeExistir(page, ["Repasse", "Valor repasse"], VALOR_REPASSE);
    await preencherValorSeExistir(page, ["Pedágio", "Pedagio"], VALOR_PEDAGIO);
    await preencherValorSeExistir(page, ["Adicional", "Adicionais"], VALOR_ADICIONAL);
    await preencherValorSeExistir(page, ["Desconto", "Descontos"], VALOR_DESCONTO);

    await page.getByRole("button", { name: /Salvar na Grade/ }).first().click();
    await page.waitForTimeout(3000);

    // Prova no banco (fonte da verdade)
    const client = await criarClienteDados();
    const aloc = await buscarAlocacaoPorDestino(DESTINO, client);
    expect(aloc, `Alocação não encontrada pelo destino único "${DESTINO}"`).not.toBeNull();
    if (!aloc) return;

    alocacaoId = aloc.id;
    console.log(`[E2E-01] PASSO 1 OK — alocacao_id=${alocacaoId} run=${RUN_ID}`);

    // A alocação recém-criada deve estar aguardando aceite e NÃO finalizada.
    expect(aloc.status).toBe("aguardando_aceite");
    expect(aloc.finalizada ?? false).toBeFalsy();
  });

  // =========================================================================
  // PASSO 2 — App Prestador dá a baixa (aceite -> rota -> POD)
  // =========================================================================
  test("PASSO 2 — App Prestador executa a baixa com POD", async ({ page }) => {
    expect(alocacaoId, "PASSO 1 não produziu alocacaoId").toBeTruthy();

    await loginAdmin(page, "e2e01-p2");
    await page.goto("/app-prestador", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Seleciona o perfil/prestador
    const perfilTrigger = page
      .locator('button:has-text("Selecione seu perfil")')
      .first();
    if (await perfilTrigger.isVisible({ timeout: 8000 }).catch(() => false)) {
      await perfilTrigger.click();
      await page.waitForTimeout(500);
      await page.getByRole("option", { name: PRESTADOR_NOME }).first().click();
      await page.waitForTimeout(2500);
    }

    // Aba Viagens
    await page.getByRole("tab", { name: /Viagens/i }).first().click();
    await page.waitForTimeout(2000);

    const card = await localizarCardAlocacao(page, DESTINO);

    // Aceitar
    await card.getByRole("button", { name: /Aceitar/i }).first().click();
    await esperarStatus(alocacaoId, "aceita", 20000);

    // KM inicial -> Iniciar Viagem
    await card.locator('input[placeholder="KM inicial"]').first().fill("100000");
    await card.getByRole("button", { name: /Iniciar Viagem/i }).first().click();
    await esperarStatus(alocacaoId, "em_rota", 20000);

    // KM final -> Finalizar + Comprovante
    await card.locator('input[placeholder="KM final"]').first().fill("100450");
    await card.getByRole("button", { name: /Finalizar \+ Comprovante/i }).first().click();

    // Modal POD
    await expect(page.getByText("Protocolo de Entrega")).toBeVisible({ timeout: 8000 });
    await page.locator('input[placeholder="Nome completo do recebedor"]').first().fill("RECEBEDOR E2E");
    await page.locator('input[placeholder="CPF ou CNPJ do recebedor"]').first().fill("12345678900");

    const fileInputs = page.locator('input[type="file"]');
    const totalFiles = await fileInputs.count();
    for (let i = 0; i < totalFiles; i++) {
      await fileInputs.nth(i).setInputFiles("tests/fixtures/romaneio-teste.png").catch(() => {});
    }
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /Confirmar Entrega/i }).first().click();

    // Prova no banco: status concluído + finalizada
    const finalizada = await esperarStatus(alocacaoId, "concluida", 30000);
    expect(finalizada, "Alocação não chegou a 'concluida'").not.toBeNull();
    if (finalizada) {
      expect(finalizada.finalizada).toBe(true);
    }
    console.log(`[E2E-01] PASSO 2 OK — baixa concluída (alocacao_id=${alocacaoId})`);
  });

  // =========================================================================
  // PASSO 3 — Reconciliação financeira exata (E2E-02-FIN)
  // =========================================================================
  test("PASSO 3 — M66 gerou os lançamentos financeiros sem perder centavos", async () => {
    expect(alocacaoId, "PASSO 1 não produziu alocacaoId").toBeTruthy();

    const client = await criarClienteDados();
    const aloc = (await buscarAlocacaoPorId(alocacaoId, client)) as AlocacaoFinanceira | null;
    expect(aloc, "Alocação não encontrada para reconciliação").not.toBeNull();
    if (!aloc) return;

    // Confere que os valores gravados são os que enviamos (sanidade do PASSO 1)
    expect(Number(aloc.valor_frete)).toBeCloseTo(VALOR_FRETE, 2);
    expect(Number(aloc.valor_repasse)).toBeCloseTo(VALOR_REPASSE, 2);
    expect(Number(aloc.valor_pedagio)).toBeCloseTo(VALOR_PEDAGIO, 2);
    expect(Number(aloc.valor_adicional)).toBeCloseTo(VALOR_ADICIONAL, 2);
    expect(Number(aloc.valor_desconto)).toBeCloseTo(VALOR_DESCONTO, 2);

    // os_id de propagação: OS vinculada se existir, senão o próprio id da alocação.
    const osId = aloc.ordem_servico_id || aloc.id;

    const snapshot = await capturarSnapshotFinanceiro(osId, client);
    expect(snapshot.erros, `Erros de leitura financeira: ${snapshot.erros.join("; ")}`).toEqual([]);

    const esperado = calcularEsperado(aloc);
    const discrepancias = reconciliar(snapshot, esperado, true);

    console.log(
      `[E2E-02-FIN] osId=${osId} | cliente=${esperado.valorCliente} ` +
        `repasse=${esperado.valorRepasse} líquido=${esperado.valorLiquidoPrestador} ` +
        `margem_líquida=${esperado.margemLiquida}`,
    );
    if (discrepancias.length > 0) {
      console.error("[E2E-02-FIN] Discrepâncias:", discrepancasTexto(discrepancias));
    }
    expect(discrepancias.map((d) => d.mensagem)).toEqual([]);

    // Prova final: projeção/liquidação do prestador bate em centavos
    const liquido = snapshot.pagamentos?.[0]?.valor_liquido ?? 0;
    expect(Math.round(Number(liquido) * 100)).toBe(
      Math.round(esperado.valorLiquidoPrestador * 100),
    );

    console.log("[E2E-02-FIN] PASSO 3 OK — reconciliação exata e sem duplicidade.");
  });
});

// ---------------------------------------------------------------------------
// Utilidades locais de UI
// ---------------------------------------------------------------------------

async function clicarOpcaoDropdown(page: Page, texto: string): Promise<void> {
  const porRole = page.getByRole("option", { name: new RegExp(texto, "i") }).first();
  if (await porRole.isVisible({ timeout: 3000 }).catch(() => false)) {
    await porRole.click();
    return;
  }
  const porClasse = page
    .locator("div.absolute.top-full div.cursor-pointer, [data-radix-popper-content-wrapper] div.cursor-pointer")
    .filter({ hasText: texto })
    .first();
  if (await porClasse.isVisible({ timeout: 3000 }).catch(() => false)) {
    await porClasse.click();
    return;
  }
  throw new Error(`Opção "${texto}" não encontrada no dropdown`);
}

async function preencherValorSeExistir(
  page: Page,
  labels: string[],
  valor: number,
): Promise<void> {
  for (const label of labels) {
    const campo = page.locator(`input[placeholder*="${label}"]`).first();
    if (await campo.isVisible({ timeout: 800 }).catch(() => false)) {
      await campo.fill(String(valor));
      return;
    }
  }
  console.warn(`[E2E-01] Campo financeiro não encontrado (aceitável se default): ${labels[0]}`);
}

async function localizarCardAlocacao(page: Page, destino: string) {
  const referencia = page.locator("div.grid.grid-cols-2").filter({ hasText: destino }).first();
  await expect(referencia).toBeVisible({ timeout: 20000 });
  return referencia.locator("xpath=ancestor::div[contains(@class, 'p-5')]").first();
}

async function esperarStatus(
  alocacaoId: string,
  status: string,
  timeoutMs: number,
): Promise<AlocacaoFinanceira | null> {
  const client = await criarClienteDados();
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const aloc = await buscarAlocacaoPorId(alocacaoId, client);
    if (aloc?.status === status) return aloc;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return await buscarAlocacaoPorId(alocacaoId, client);
}

function discrepancasTexto(items: Array<{ mensagem: string }>): string {
  return items.map((d) => ` - ${d.mensagem}`).join("\n");
}
