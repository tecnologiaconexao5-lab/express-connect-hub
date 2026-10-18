/**
 * MISSÃO 104-A — Teste de propagação financeira do trigger M66 corrigido
 *
 * Valida que ao criar uma alocação (INSERT em alocacoes_escala), as tabelas
 * financeiras são populadas automaticamente com status 'pendente',
 * e ao concluir a alocação, os status são atualizados para 'aberto'.
 *
 * Uso: npx tsx scripts/m104a_test_propagacao_financeira.ts
 *
 * Pré-requisitos:
 *   - .env com VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   - Migration M104A aplicada no Supabase
 *   - Dados reais existentes (clientes, prestadores, veiculos)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessários no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} — ${detail || "falhou"}`);
    failed++;
    failures.push(`${label}: ${detail || "falhou"}`);
  }
}

function section(title: string) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(72)}`);
}

async function checkTableCount(table: string, osId: string, expected: number, label: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("os_id", osId);
  if (error) {
    assert(label, false, `Erro query: ${error.message}`);
    return;
  }
  assert(label, count === expected, `Esperado ${expected}, encontrado ${count}`);
}

// =============================================================================
// 1. CONFIG
// =============================================================================
section("1. CONFIGURAÇÃO");

const { data: clientes, error: errClientes } = await supabase
  .from("clientes")
  .select("id, nome_fantasia")
  .limit(1);
if (errClientes || !clientes?.length) {
  console.error("❌ Nenhum cliente encontrado no banco. Execute seed primeiro.");
  process.exit(1);
}
const clienteTest = clientes[0];
console.log(`  📋 Cliente: ${clienteTest.nome_fantasia} (${clienteTest.id})`);

const { data: prestadores, error: errPrest } = await supabase
  .from("prestadores")
  .select("id, nome_completo")
  .limit(1);
if (errPrest || !prestadores?.length) {
  console.error("❌ Nenhum prestador encontrado.");
  process.exit(1);
}
const prestadorTest = prestadores[0];
console.log(`  📋 Prestador: ${prestadorTest.nome_completo} (${prestadorTest.id})`);

const { data: veiculos, error: errVeic } = await supabase
  .from("veiculos")
  .select("id, placa, tipo_veiculo")
  .limit(1);
if (errVeic || !veiculos?.length) {
  console.error("❌ Nenhum veículo encontrado.");
  process.exit(1);
}
const veiculoTest = veiculos[0];
console.log(`  📋 Veículo: ${veiculoTest.placa} (${veiculoTest.tipo_veiculo})`);

const hoje = new Date().toISOString().split("T")[0];

// =============================================================================
// 2. CRIAR ALOCAÇÃO — Testar trigger M104A no INSERT
// =============================================================================
section("2. CRIAR ALOCAÇÃO — Testar trigger M104A no INSERT");

const VALOR_CLIENTE = 2500.00;
const VALOR_REPASSE = 1200.00;
const VALOR_PEDAGIO = 80.00;
const VALOR_ADICIONAL = 150.00;
const VALOR_AJUDANTE = 100.00;
const VALOR_DESCONTO = 40.00;

const { data: alocacao, error: errAloc } = await supabase
  .from("alocacoes_escala")
  .insert([{
    cliente_id: clienteTest.id,
    prestador_id: prestadorTest.id,
    tipo_veiculo: veiculoTest.tipo_veiculo,
    placa: veiculoTest.placa,
    origem: "M104A TEST ORIGEM",
    destino: "M104A TEST DESTINO",
    data_escala: hoje,
    status: "planejada",
    valor_frete: VALOR_CLIENTE,
    valor_repasse: VALOR_REPASSE,
    valor_pedagio: VALOR_PEDAGIO,
    valor_adicional: VALOR_ADICIONAL,
    valor_ajudante: VALOR_AJUDANTE,
    valor_desconto: VALOR_DESCONTO,
  }])
  .select("id, ordem_servico_id, status")
  .single();

assert("Alocação criada com sucesso", !errAloc && alocacao?.id, errAloc?.message);
if (!alocacao?.id) {
  console.error("❌ Não foi possível criar alocação. Abortando.");
  process.exit(1);
}
const alocId = alocacao.id;
const osId = alocacao.ordem_servico_id || alocId;
console.log(`  📋 Alocação ID: ${alocId}`);
console.log(`  📋 OS ID (usado como referência): ${osId}`);
console.log(`  📋 Status inicial: ${alocacao.status}`);

// Aguardar trigger disparar
await new Promise((r) => setTimeout(r, 2000));

// =============================================================================
// 3. VALIDAR PROPAGAÇÃO — INSERT deve gerar registros financeiros
// =============================================================================
section("3. VALIDAR PROPAGAÇÃO NO INSERT — Tabelas financeiras criadas");

await checkTableCount("financeiro_receber", osId, 1,
  "financeiro_receber: 1 registro criado no INSERT");
await checkTableCount("financeiro_pagar", osId, 1,
  "financeiro_pagar: 1 registro criado no INSERT");
await checkTableCount("pagamentos_prestadores", osId, 1,
  "pagamentos_prestadores: 1 registro criado no INSERT");
await checkTableCount("ordens_servico", osId, 1,
  "ordens_servico: 1 registro criado no INSERT");

// =============================================================================
// 4. VALIDAR VALORES E STATUS — Financeiro com status 'pendente'
// =============================================================================
section("4. VALIDAR VALORES — Status pendente na criação");

const { data: rec } = await supabase
  .from("financeiro_receber")
  .select("valor, status, cliente_id")
  .eq("os_id", osId)
  .maybeSingle();

assert("Receber valor = 2500", rec?.valor === VALOR_CLIENTE, `Valor: ${rec?.valor}`);
assert("Receber status = pendente (alocação não concluída)", rec?.status === "pendente", `Status: ${rec?.status}`);
assert("Receber cliente_id = UUID do cliente", rec?.cliente_id === clienteTest.id, `cliente_id: ${rec?.cliente_id}`);

const { data: pagar } = await supabase
  .from("financeiro_pagar")
  .select("valor, status, fornecedor_id")
  .eq("os_id", osId)
  .maybeSingle();

assert("Pagar valor = 1200", pagar?.valor === VALOR_REPASSE, `Valor: ${pagar?.valor}`);
assert("Pagar status = pendente (alocação não concluída)", pagar?.status === "pendente", `Status: ${pagar?.status}`);
assert("Pagar fornecedor_id = UUID prestador", pagar?.fornecedor_id === prestadorTest.id, `fornecedor_id: ${pagar?.fornecedor_id}`);

const { data: pgto } = await supabase
  .from("pagamentos_prestadores")
  .select("valor_liquido, valor_servicos, pedagio, adicionais, status_conferencia, status_pagamento")
  .eq("os_id", osId)
  .maybeSingle();

if (pgto) {
  const outrosCustosEsperado = VALOR_ADICIONAL + VALOR_AJUDANTE - VALOR_DESCONTO; // 150+100-40 = 210
  const valorLiquidoEsperado = VALOR_REPASSE + VALOR_PEDAGIO + outrosCustosEsperado; // 1200+80+210 = 1490

  assert("Pgto valor_servicos = 1200", pgto.valor_servicos === VALOR_REPASSE, `${pgto.valor_servicos}`);
  assert("Pgto pedagio = 80", pgto.pedagio === VALOR_PEDAGIO, `${pgto.pedagio}`);
  assert("Pgto adicionais = 210 (adicional+ajudante-desconto)", pgto.adicionais === outrosCustosEsperado, `${pgto.adicionais}`);
  assert("Pgto valor_liquido = 1490", pgto.valor_liquido === valorLiquidoEsperado, `${pgto.valor_liquido}`);
  assert("Pgto status_conferencia = pendente", pgto.status_conferencia === "pendente", `${pgto.status_conferencia}`);
  assert("Pgto status_pagamento = nao_vencido", pgto.status_pagamento === "nao_vencido", `${pgto.status_pagamento}`);
}

// composicao_financeira_os NÃO deve existir — só é criada na conclusão
const { count: compCount } = await supabase
  .from("composicao_financeira_os")
  .select("id", { count: "exact", head: true })
  .eq("os_id", osId);
assert("composicao_financeira_os: NÃO criada (só na conclusão)", compCount === 0, `Count: ${compCount}`);

// =============================================================================
// 5. CONCLUIR ALOCAÇÃO — Status deve mudar para 'aberto'
// =============================================================================
section("5. CONCLUIR ALOCAÇÃO — Status deve mudar para aberto");

const { error: errConc } = await supabase
  .from("alocacoes_escala")
  .update({ status: "concluida", finalizada: true })
  .eq("id", alocId);

assert("Alocação concluída", !errConc, errConc?.message);
await new Promise((r) => setTimeout(r, 2000));

// =============================================================================
// 6. VALIDAR ATUALIZAÇÃO — Status mudou para 'aberto'
// =============================================================================
section("6. VALIDAR ATUALIZAÇÃO — Status financeiro agora é aberto");

const { data: recConcluido } = await supabase
  .from("financeiro_receber")
  .select("valor, status")
  .eq("os_id", osId)
  .maybeSingle();
assert("Receber status = aberto (após conclusão)", recConcluido?.status === "aberto", `Status: ${recConcluido?.status}`);

const { data: pagarConcluido } = await supabase
  .from("financeiro_pagar")
  .select("valor, status")
  .eq("os_id", osId)
  .maybeSingle();
assert("Pagar status = aberto (após conclusão)", pagarConcluido?.status === "aberto", `Status: ${pagarConcluido?.status}`);

const { data: pgtoConcluido } = await supabase
  .from("pagamentos_prestadores")
  .select("status_conferencia, status_pagamento")
  .eq("os_id", osId)
  .maybeSingle();
assert("Pgto status_conferencia = em_aberto (após conclusão)", pgtoConcluido?.status_conferencia === "em_aberto", `${pgtoConcluido?.status_conferencia}`);

// =============================================================================
// 7. VALIDAR COMPOSIÇÃO FINANCEIRA — Criada na conclusão
// =============================================================================
section("7. VALIDAR COMPOSIÇÃO FINANCEIRA — Criada na conclusão");

const { data: comp } = await supabase
  .from("composicao_financeira_os")
  .select("*")
  .eq("os_id", osId)
  .maybeSingle();

assert("composicao_financeira_os: 1 registro na conclusão", !!comp, "Sem composição encontrada");

if (comp) {
  const outrosCustosEsperado = VALOR_ADICIONAL + VALOR_AJUDANTE - VALOR_DESCONTO; // 210
  const margemBrutaEsperada = VALOR_CLIENTE - VALOR_REPASSE - VALOR_PEDAGIO - outrosCustosEsperado; // 2500-1200-80-210 = 1010
  const impostoEsperado = +(VALOR_CLIENTE * 4.5 / 100).toFixed(2); // 112.5
  const seguroEsperado = +(VALOR_CLIENTE * 1 / 100).toFixed(2); // 25
  const margemLiquidaEsperada = +(margemBrutaEsperada - impostoEsperado - seguroEsperado).toFixed(2); // 1010-112.5-25 = 872.5

  assert("comp.valor_cliente = 2500", comp.valor_cliente === VALOR_CLIENTE, `${comp.valor_cliente}`);
  assert("comp.valor_prestador = 1200", comp.valor_prestador === VALOR_REPASSE, `${comp.valor_prestador}`);
  assert("comp.pedagio_valor = 80", comp.pedagio_valor === VALOR_PEDAGIO, `${comp.pedagio_valor}`);
  assert("comp.outros_custos = 210 (adicional+ajudante-desconto)", comp.outros_custos === outrosCustosEsperado, `${comp.outros_custos}`);
  assert("comp.adicional_valor = 150", comp.adicional_valor === VALOR_ADICIONAL, `${comp.adicional_valor}`);
  assert("comp.ajudante_valor = 100", comp.ajudante_valor === VALOR_AJUDANTE, `${comp.ajudante_valor}`);
  assert("comp.desconto_valor = 40", comp.desconto_valor === VALOR_DESCONTO, `${comp.desconto_valor}`);
  assert("comp.margem_bruta = 1010", Math.abs(comp.margem_bruta - margemBrutaEsperada) < 0.02, `${comp.margem_bruta}`);
  assert("comp.margem_liquida = 872.5", Math.abs(comp.margem_liquida - margemLiquidaEsperada) < 0.02, `${comp.margem_liquida}`);
  assert("comp.origem_calculo = escala_direta", comp.origem_calculo === "escala_direta", `${comp.origem_calculo}`);
}

// =============================================================================
// 8. VALIDAR DUPLICIDADE — UNIQUE(os_id) rejeita duplicatas
// =============================================================================
section("8. VALIDAR PROTEÇÃO CONTRA DUPLICIDADE");

const testUnique = async (table: string, label: string) => {
  const { error } = await supabase
    .from(table as any)
    .insert([{ os_id: osId, descricao: "M104A DUPLICATE TEST", valor: 1 }])
    .maybeSingle();
  assert(`${label}: UNIQUE(os_id) rejeita duplicata`, !!error, error?.message || "sem erro");
};

await testUnique("financeiro_receber", "financeiro_receber");
await testUnique("financeiro_pagar", "financeiro_pagar");

// =============================================================================
// 9. VALIDAR VALOR_FIXO E KM_REALIZADOS — Criar alocação com esses campos
// =============================================================================
section("9. VALIDAR CAMPOS ADICIONAIS — valor_fixo e km_realizados");

const { data: aloc2 } = await supabase
  .from("alocacoes_escala")
  .insert([{
    cliente_id: clienteTest.id,
    prestador_id: prestadorTest.id,
    tipo_veiculo: veiculoTest.tipo_veiculo,
    placa: veiculoTest.placa,
    origem: "M104A TEST 2 ORIGEM",
    destino: "M104A TEST 2 DESTINO",
    data_escala: hoje,
    status: "planejada",
    valor_frete: 1000.00,
    valor_repasse: 500.00,
    valor_fixo: 500.00,
    km_realizados: 150,
    km_previstos: 200,
  }])
  .select("id, valor_fixo, km_realizados, km_previstos")
  .single();

assert("Alocação 2 criada com valor_fixo e km_realizados", !!aloc2?.id, "Falha ao criar");
if (aloc2) {
  assert("aloc2.valor_fixo = 500", aloc2.valor_fixo === 500, `${aloc2.valor_fixo}`);
  assert("aloc2.km_realizados = 150", aloc2.km_realizados === 150, `${aloc2.km_realizados}`);
  assert("aloc2.km_previstos = 200", aloc2.km_previstos === 200, `${aloc2.km_previstos}`);

  // Verificar propagação financeira
  const osId2 = aloc2.id;
  await new Promise((r) => setTimeout(r, 2000));

  await checkTableCount("financeiro_receber", osId2, 1,
    "Aloc2: financeiro_receber criado");
  await checkTableCount("financeiro_pagar", osId2, 1,
    "Aloc2: financeiro_pagar criado");
  await checkTableCount("pagamentos_prestadores", osId2, 1,
    "Aloc2: pagamentos_prestadores criado");
}

// =============================================================================
// 10. LIMPEZA — Remover dados de teste
// =============================================================================
section("10. LIMPEZA — Remover dados de teste");

// Remover alocação 2 primeiro (cascade cuida do resto)
if (aloc2?.id) {
  const { error: errDel2 } = await supabase
    .from("alocacoes_escala")
    .delete()
    .eq("id", aloc2.id);
  assert("Limpeza: alocação 2 removida", !errDel2, errDel2?.message || "");
}

// Remover alocação principal (cascade)
const { error: errDel1 } = await supabase
  .from("alocacoes_escala")
  .delete()
  .eq("id", alocId);
assert("Limpeza: alocação principal removida", !errDel1, errDel1?.message || "");

// =============================================================================
// 11. RESUMO
// =============================================================================
section("11. RESUMO FINAL");

const total = passed + failed;
console.log(`  Total: ${total} | ✅ Aprovados: ${passed} | ❌ Falhas: ${failed}`);
console.log(`  Percentual: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

if (failures.length > 0) {
  console.log(`\n  Falhas:`);
  for (const f of failures) {
    console.log(`    ❌ ${f}`);
  }
}

if (failed > 0) {
  console.log(`\n  ⚠️  ${failed} teste(s) falharam. Revisar antes de aplicar em produção.`);
  process.exit(1);
} else {
  console.log(`\n  ✅ Todos os testes aprovados. Propagação financeira M104A OK.`);
  console.log(`\n  Regra de ouro cumprida:`);
  console.log(`  Ao criar uma alocação, as tabelas financeiras são populadas automaticamente.`);
}
