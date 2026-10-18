// ============================================================
// F40 — Teste Supabase: Auto-Evolução Controlada
// ============================================================
// Uso: $env:VITE_SUPABASE_URL="..."; $env:VITE_SUPABASE_ANON_KEY="..."; npx tsx scripts/f40_test_supabase.ts
// ============================================================

import { supabase } from "../src/lib/supabase";
import { autoEvolutionEngineService } from "../src/services/ia/autoEvolutionEngineService";

const ROBO_ID = "257f6d28-9b0f-4969-81a8-8e220edc73e6";

async function testarCenario1_RegistrarEvento() {
  console.log("\n🧪 1. Registrar evento de aprendizado");
  const evento = await autoEvolutionEngineService.registrarEvento({
    robo_id: ROBO_ID,
    entidade_tipo: "cliente",
    entidade_id: "test_f40_evento",
    tipo_evento: "sucesso",
    origem: "F39",
    payload: { acao: "fluxo_comercial", etapas: 5, status: "concluido", duracao_ms: 2450 },
  });
  if (evento) {
    console.log(`  ✅ Evento criado: ${evento.id} (tipo=${evento.tipo_evento}, origem=${evento.origem})`);
    console.log(`  ✅ Payload: ${JSON.stringify(evento.payload).slice(0, 80)}...`);

    // Verifica persistência
    const { data: dbCheck } = await supabase.from("ia_aprendizado_eventos").select("*").eq("id", evento.id).single();
    if (dbCheck) console.log("  ✅ Evento persistido no banco");
  } else {
    console.log("  ❌ Falha ao criar evento");
  }
}

async function testarCenario2_GerarInsight() {
  console.log("\n🧪 2. Gerar insight a partir de eventos");
  // Primeiro registra alguns eventos históricos para gerar padrões
  for (let i = 0; i < 5; i++) {
    await autoEvolutionEngineService.registrarEvento({
      robo_id: ROBO_ID,
      entidade_tipo: "robo", entidade_id: ROBO_ID,
      tipo_evento: i % 2 === 0 ? "sucesso" : "erro",
      origem: "F40", payload: { teste: `evento_${i}`, iteracao: i },
    });
  }

  const insight = await autoEvolutionEngineService.gerarInsight({
    entidade_id: ROBO_ID,
    contexto: "Análise de desempenho do robô comercial",
  });

  if (insight) {
    console.log(`  ✅ Insight gerado: ${insight.id}`);
    console.log(`  📝 Texto: ${insight.insight_texto.slice(0, 120)}...`);
    console.log(`  📊 Prioridade: ${insight.prioridade}`);
    console.log(`  💡 Impacto: ${insight.impacto_estimado}`);
    console.log(`  🔄 Status: ${insight.status}`);
  } else {
    console.log("  ⚠️ Nenhum insight gerado (poucos eventos?)");
  }
}

async function testarCenario3_AnalisarPadroes() {
  console.log("\n🧪 3. Analisar padrões globais do sistema");
  const resultado = await autoEvolutionEngineService.analisarPadroes();
  console.log(`  ✅ Padrões analisados: ${resultado.insights_gerados} insights gerados`);
  if (resultado.detalhes.length > 0) {
    for (const d of resultado.detalhes.slice(0, 5)) {
      console.log(`     Entidade: ${d.entidade_id.slice(0, 20)}... | Insight: ${d.insight_id.slice(0, 8)}... | Prioridade: ${d.prioridade}`);
    }
    if (resultado.detalhes.length > 5) console.log(`     ... mais ${resultado.detalhes.length - 5} insight(s)`);
  } else {
    console.log("     Nenhum padrão crítico detectado (sistema operando normalmente)");
  }
}

async function testarCenario4_GerarSugestao() {
  console.log("\n🧪 4. Gerar sugestão de melhoria a partir de insight");
  const insights = await autoEvolutionEngineService.listarInsights({ status: "novo", limite: 1 });

  if (insights.length === 0) {
    console.log("  ⚠️ Nenhum insight disponível para gerar sugestão");
    // Cria insight direto
    const { data: insight } = await supabase.from("ia_insights_automaticos").insert({
      contexto: "Teste direto",
      insight_texto: "Taxa de bloqueio elevada na governança para ações financeiras. Revisar permissões do robô comercial.",
      impacto_estimado: "Redução de 40% nos bloqueios",
      prioridade: "alta",
      status: "novo",
    }).select().single();
    if (insight) {
      console.log("  ✅ Insight criado manualmente para teste");
      const sugestao = await autoEvolutionEngineService.gerarSugestao(insight.id);
      if (sugestao) {
        console.log(`  ✅ Sugestão gerada: ${sugestao.id}`);
        console.log(`  📝 Tipo: ${sugestao.tipo}`);
        console.log(`  📝 Descrição: ${sugestao.descricao.slice(0, 100)}...`);
        console.log(`  📊 Status: ${sugestao.status}`);
      }
    }
  } else {
    const sugestao = await autoEvolutionEngineService.gerarSugestao(insights[0].id);
    if (sugestao) {
      console.log(`  ✅ Sugestão gerada: ${sugestao.id} (tipo=${sugestao.tipo}, status=${sugestao.status})`);
    }
  }
}

