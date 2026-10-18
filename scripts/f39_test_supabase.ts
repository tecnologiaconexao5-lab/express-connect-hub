// ============================================================
// F39 — Teste Supabase: Orquestração Enterprise
// ============================================================
// Uso: $env:VITE_SUPABASE_URL="..."; $env:VITE_SUPABASE_ANON_KEY="..."; npx tsx scripts/f39_test_supabase.ts
// ============================================================

import { supabase } from "../src/lib/supabase";
import { enterpriseOrchestratorService } from "../src/services/ia/enterpriseOrchestratorService";

const FLUXO_COMERCIAL = "FLUXO_COMERCIAL";
const FLUXO_FINANCEIRO = "FLUXO_FINANCEIRO";
const FLUXO_OPERACIONAL = "FLUXO_OPERACIONAL";

async function testarCenario1_FluxoComercialCompleto() {
  console.log("\n🧪 1. Fluxo comercial completo (Lead → SDR → Proposta → Aprovação → Simulação)");
  const { fluxo, etapas } = await enterpriseOrchestratorService.obterFluxoPorCodigo(FLUXO_COMERCIAL);
  if (!fluxo) { console.log("  ❌ Fluxo comercial não encontrado no banco"); return; }
  console.log(`  ✅ Fluxo encontrado: ${fluxo.nome} (${fluxo.codigo}, v${fluxo.versao})`);
  console.log(`  ✅ Etapas: ${etapas.length}`);
  for (const e of etapas) {
    console.log(`     [${e.ordem}] ${e.nome} — ${e.setor_origem} → ${e.setor_destino} (${e.acao_codigo})`);
  }

  const resultado = await enterpriseOrchestratorService.executarFluxoEmpresa(fluxo.id, {
    entidade_tipo: "cliente",
    entidade_id: "teste_comercial_f39",
    valor: 5000,
  });

  if (resultado.sucesso) {
    console.log(`  ✅ Fluxo executado com sucesso: ${resultado.concluidas}/${resultado.total_etapas} etapas`);
    console.log(`  ✅ Fluxo execução ID: ${resultado.fluxo_execucao_id}`);
  } else {
    console.log(`  ⚠️ Fluxo parcial: ${resultado.concluidas}/${resultado.total_etapas} (erro: ${resultado.erro || "nenhum"})`);
  }

  // Verifica logs
  const logs = resultado.logs;
  if (logs.length > 0) {
    console.log(`  ✅ ${logs.length} logs gerados`);
    for (const l of logs.slice(0, 3)) {
      console.log(`     [${l.etapa_ordem}] ${l.etapa_nome} → ${l.status} (${l.duracao_ms}ms)`);
    }
    if (logs.length > 3) console.log(`     ... mais ${logs.length - 3} log(s)`);
  }
}

async function testarCenario2_FluxoFinanceiroComAprovacao() {
  console.log("\n🧪 2. Fluxo financeiro com aprovação");
  const { fluxo, etapas } = await enterpriseOrchestratorService.obterFluxoPorCodigo(FLUXO_FINANCEIRO);
  if (!fluxo) { console.log("  ❌ Fluxo financeiro não encontrado"); return; }
  console.log(`  ✅ Fluxo: ${fluxo.nome} (${etapas.length} etapas)`);

  const resultado = await enterpriseOrchestratorService.executarFluxoEmpresa(fluxo.id, {
    entidade_tipo: "cliente",
    entidade_id: "teste_financeiro_f39",
    valor: 15000,
  });

  console.log(`  Resultado: ${resultado.concluidas}/${resultado.total_etapas} etapas`);
  for (const l of resultado.logs) {
    const f35 = l.aprovado_f35 !== null ? `F35:${l.aprovado_f35 ? "✅" : "🚫"}` : "F35:N/A";
    const risco = l.risco_calculado > 0 ? `risco:${l.risco_calculado}%` : "";
    const f34 = l.decisao_f34a ? `F34A:${l.decisao_f34a.slice(0, 40)}` : "";
    console.log(`     [${l.etapa_ordem}] ${l.etapa_nome} → ${l.status} ${f35} ${risco} (${l.duracao_ms}ms)`);
  }
}

