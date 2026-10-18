// ============================================================================
// Cenário 4 — TMS-01-SEC / RLS: "Motorista A" NÃO acessa dados de "Motorista B"
// ----------------------------------------------------------------------------
// Provê DOIS motoristas independentes (auth user + prestador + veículo +
// alocação) via service role. Loga como Motorista A (JWT real em auth.uid()) e
// prova que ele não consegue SELECT nem UPDATE em dados de terceiros nas
// tabelas: ordens_servico, financeiro_receber, financeiro_pagar e veiculos.
//
// Políticas de produção (full_production_schema_20260920.sql):
//   ordens_servico     → os_select_own (cliente) / os_select_tms (tenant_usuarios)
//   financeiro_receber → fr_select_own (cliente) / fr_select_tms (tenant_usuarios)
//   financeiro_pagar   → apenas fp_*_tms (tenant_usuarios)
//   veiculos           → veiculos_select_tms / veiculos_select_portal (cliente)
//   alocacoes_escala   → "Prestador can view/update own alocacoes" (positivo)
// Motorista sem linha em tenant_usuarios → deve enxergar 0 linhas nas 4 alvo.
//
// GAP conhecido (test.fail): pagamentos_prestadores tem
//   "Allow all pagamentos_prestadores" FOR ALL TO public USING (true)  → vaza.
//
// Requisitos: SUPABASE_SERVICE_ROLE_KEY + ambiente NÃO produtivo.
// ============================================================================
import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  criarClienteAdmin,
  criarClienteMotorista,
  provisionarMotoristaMock,
  limparFixtureMotorista,
  type FixtureMotorista,
} from "./helpers/idempotencia";
import { ler, atualizar, inserir, contemId } from "./helpers/rls";

test.describe.configure({ mode: "serial" });

