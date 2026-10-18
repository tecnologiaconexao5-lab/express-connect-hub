/**
 * F35 — Teste Supabase: Governança, Limites e Aprovações Operacionais
 *
 * 1. Matriz de Autoridade: upsert e consulta
 * 2. Avaliação de Ação: permitida vs bloqueada vs aprovação
 * 3. Fila de Aprovações: criar, aprovar, rejeitar
 * 4. Escalonamento: níveis configuráveis
 * 5. Contexto de Governança para F34A
 */
import { supabase } from "../src/lib/supabase";
import { governancaService } from "../src/services/ia/governancaService";
import { actionEngineService } from "../src/services/ia/actionEngineService";

const ROBO_ID = "00000000-0000-0000-0000-000000000001";

async function ensureData() {
  const { data: existing } = await supabase.from("automacoes_robos").select("id").eq("id", ROBO_ID).maybeSingle();
  if (!existing) {
    await supabase.from("automacoes_robos").insert({
      id: ROBO_ID, nome: "Robô F35", setor: "TI", ativo: true,
      modo_atual: "homologacao", nivel_autonomia: "automatico_seguro",
    });
  }

  // Garante ferramenta COM_ENVIAR_EMAIL
  const { data: ferramentas } = await supabase.from("ia_ferramentas").select("id, codigo_unico").eq("codigo_unico", "COM_ENVIAR_EMAIL").limit(1);
  if (ferramentas && ferramentas.length > 0) {
    await supabase.from("ia_robo_ferramentas").upsert({
      robo_id: ROBO_ID, ferramenta_id: ferramentas[0].id,
      nivel_autonomia: "EXECUTAR_COM_APROVACAO", ativo: true,
    }, { onConflict: "robo_id, ferramenta_id" });
  }

  // Limpa dados de teste anteriores
  await supabase.from("ia_autoridade_acoes").delete().eq("robo_id", ROBO_ID);
  await supabase.from("ia_aprovacoes_fila").delete().eq("robo_id", ROBO_ID);
  await supabase.from("ia_governanca_log").delete().eq("robo_id", ROBO_ID);

  console.log("✅ Dados base criados no Supabase real");
}

async function testMatrizAutoridade() {
  console.log("\n🔵 TESTE 1: Matriz de Autoridade (FASE 2)");

  await governancaService.upsertAutoridade({
    robo_id: ROBO_ID, acao_tipo: "COM_ENVIAR_EMAIL",
    permitido: true, valor_maximo: 0, risco_maximo: "baixo",
    precisa_aprovacao: false,
  });

  await governancaService.upsertAutoridade({
    robo_id: ROBO_ID, acao_tipo: "COM_PAGAR",
    permitido: false, risco_maximo: "critico",
    precisa_aprovacao: true,
  });

  await governancaService.upsertAutoridade({
    robo_id: ROBO_ID, acao_tipo: "COM_GERAR_PROPOSTA",
    permitido: true, valor_maximo: 5000, risco_maximo: "medio",
    precisa_aprovacao: true,
  });

  await governancaService.upsertEscalonamento({
    tipo_acao: "COM_GERAR_PROPOSTA", nivel_ordem: 1, aprovador_tipo: "supervisor",
  });

  await governancaService.upsertEscalonamento({
    tipo_acao: "COM_GERAR_PROPOSTA", nivel_ordem: 2, aprovador_tipo: "gestor",
  });

  const autoridade = await governancaService.obterAutoridade(ROBO_ID);
  console.log(`   Autoridades configuradas: ${autoridade.length}`);
  for (const a of autoridade) {
    console.log(`      ${a.permitido ? "✅" : "🚫"} ${a.acao_tipo}${a.valor_maximo ? ` (máx: R$ ${a.valor_maximo})` : ""}${a.precisa_aprovacao ? " [aprov]" : ""}`);
  }
}

async function testAvaliacaoAcao() {
  console.log("\n🔵 TESTE 2: Avaliação de Ação (FASE 3)");

  // Cenário 1: Ação permitida
  const r1 = await governancaService.avaliarAcao({
    roboId: ROBO_ID, acaoTipo: "COM_ENVIAR_EMAIL",
  });
  console.log(`   ✅ Ação permitida: permitido=${r1.permitido}, aprovação=${r1.precisa_aprovacao}`);
  console.log(`      Motivo: ${r1.motivo}`);

  // Cenário 2: Ação bloqueada
  const r2 = await governancaService.avaliarAcao({
    roboId: ROBO_ID, acaoTipo: "COM_PAGAR",
  });
  console.log(`   🚫 Ação bloqueada: permitido=${r2.permitido}`);
  console.log(`      Motivo: ${r2.motivo}`);

  // Cenário 3: Ação com aprovação necessária
  const r3 = await governancaService.avaliarAcao({
    roboId: ROBO_ID, acaoTipo: "COM_GERAR_PROPOSTA",
    valor: 3000,
  });
  console.log(`   ⚠️ Ação com aprovação: permitido=${r3.permitido}, aprovação=${r3.precisa_aprovacao}`);
  console.log(`      Motivo: ${r3.motivo}`);

  // Cenário 4: Ação com valor excedido
  const r4 = await governancaService.avaliarAcao({
    roboId: ROBO_ID, acaoTipo: "COM_GERAR_PROPOSTA",
    valor: 10000,
  });
  console.log(`   💰 Valor excedido: permitido=${r4.permitido}, aprovação=${r4.precisa_aprovacao}`);
  console.log(`      Motivo: ${r4.motivo}`);
}

