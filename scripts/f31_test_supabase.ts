import { supabase } from "../src/lib/supabase";

type TestResult = { nome: string; passou: boolean; erro?: string; id?: string };

async function testarCriacaoMissao(): Promise<TestResult> {
  const { data: robos } = await supabase.from("automacoes_robos").select("id").limit(1);
  if (!robos || robos.length === 0) return { nome: "Criar Missão", passou: false, erro: "Nenhum robô encontrado" };
  const roboId = robos[0].id;

  const { data, error } = await supabase.from("ia_missoes").insert({
    robo_id: roboId,
    nome_missao: "Teste F31 - Prospecção de Leads",
    descricao: "Missão de teste para validação F31",
    objetivo_estrategico: "Aumentar base de clientes em 20%",
    prioridade: "alta",
    status: "ativa",
    inicio_vigencia: "2026-07-01",
    fim_vigencia: "2026-12-31",
  }).select().single();

  if (error) return { nome: "Criar Missão", passou: false, erro: error.message };
  if (!data) return { nome: "Criar Missão", passou: false, erro: "Sem dados retornados" };
  return { nome: "Criar Missão", passou: true, id: data.id };
}

async function testarCriacaoMeta(missaoId: string): Promise<TestResult> {
  const { data: missao } = await supabase.from("ia_missoes").select("robo_id").eq("id", missaoId).single();
  if (!missao) return { nome: "Criar Meta", passou: false, erro: "Missão não encontrada" };

  const { data, error } = await supabase.from("ia_metas").insert({
    missao_id: missaoId,
    robo_id: missao.robo_id,
    nome_meta: "Novos leads por dia",
    valor_meta: 50,
    valor_atual: 0,
    unidade: "leads",
    periodicidade: "diaria",
    peso: 1.0,
    status: "ativa",
    data_referencia_inicio: "2026-07-01",
    data_referencia_fim: "2026-12-31",
  }).select().single();

  if (error) return { nome: "Criar Meta", passou: false, erro: error.message };
  return { nome: "Criar Meta", passou: true, id: data.id };
}

async function testarAtualizarValorMeta(metaId: string): Promise<TestResult> {
  const { data, error } = await supabase.from("ia_metas").update({
    valor_atual: 35,
    updated_at: new Date().toISOString(),
  }).eq("id", metaId).select().single();

  if (error) return { nome: "Atualizar Valor Meta", passou: false, erro: error.message };

  if (data.valor_atual !== 35) {
    return { nome: "Atualizar Valor Meta", passou: false, erro: `Valor esperado 35, obtido ${data.valor_atual}` };
  }
  return { nome: "Atualizar Valor Meta", passou: true, id: data.id };
}

async function testarRegistrarIndicador(metaId: string, roboId: string): Promise<TestResult> {
  const { data, error } = await supabase.from("ia_indicadores").insert({
    meta_id: metaId,
    robo_id: roboId,
    valor_planejado: 50,
    valor_realizado: 35,
    percentual_atingido: 70,
    tendencia: "crescente",
    periodo_referencia: "2026-07",
    data_apuracao: "2026-07-13",
  }).select().single();

  if (error) return { nome: "Registrar Indicador", passou: false, erro: error.message };
  return { nome: "Registrar Indicador", passou: true, id: data.id };
}

async function testarHistoricoIndicador(metaId: string, roboId: string): Promise<TestResult> {
  const { data, error } = await supabase.from("ia_historico_indicadores").insert({
    meta_id: metaId,
    robo_id: roboId,
    valor_planejado: 50,
    valor_realizado: 35,
    percentual_atingido: 70,
    tendencia: "crescente",
    periodo_referencia: "2026-07",
    data_apuracao: "2026-07-13",
  }).select().single();

  if (error) return { nome: "Historico Indicador", passou: false, erro: error.message };
  return { nome: "Historico Indicador", passou: true, id: data.id };
}

async function testarAgenda(roboId: string): Promise<TestResult> {
  const { data, error } = await supabase.from("ia_agenda_trabalho").insert({
    robo_id: roboId,
    dia_semana: "segunda",
    ativo: true,
  }).select().single();

  if (error) return { nome: "Criar Agenda", passou: false, erro: error.message };

  // Criar atividade na agenda
  const { data: atividade, error: errAtiv } = await supabase.from("ia_agenda_atividades").insert({
    agenda_id: data.id,
    robo_id: roboId,
    horario_inicio: "08:00:00",
    horario_fim: "09:00:00",
    tipo_atividade: "prospeccao",
    descricao: "Procurar novos clientes",
    prioridade: "alta",
    frequencia: "diario",
    repeticoes: 1,
  }).select().single();

  if (errAtiv) return { nome: "Criar Agenda", passou: false, erro: errAtiv.message };
  return { nome: "Criar Agenda", passou: true, id: `${data.id},${atividade.id}` };
}

async function testarLimites(roboId: string): Promise<TestResult> {
  const { data, error } = await supabase.from("ia_limites_operacionais").insert({
    robo_id: roboId,
    acao_tipo: "enviar_email",
    limite_quantidade: 200,
    periodo: "diario",
    horario_permitido_inicio: "08:00:00",
    horario_permitido_fim: "18:00:00",
    alerta_quando_atingir: 80,
  }).select().single();

  if (error) return { nome: "Criar Limite", passou: false, erro: error.message };
  return { nome: "Criar Limite", passou: true, id: data.id };
}