test.describe("TMS-01-SEC — RLS: Motorista A isolado de terceiros", () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Defina SUPABASE_SERVICE_ROLE_KEY (fixture + leitura admin + cleanup).",
  );

  let admin: SupabaseClient;
  let motoristaA: SupabaseClient; // atacante
  let fixtureA: FixtureMotorista; // atacante
  let fixtureB: FixtureMotorista; // vítima
  let osB: string;
  let veiculoB: string;

  test.beforeAll(async () => {
    admin = criarClienteAdmin();

    fixtureA = await provisionarMotoristaMock();
    fixtureB = await provisionarMotoristaMock();

    const auth = await criarClienteMotorista(fixtureA.email, fixtureA.password);
    motoristaA = auth.client;

    osB = fixtureB.alocacaoId; // M66 cria a OS com o mesmo id da alocação (sem OS vinculada)
    expect(fixtureB.veiculoId, "fixture B deveria ter veículo").toBeTruthy();
    veiculoB = fixtureB.veiculoId as string;

    console.log(
      `[E2E Cenário 4] A(prestador=${fixtureA.prestadorId}) B(prestador=${fixtureB.prestadorId}) ` +
        `osB=${osB} veiculoB=${veiculoB}`,
    );
  });

  test.afterAll(async () => {
    if (fixtureA) await limparFixtureMotorista(fixtureA);
    if (fixtureB) await limparFixtureMotorista(fixtureB);
  });

  test("0. Sanidade (admin): os dados da vítima existem de fato", async () => {
    const os = await ler(admin, "ordens_servico", "id", osB, "id, numero, status");
    expect(os.linhas.length, "OS da vítima deve existir (M66)").toBeGreaterThan(0);

    const receber = await ler(admin, "financeiro_receber", "os_id", osB, "id, os_id, valor");
    expect(receber.linhas.length, "financeiro_receber da vítima deve existir").toBeGreaterThan(0);

    const pagar = await ler(admin, "financeiro_pagar", "os_id", osB, "id, os_id, valor");
    expect(pagar.linhas.length, "financeiro_pagar da vítima deve existir").toBeGreaterThan(0);

    const veic = await ler(admin, "veiculos", "id", veiculoB, "id, placa");
    expect(veic.linhas.length, "veículo da vítima deve existir").toBeGreaterThan(0);
  });

  test("1. SELECT ordens_servico: A não lê a OS de B", async () => {
    const porId = await ler(motoristaA, "ordens_servico", "id", osB, "id, numero");
    expect(porId.bloqueado, `Motorista A obteve a OS de B: ${JSON.stringify(porId.linhas)}`).toBe(true);
    expect(contemId(porId.linhas, "id", osB)).toBe(false);

    const lista = await ler(motoristaA, "ordens_servico", undefined, undefined, "id");
    expect(contemId(lista.linhas, "id", osB), "OS de B não pode aparecer na listagem de A").toBe(false);
  });

  test("2. UPDATE ordens_servico: A não altera a OS de B", async () => {
    const antes = await ler(admin, "ordens_servico", "id", osB, "id, status");
    const statusAntes = String(antes.linhas[0]?.status);

    const tentativa = await atualizar(motoristaA, "ordens_servico", { status: "cancelada" }, "id", osB);
    expect(tentativa.bloqueado, "A conseguiu atualizar a OS de B").toBe(true);

    const depois = await ler(admin, "ordens_servico", "id", osB, "id, status");
    expect(String(depois.linhas[0]?.status), "status da OS de B foi alterado").toBe(statusAntes);
  });

  test("3. SELECT financeiro_receber: A não lê o recebível de B", async () => {
    const r = await ler(motoristaA, "financeiro_receber", "os_id", osB, "id, os_id, valor");
    expect(r.bloqueado, `A viu recebível de B: ${JSON.stringify(r.linhas)}`).toBe(true);

    const lista = await ler(motoristaA, "financeiro_receber", undefined, undefined, "os_id");
    expect(contemId(lista.linhas, "os_id", osB)).toBe(false);
  });

  test("4. SELECT financeiro_pagar: A não lê a conta a pagar de B", async () => {
    const r = await ler(motoristaA, "financeiro_pagar", "os_id", osB, "id, os_id, valor");
    expect(r.bloqueado, `A viu financeiro_pagar de B: ${JSON.stringify(r.linhas)}`).toBe(true);

    const lista = await ler(motoristaA, "financeiro_pagar", undefined, undefined, "os_id");
    expect(contemId(lista.linhas, "os_id", osB)).toBe(false);
  });

  test("5. UPDATE financeiro_pagar: A não altera a conta a pagar de B", async () => {
    const antes = await ler(admin, "financeiro_pagar", "os_id", osB, "id, valor");
    const valorAntes = Number(antes.linhas[0]?.valor);

    const tentativa = await atualizar(motoristaA, "financeiro_pagar", { valor: 1 }, "os_id", osB);
    expect(tentativa.bloqueado, "A conseguiu alterar financeiro_pagar de B").toBe(true);

    const depois = await ler(admin, "financeiro_pagar", "os_id", osB, "id, valor");
    expect(Number(depois.linhas[0]?.valor), "valor de financeiro_pagar de B foi alterado").toBe(valorAntes);
  });

  test("6. SELECT veiculos: A não lê o veículo de B", async () => {
    const r = await ler(motoristaA, "veiculos", "id", veiculoB, "id, placa");
    expect(r.bloqueado, `A viu veículo de B: ${JSON.stringify(r.linhas)}`).toBe(true);
    expect(contemId(r.linhas, "id", veiculoB)).toBe(false);
  });

  test("7. UPDATE veiculos: A não altera o veículo de B", async () => {
    const antes = await ler(admin, "veiculos", "id", veiculoB, "id, status");
    const statusAntes = String(antes.linhas[0]?.status);

    const tentativa = await atualizar(motoristaA, "veiculos", { status: "inativo" }, "id", veiculoB);
    expect(tentativa.bloqueado, "A conseguiu alterar o veículo de B").toBe(true);

    const depois = await ler(admin, "veiculos", "id", veiculoB, "id, status");
    expect(String(depois.linhas[0]?.status), "status do veículo de B foi alterado").toBe(statusAntes);
  });

  test("8. INSERT financeiro_receber: A não cria lançamento para B", async () => {
    const tentativa = await inserir(motoristaA, "financeiro_receber", {
      os_id: osB,
      descricao: "INJECAO E2E (nao deveria passar)",
      valor: 999999,
      status: "aberto",
      tenant_id: "00000000-0000-0000-0000-000000000001",
    });
    expect(tentativa.bloqueado, "A inseriu lançamento financeiro de terceiro").toBe(true);

    const lista = await ler(admin, "financeiro_receber", "os_id", osB, "id, valor");
    const injetado = lista.linhas.some((l) => Number(l.valor) === 999999);
    expect(injetado, "lançamento injetado por A foi persistido").toBe(false);
  });

  test("9. Controle positivo: A enxerga a PRÓPRIA alocação", async () => {
    const propria = await ler(motoristaA, "alocacoes_escala", "id", fixtureA.alocacaoId, "id, prestador_id");
    expect(propria.bloqueado, "A deveria enxergar a própria alocação").toBe(false);
    expect(contemId(propria.linhas, "id", fixtureA.alocacaoId)).toBe(true);
  });

  test("10. Controle negativo: A NÃO enxerga a alocação de B", async () => {
    const deTerceiro = await ler(motoristaA, "alocacoes_escala", "id", fixtureB.alocacaoId, "id, prestador_id");
    expect(deTerceiro.bloqueado, "A enxergou a alocação de B").toBe(true);
    expect(contemId(deTerceiro.linhas, "id", fixtureB.alocacaoId)).toBe(false);
  });

  test("11. [GAP CONHECIDO] pagamentos_prestadores deveria isolar por prestador", async () => {
    // Marcado como falha esperada enquanto a política for USING(true).
    // Se a RLS for corrigida, este teste passa e o runner sinaliza
    // "expected to fail but passed" — gatilho para remover o test.fail().
    test.fail();
    const r = await ler(motoristaA, "pagamentos_prestadores", "os_id", osB, "id, os_id, prestador_id");
    expect(
      r.bloqueado,
      "VAZAMENTO: Motorista A enxerga pagamentos_prestadores de terceiros " +
        "(política atual FOR ALL TO public USING(true)).",
    ).toBe(true);
  });
});