async function testFilaAprovacoes() {
  console.log("\n🔵 TESTE 3: Fila de Aprovações (FASE 4)");

  // Cenário 1: Criar aprovação
  const aprov1 = await governancaService.criarAprovacao({
    roboId: ROBO_ID, acaoTipo: "COM_GERAR_PROPOSTA",
    descricao: "Gerar proposta de 3000 para cliente VIP",
    justificativa: "Cliente solicitou orçamento urgente",
    risco: "medio", valorFinanceiro: 3000,
  });
  if (aprov1) {
    console.log(`   ✅ Aprovação criada: ${aprov1.id}`);
    console.log(`      Status: ${aprov1.status}, Nível: ${aprov1.nivel_atual}/${aprov1.nivel_maximo}`);
    console.log(`      Aprovador: ${aprov1.aprovador_tipo || "pendente"}`);

    // Cenário 2: Aprovar
    const aprovado = await governancaService.aprovarAprovacao(aprov1.id, ROBO_ID);
    const apApos = await governancaService.obterAprovacao(aprov1.id);
    console.log(`   ✅ Aprovação concluída: status=${apApos?.status}`);
    if (apApos?.status === "escalado") {
      console.log(`      Escalado para nível ${apApos.nivel_atual}`);
    }
  }

  // Cenário 3: Criar e rejeitar
  const aprov2 = await governancaService.criarAprovacao({
    roboId: ROBO_ID, acaoTipo: "COM_GERAR_PROPOSTA",
    descricao: "Proposta de alto valor",
    risco: "alto", valorFinanceiro: 50000,
  });
  if (aprov2) {
    const rejeitado = await governancaService.rejeitarAprovacao(aprov2.id, "Valor acima do permitido sem justificativa");
    const apApos2 = await governancaService.obterAprovacao(aprov2.id);
    console.log(`   ❌ Aprovação rejeitada: status=${apApos2?.status}`);
    console.log(`      Observação: ${apApos2?.observacao}`);
  }

  const fila = await governancaService.listarFilaAprovacoes({ robo_id: ROBO_ID });
  console.log(`   Total na fila: ${fila.length}`);
  const estats = await governancaService.obterEstatisticasFila();
  console.log(`   Estatísticas: ${JSON.stringify(estats)}`);
}

async function testEscalonamento() {
  console.log("\n🔵 TESTE 4: Escalonamento (FASE 5)");

  const escalonamento = await governancaService.listarEscalonamento("COM_GERAR_PROPOSTA");
  console.log(`   Níveis configurados: ${escalonamento.length}`);
  for (const e of escalonamento) {
    console.log(`      Nível ${e.nivel_ordem}: ${e.aprovador_tipo}`);
  }
}

async function testContextoGovernanca() {
  console.log("\n🔵 TESTE 5: Contexto de Governança para F34A (FASE 6)");

  const ctx = await governancaService.obterContextoGovernanca(ROBO_ID);
  console.log(`   Alertas: ${ctx.alertas.length}`);
  for (const a of ctx.alertas) {
    console.log(`      ${a}`);
  }
  console.log(`   Permissões: ${ctx.permissoes_ferramentas.length}`);
}

async function testLogGovernanca() {
  console.log("\n🔵 TESTE 6: Log de Governança (FASE 7)");

  const logs = await governancaService.listarLogGovernanca({ robo_id: ROBO_ID, limite: 5 });
  console.log(`   Total de logs: ${logs.length}`);
  for (const l of logs.slice(0, 5)) {
    console.log(`      [${l.decisao}] ${l.acao_tipo || "geral"} — ${l.resultado?.slice(0, 60)}`);
  }
}

async function limpar() {
  await supabase.from("ia_autoridade_acoes").delete().eq("robo_id", ROBO_ID);
  await supabase.from("ia_aprovacoes_fila").delete().eq("robo_id", ROBO_ID);
  await supabase.from("ia_governanca_log").delete().eq("robo_id", ROBO_ID);
  console.log("\n✅ Dados de teste limpos");
}

async function main() {
  console.log("=".repeat(70));
  console.log("F35 — TESTE SUPABASE: GOVERNANÇA CORPORATIVA");
  console.log("=".repeat(70));

  await ensureData();
  await testMatrizAutoridade();
  await testAvaliacaoAcao();
  await testFilaAprovacoes();
  await testEscalonamento();
  await testContextoGovernanca();
  await testLogGovernanca();
  await limpar();

  console.log("\n" + "=".repeat(70));
  console.log("🎯 F35 — TODOS OS TESTES CONCLUÍDOS");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ TESTE FALHOU:", err.message);
  process.exit(1);
});
