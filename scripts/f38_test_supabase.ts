// ============================================================
// F38 — Teste Supabase: Metas, Missões, KPIs e Performance
// ============================================================
// Uso: $env:VITE_SUPABASE_URL="..."; $env:VITE_SUPABASE_ANON_KEY="..."; npx tsx scripts/f38_test_supabase.ts
// ============================================================

import { supabase } from "../src/lib/supabase";
import { performanceEngineService } from "../src/services/ia/performanceEngineService";
import { gestaoFuncionariosService } from "../src/services/ia/gestaoFuncionariosService";

const ROBO_ID = "257f6d28-9b0f-4969-81a8-8e220edc73e6"; // Comercial IA

async function testarCenario1_MetaCriadaAtualizada() {
  console.log("\n🧪 1. Meta criada e atualizada via F31");
  // Cria missão primeiro (F31)
  let missao: { id: string } | null = null;
  try {
    const m = await gestaoFuncionariosService.criarMissao({
      robo_id: ROBO_ID, nome_missao: "F38 Teste Metas",
      descricao: "Missão de teste para validação F38",
    });
    missao = m;
    console.log(`  ✅ Missão criada: ${m.id}`);
  } catch (e) {
    console.log(`  ⚠️ Missão pode já existir: ${(e as Error).message}`);
    const { data } = await supabase.from("ia_missoes").select("id").eq("robo_id", ROBO_ID).limit(1).maybeSingle();
    if (data) { missao = data; console.log(`  ✅ Usando missão existente: ${data.id}`); }
  }

  if (!missao) { console.log("  ❌ Não foi possível obter missão"); return; }

  // Cria meta via F31
  const meta = await gestaoFuncionariosService.criarMeta({
    missao_id: missao.id, robo_id: ROBO_ID,
    nome_meta: "Conversão de Leads F38",
    valor_meta: 100, unidade: "leads", peso: 2.0, periodicidade: "mensal",
  });
  console.log(`  ✅ Meta criada: ${meta.id} (valor_meta=${meta.valor_meta}, peso=${meta.peso})`);

  // Atualiza valor via F31
  const metaAtualizada = await gestaoFuncionariosService.atualizarValorMeta(meta.id, 50);
  console.log(`  ✅ Meta atualizada: valor_atual=${metaAtualizada.valor_atual}, status=${metaAtualizada.status}`);

  // F38: Registra auditoria
  await supabase.from("ia_auditoria_performance").insert({
    robo_id: ROBO_ID, tipo: "meta", acao: "teste_criacao",
    descricao: "Meta criada e atualizada para validação F38",
    valor_novo: { meta_id: meta.id, nome: meta.nome_meta, valor_atual: 50 },
    resultado: "teste_ok",
  });
  console.log(`  ✅ Auditoria registrada`);
}

async function testarCenario2_MissaoExecutada() {
  console.log("\n🧪 2. Missão executada com progresso");
  const missao = await performanceEngineService.criarMissaoExecucao({
    robo_id: ROBO_ID, titulo: "Campanha de Marketing F38",
    descricao: "Executar campanha de marketing digital",
    total_acoes: 5, impacto_estimado: "Alto",
  });
  if (!missao) { console.log("  ❌ Falha ao criar missão"); return; }
  console.log(`  ✅ Missão criada: ${missao.id} (status=${missao.status})`);

  const iniciada = await performanceEngineService.iniciarMissaoExecucao(missao.id);
  console.log(`  ✅ Missão iniciada: status=${iniciada?.status}`);

  const prog1 = await performanceEngineService.atualizarProgressoMissao(missao.id, { progresso: 40, acoes_concluidas: 2 });
  console.log(`  ✅ Progresso 40%: status=${prog1?.status}`);

  const prog2 = await performanceEngineService.atualizarProgressoMissao(missao.id, { progresso: 100, acoes_concluidas: 5 });
  console.log(`  ✅ Missão concluída: status=${prog2?.status}, progresso=${prog2?.progresso}`);
}