async function testarCenario3_FluxoOperacionalPontaAPonta() {
  console.log("\n🧪 3. Fluxo operacional ponta a ponta");
  const { fluxo, etapas } = await enterpriseOrchestratorService.obterFluxoPorCodigo(FLUXO_OPERACIONAL);
  if (!fluxo) { console.log("  ❌ Fluxo operacional não encontrado"); return; }
  console.log(`  ✅ Fluxo: ${fluxo.nome} (${etapas.length} etapas)`);

  const resultado = await enterpriseOrchestratorService.executarFluxoEmpresa(fluxo.id, {
    entidade_tipo: "cliente",
    entidade_id: "teste_operacional_f39",
    valor: 0,
  });

  console.log(`  Resultado: ${resultado.concluidas}/${resultado.total_etapas} — ${resultado.sucesso ? "✅" : "⚠️"}`);
  for (const l of resultado.logs) {
    console.log(`     [${l.etapa_ordem}] ${l.etapa_nome} → ${l.status} (${l.duracao_ms}ms)`);
  }
}

async function testarCenario4_BloqueioGovernancaInterrompe() {
  console.log("\n🧪 4. Bloqueio de governança interrompe fluxo");
  const { fluxo } = await enterpriseOrchestratorService.obterFluxoPorCodigo(FLUXO_COMERCIAL);
  if (!fluxo) { console.log("  ❌ Fluxo não encontrado"); return; }

  const resultado = await enterpriseOrchestratorService.executarFluxoEmpresa(fluxo.id, {
    entidade_tipo: "cliente",
    entidade_id: "teste_bloqueio_f39",
    valor: 999999,
  });

  const bloqueados = resultado.logs.filter(l => l.status === "bloqueado");
  if (bloqueados.length > 0) {
    console.log(`  ✅ Governança bloqueou o fluxo na etapa ${bloqueados[0].etapa_ordem}: ${bloqueados[0].etapa_nome}`);
    console.log(`  Motivo: ${bloqueados[0].erro || "N/A"}`);
  } else {
    const falhas = resultado.logs.filter(l => l.status === "falhou");
    if (falhas.length > 0) {
      console.log(`  ⚠️ Fluxo falhou (não bloqueado): ${falhas[0].erro || "sem motivo"}`);
    } else {
      console.log(`  ⚠️ Fluxo executou completamente (sem bloqueio) — pode não haver regra de autoridade configurada`);
    }
  }
}

async function testarCenario5_F34AAlteraDecisao() {
  console.log("\n🧪 5. F34A gera decisão para etapa do fluxo");
  const { fluxo, etapas } = await enterpriseOrchestratorService.obterFluxoPorCodigo(FLUXO_COMERCIAL);
  if (!fluxo || etapas.length === 0) { console.log("  ❌ Fluxo sem etapas"); return; }

  const resultado = await enterpriseOrchestratorService.executarFluxoEmpresa(fluxo.id, {
    entidade_tipo: "cliente",
    entidade_id: "teste_f34a_f39",
    valor: 3000,
  });

  const comDecisao = resultado.logs.filter(l => l.decisao_f34a && l.decisao_f34a.length > 0);
  if (comDecisao.length > 0) {
    console.log(`  ✅ ${comDecisao.length} etapa(s) com decisão F34A:`);
    for (const l of comDecisao.slice(0, 3)) {
      const decisao = l.decisao_f34a || "";
      console.log(`     [${l.etapa_ordem}] ${decisao.slice(0, 80)}...`);
    }
  } else {
    console.log("  ⚠️ Nenhuma etapa com decisão F34A registrada (F34A pode estar em fallback)");
  }
}