async function testarCenario5_EnviarParaGovernanca() {
  console.log("\n🧪 5. Enviar sugestão para aprovação da governança F35");
  const sugestoes = await autoEvolutionEngineService.listarSugestoes({ status: "pendente", limite: 1 });

  if (sugestoes.length === 0) {
    // Cria sugestão direta
    const { data: sugestao } = await supabase.from("ia_sugestoes_melhoria").insert({
      tipo: "kpi", descricao: "Ajustar meta de conversão de leads para 80%",
      impacto_estimado: "Melhoria de 15% no score geral",
      status: "pendente",
    }).select().single();
    if (sugestao) {
      console.log("  ✅ Sugestão criada manualmente para teste");
      const resultado = await autoEvolutionEngineService.enviarParaGovernancaF35(sugestao.id, ROBO_ID);
      if (resultado.sucesso) {
        console.log(`  ✅ Enviado para governança: aprovação ID ${resultado.aprovacao_id}`);
        console.log(`  ✅ Sugestão vinculada à aprovação F35`);
        const { data: check } = await supabase.from("ia_sugestoes_melhoria").select("governanca_aprovacao_id").eq("id", sugestao.id).single();
        if (check?.governanca_aprovacao_id) console.log(`  ✅ Aprovação ID persistida na sugestão`);
      } else {
        console.log(`  ⚠️ Falha ao enviar: ${resultado.erro}`);
      }
    }
  } else {
    const resultado = await autoEvolutionEngineService.enviarParaGovernancaF35(sugestoes[0].id, ROBO_ID);
    if (resultado.sucesso) {
      console.log(`  ✅ Enviado para governança: aprovação ID ${resultado.aprovacao_id}`);
    } else {
      console.log(`  ⚠️ ${resultado.erro}`);
    }
  }
}

async function testarCenario6_AplicarVersaoAprovada() {
  console.log("\n🧪 6. Aplicar versão aprovada do sistema");
  const versao = await autoEvolutionEngineService.aplicarVersaoAprovada({
    tipo: "fluxo",
    entidade_id: "FLUXO_COMERCIAL",
    snapshot: {
      nome: "Fluxo Comercial v2",
      etapas: 6,
      regras: { valor_maximo_proposta: 50000, precisa_aprovacao_acima: 10000 },
      ativo: true,
    },
    sugerido_por: "F40",
    aprovado_por: "F35",
  });

  if (versao) {
    console.log(`  ✅ Versão aplicada: ${versao.id}`);
    console.log(`  📊 Tipo: ${versao.tipo}`);
    console.log(`  🔢 Versão: ${versao.versao}`);
    console.log(`  📝 Snapshot: ${JSON.stringify(versao.snapshot).slice(0, 100)}...`);
    console.log(`  ✅ Ativo: ${versao.ativo}`);

    // Verifica versionamento
    const { data: versoes } = await supabase
      .from("ia_versoes_sistema")
      .select("versao, ativo")
      .eq("tipo", "fluxo")
      .eq("entidade_id", "FLUXO_COMERCIAL")
      .order("versao", { ascending: false });
    if (versoes) {
      console.log(`  ✅ Histórico de versões: ${versoes.length} versão(ões)`);
      for (const v of versoes as { versao: number; ativo: boolean }[]) {
        console.log(`     v${v.versao}: ${v.ativo ? "✅ ativa" : "⬜ inativa"}`);
      }
    }
  } else {
    console.log("  ❌ Falha ao aplicar versão");
  }
}

async function testarCenario7_SimularImpacto() {
  console.log("\n🧪 7. Simular impacto de sugestão");
  const sugestoes = await autoEvolutionEngineService.listarSugestoes({ limite: 1 });

  if (sugestoes.length > 0) {
    const impacto = await autoEvolutionEngineService.simularImpacto(sugestoes[0].id);
    if (impacto) {
      console.log(`  ✅ Impacto simulado para sugestão ${sugestoes[0].id.slice(0, 8)}...`);
      console.log(`  📊 Score atual: ${impacto.score_atual !== null ? `${impacto.score_atual}/100` : "N/A"}`);
      console.log(`  📊 Score estimado: ${impacto.score_estimado !== null ? `${impacto.score_estimado}/100` : "N/A"}`);
      console.log(`  📈 Melhoria: ${impacto.melhoria_percentual !== null ? `${impacto.melhoria_percentual}%` : "N/A"}`);
      console.log(`  💡 ${impacto.impacto}`);
    } else {
      console.log("  ❌ Falha ao simular impacto");
    }
  } else {
    console.log("  ⚠️ Nenhuma sugestão disponível para simulação");
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 F40 — Teste Supabase: Auto-Evolução Controlada");
  console.log("=".repeat(60));

  // Verifica conexão
  const { count } = await supabase.from("ia_aprendizado_eventos").select("*", { count: "exact", head: true });
  console.log(`\n📊 Tabelas F40 disponíveis: ${count !== null ? "✅" : "❌"}`);

  await testarCenario1_RegistrarEvento();
  await testarCenario2_GerarInsight();
  await testarCenario3_AnalisarPadroes();
  await testarCenario4_GerarSugestao();
  await testarCenario5_EnviarParaGovernanca();
  await testarCenario6_AplicarVersaoAprovada();
  await testarCenario7_SimularImpacto();

  // Resumo final
  console.log("\n" + "=".repeat(60));
  const stats = await autoEvolutionEngineService.obterEstatisticas();
  console.log("📊 Estatísticas F40:");
  console.log(`  Eventos: ${stats.total_eventos}`);
  console.log(`  Insights: ${stats.total_insights} (${JSON.stringify(stats.insights_por_prioridade)})`);
  console.log(`  Sugestões: ${stats.total_sugestoes} (${JSON.stringify(stats.sugestoes_por_status)})`);
  console.log(`  Versões: ${stats.total_versoes} (${stats.versoes_ativas} ativas)`);

  console.log("\n🏁 F40 — Teste concluído!");
  console.log("=".repeat(60));
}

main().catch(console.error);