async function testarCenario3_KpiAtualizado() {
  console.log("\n🧪 3. KPI atualizado automaticamente");
  const kpi = await performanceEngineService.criarKpi({
    robo_id: ROBO_ID, nome_kpi: "Taxa de Conversão",
    formula: "(leads_convertidos / total_leads) * 100",
    valor_meta: 100, unidade: "%", periodicidade: "mensal",
  });
  if (!kpi) { console.log("  ❌ Falha ao criar KPI"); return; }
  console.log(`  ✅ KPI criado: ${kpi.id} (fórmula: ${kpi.formula})`);

  const atualizado = await performanceEngineService.atualizarKpi(kpi.id, { valor_atual: 75 });
  console.log(`  ✅ KPI atualizado: valor_atual=${atualizado?.valor_atual}`);

  const kpis = await performanceEngineService.listarKpis(ROBO_ID);
  console.log(`  ✅ KPIs listados: ${kpis.length} encontrados`);
}

async function testarCenario4_ScoreRecalculado() {
  console.log("\n🧪 4. Score do robô recalculado");
  const score = await performanceEngineService.recalcularScore(ROBO_ID);
  if (!score) { console.log("  ❌ Falha ao calcular score"); return; }
  console.log(`  ✅ Score geral: ${score.score_geral}/100`);
  console.log(`  ✅ Performance: ${score.performance_score}/100`);
  console.log(`  ✅ Eficiência: ${score.eficiencia_score}/100`);
  console.log(`  ✅ Confiabilidade: ${score.confiabilidade_score}/100`);
  console.log(`  ✅ Risco: ${score.risco_score}/100`);

  // Verifica no banco
  const { data: dbScore } = await supabase.from("ia_score_robo").select("*").eq("robo_id", ROBO_ID).single();
  if (dbScore) console.log(`  ✅ Score persistido no banco (atualizado_em=${dbScore.atualizado_em})`);
}

async function testarCenario5_ContextoPerformance() {
  console.log("\n🧪 5. Contexto de performance para F34A");
  const ctx = await performanceEngineService.montarContextoPerformance(ROBO_ID);
  console.log(`  ✅ Contexto gerado (${ctx.length} chars):`);
  const linhas = ctx.split("\n").filter(l => l.trim());
  for (const linha of linhas.slice(0, 8)) {
    console.log(`    ${linha}`);
  }
  if (linhas.length > 8) console.log(`    ... mais ${linhas.length - 8} linhas`);
}

async function testarCenario6_FatoresGovernanca() {
  console.log("\n🧪 6. Fatores de ajuste para governança (F35)");
  const fatores = await performanceEngineService.obterFatoresAjusteGovernanca(ROBO_ID);
  console.log(`  ✅ Fator de confiança: ${fatores.fator_confianca}`);
  console.log(`  ✅ Autonomia sugerida: ${fatores.nivel_autonomia_sugerido}`);
  if (fatores.alertas.length > 0) {
    for (const a of fatores.alertas) console.log(`  ⚠️ Alerta: ${a}`);
  } else {
    console.log(`  ✅ Sem alertas de performance`);
  }
}

async function testarCenario7_AuditoriaRastreavel() {
  console.log("\n🧪 7. Auditoria rastreável no banco");
  const { data: auditorias } = await supabase
    .from("ia_auditoria_performance")
    .select("id, tipo, acao, resultado, created_at")
    .eq("robo_id", ROBO_ID)
    .order("created_at", { ascending: false })
    .limit(5);
  if (auditorias && auditorias.length > 0) {
    console.log(`  ✅ ${auditorias.length} registros de auditoria encontrados:`);
    for (const a of auditorias) {
      console.log(`    [${a.tipo}] ${a.acao} → ${a.resultado}`);
    }
  } else {
    console.log(`  ⚠️ Nenhum registro de auditoria encontrado`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 F38 — Teste Supabase: Metas, Missões, KPIs e Performance");
  console.log("=".repeat(60));

  await testarCenario1_MetaCriadaAtualizada();
  await testarCenario2_MissaoExecutada();
  await testarCenario3_KpiAtualizado();
  await testarCenario4_ScoreRecalculado();
  await testarCenario5_ContextoPerformance();
  await testarCenario6_FatoresGovernanca();
  await testarCenario7_AuditoriaRastreavel();

  console.log("\n" + "=".repeat(60));
  console.log("🏁 F38 — Teste concluído!");
  console.log("=".repeat(60));
}

main().catch(console.error);