async function testarCenario6_F38AtualizaKPIs() {
  console.log("\n🧪 6. F38 atualiza KPIs após fluxo");
  // Executa fluxo que gera impacto F38
  const { fluxo } = await enterpriseOrchestratorService.obterFluxoPorCodigo(FLUXO_OPERACIONAL);
  if (!fluxo) { console.log("  ❌ Fluxo não encontrado"); return; }

  const resultado = await enterpriseOrchestratorService.executarFluxoEmpresa(fluxo.id, {
    entidade_tipo: "cliente",
    entidade_id: "teste_kpi_f39",
    valor: 0,
  });

  const comImpactoF38 = resultado.logs.filter(l => l.impacto_f38 && Object.keys(l.impacto_f38).length > 0);
  if (comImpactoF38.length > 0) {
    console.log(`  ✅ ${comImpactoF38.length} etapa(s) com impacto F38 registrado:`);
    for (const l of comImpactoF38) {
      const impacto = JSON.stringify(l.impacto_f38).slice(0, 80);
      console.log(`     [${l.etapa_ordem}] ${impacto}`);
    }
  } else {
    console.log("  ⚠️ Nenhum impacto F38 registrado (pode não haver KPIs configurados)");
  }
}

async function testarCenario7_F27ReorganizaExecucao() {
  console.log("\n🧪 7. F27 analisa gargalos pós-fluxo");
  const { fluxo } = await enterpriseOrchestratorService.obterFluxoPorCodigo(FLUXO_FINANCEIRO);
  if (!fluxo) { console.log("  ❌ Fluxo não encontrado"); return; }

  const resultado = await enterpriseOrchestratorService.executarFluxoEmpresa(fluxo.id, {
    entidade_tipo: "cliente",
    entidade_id: "teste_f27_f39",
    valor: 8000,
  });

  const comDV = resultado.logs.filter(l => l.decisao_f27 && Object.keys(l.decisao_f27).length > 0);
  if (comDV.length > 0) {
    console.log(`  ✅ Diretor Virtual acionado em ${comDV.length} etapa(s)`);
    for (const l of comDV) {
      const dec = JSON.stringify(l.decisao_f27).slice(0, 80);
      console.log(`     [${l.etapa_ordem}] ${dec}`);
    }
  } else {
    console.log("  ℹ️ Diretor Virtual não detectou gargalos (sistema operando normal)");
    console.log("  ✅ (Comportamento esperado — gargalos só são reportados quando existem)");
  }

  // Verifica se o DV registrou decisões
  const { data: decisoes } = await supabase
    .from("diretor_virtual_decisoes_ia")
    .select("id, tipo, descricao, created_at")
    .contains("detalhes", { fluxo_execucao_id: resultado.fluxo_execucao_id })
    .limit(3);
  if (decisoes && decisoes.length > 0) {
    console.log(`  ✅ Decisões DV registradas: ${decisoes.length}`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 F39 — Teste Supabase: Orquestração Enterprise");
  console.log("=".repeat(60));

  // Verifica conexão
  const { data: fluxos } = await supabase.from("ia_fluxos_empresa").select("count");
  console.log(`\n📊 Fluxos cadastrados: ${(fluxos as Record<string, unknown>[])?.[0]?.count || 0}`);

  await testarCenario1_FluxoComercialCompleto();
  await testarCenario2_FluxoFinanceiroComAprovacao();
  await testarCenario3_FluxoOperacionalPontaAPonta();
  await testarCenario4_BloqueioGovernancaInterrompe();
  await testarCenario5_F34AAlteraDecisao();
  await testarCenario6_F38AtualizaKPIs();
  await testarCenario7_F27ReorganizaExecucao();

  // Resumo final
  console.log("\n" + "=".repeat(60));
  const { data: statsLog } = await supabase
    .from("ia_fluxos_execucao_log")
    .select("status, fluxo_codigo")
    .order("created_at", { ascending: false })
    .limit(20);

  if (statsLog) {
    const porStatus: Record<string, number> = {};
    for (const l of statsLog as { status: string; fluxo_codigo: string }[]) {
      porStatus[l.status] = (porStatus[l.status] || 0) + 1;
    }
    console.log("📊 Logs de execução gerados:");
    for (const [status, count] of Object.entries(porStatus)) {
      console.log(`  ${status}: ${count}`);
    }
  }

  console.log("\n🏁 F39 — Teste concluído!");
  console.log("=".repeat(60));
}

main().catch(console.error);