async function testarAlterarStatusMissao(missaoId: string): Promise<TestResult> {
  const { data, error } = await supabase.from("ia_missoes").update({
    status: "concluida",
    updated_at: new Date().toISOString(),
  }).eq("id", missaoId).select().single();

  if (error) return { nome: "Alterar Status Missão", passou: false, erro: error.message };
  if (data.status !== "concluida") {
    return { nome: "Alterar Status Missão", passou: false, erro: `Status esperado 'concluida', obtido '${data.status}'` };
  }
  return { nome: "Alterar Status Missão", passou: true, id: data.id };
}

async function testarLimpeza(missaoId: string): Promise<TestResult> {
  // Deletar missão deve cascatear para metas, indicadores e históricos
  const { error } = await supabase.from("ia_missoes").delete().eq("id", missaoId);
  if (error) return { nome: "Limpeza (Cascade)", passou: false, erro: error.message };

  // Verificar se metas foram deletadas
  const { data: metas } = await supabase.from("ia_metas").select("id").eq("missao_id", missaoId);
  if (metas && metas.length > 0) {
    return { nome: "Limpeza (Cascade)", passou: false, erro: "Metas não foram deletadas em cascade" };
  }
  return { nome: "Limpeza (Cascade)", passou: true };
}

async function rodarTestes() {
  console.log("========================================");
  console.log("F31 — SUPABASE VALIDATION TESTS");
  console.log("Sistema de Missões, Metas, Agenda e KPIs");
  console.log("========================================\n");

  const resultados: TestResult[] = [];

  // 1. Criar missão
  const r1 = await testarCriacaoMissao();
  resultados.push(r1);
  console.log(`${r1.passou ? "✅" : "❌"} ${r1.nome}${r1.id ? ` (id: ${r1.id})` : ""}${r1.erro ? ` — ${r1.erro}` : ""}`);

  if (!r1.passou || !r1.id) {
    console.log("\n⚠️ Não foi possível continuar — falha na criação da missão");
    console.log(`\nResultado: ${resultados.filter(r => r.passou).length}/${resultados.length} PASS`);
    process.exit(1);
  }

  const missaoId = r1.id;

  // 2. Criar meta
  const r2 = await testarCriacaoMeta(missaoId);
  resultados.push(r2);
  console.log(`${r2.passou ? "✅" : "❌"} ${r2.nome}${r2.id ? ` (id: ${r2.id})` : ""}${r2.erro ? ` — ${r2.erro}` : ""}`);

  if (!r2.passou || !r2.id) {
    console.log("\n⚠️ Não foi possível continuar — falha na criação da meta");
    console.log(`\nResultado: ${resultados.filter(r => r.passou).length}/${resultados.length} PASS`);
    process.exit(1);
  }

  const metaId = r2.id;

  // 3. Obter robo_id da missão
  const { data: missao } = await supabase.from("ia_missoes").select("robo_id").eq("id", missaoId).single();
  const roboId = missao?.robo_id;

  // 4. Atualizar valor da meta
  const r3 = await testarAtualizarValorMeta(metaId);
  resultados.push(r3);
  console.log(`${r3.passou ? "✅" : "❌"} ${r3.nome}${r3.erro ? ` — ${r3.erro}` : ""}`);

  // 5. Registrar indicador
  if (roboId) {
    const r4 = await testarRegistrarIndicador(metaId, roboId);
    resultados.push(r4);
    console.log(`${r4.passou ? "✅" : "❌"} ${r4.nome}${r4.id ? ` (id: ${r4.id})` : ""}${r4.erro ? ` — ${r4.erro}` : ""}`);
  }

  // 6. Histórico de indicadores
  if (roboId) {
    const r5 = await testarHistoricoIndicador(metaId, roboId);
    resultados.push(r5);
    console.log(`${r5.passou ? "✅" : "❌"} ${r5.nome}${r5.id ? ` (id: ${r5.id})` : ""}${r5.erro ? ` — ${r5.erro}` : ""}`);
  }

  // 7. Criar agenda
  if (roboId) {
    const r6 = await testarAgenda(roboId);
    resultados.push(r6);
    console.log(`${r6.passou ? "✅" : "❌"} ${r6.nome}${r6.id ? ` (ids: ${r6.id})` : ""}${r6.erro ? ` — ${r6.erro}` : ""}`);
  }

  // 8. Criar limite
  if (roboId) {
    const r7 = await testarLimites(roboId);
    resultados.push(r7);
    console.log(`${r7.passou ? "✅" : "❌"} ${r7.nome}${r7.id ? ` (id: ${r7.id})` : ""}${r7.erro ? ` — ${r7.erro}` : ""}`);
  }

  // 9. Alterar status da missão
  const r8 = await testarAlterarStatusMissao(missaoId);
  resultados.push(r8);
  console.log(`${r8.passou ? "✅" : "❌"} ${r8.nome}${r8.erro ? ` — ${r8.erro}` : ""}`);

  // 10. Limpeza - verificar cascade
  const r9 = await testarLimpeza(missaoId);
  resultados.push(r9);
  console.log(`${r9.passou ? "✅" : "❌"} ${r9.nome}${r9.erro ? ` — ${r9.erro}` : ""}`);

  // Resumo
  const total = resultados.length;
  const passou = resultados.filter(r => r.passou).length;
  const falhou = resultados.filter(r => !r.passou).length;

  console.log("\n========================================");
  console.log(`Resultado: ${passou}/${total} PASS, ${falhou} FAIL`);
  if (falhou > 0) {
    console.log("\nFalhas:");
    resultados.filter(r => !r.passou).forEach(r => {
      console.log(`  ❌ ${r.nome}: ${r.erro}`);
    });
  }
  console.log("========================================");

  process.exit(falhou > 0 ? 1 : 0);
}

rodarTestes().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
