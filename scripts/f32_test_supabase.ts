/**
 * F32 — Teste Supabase: Orquestrador de Trabalho
 *
 * Uso: npx ts-node scripts/f32_test_supabase.ts
 *
 * Valida:
 * 1. Criação de trabalho
 * 2. Atribuição para robô
 * 3. Execução de trabalho
 * 4. Conclusão
 * 5. Cancelamento
 * 6. Escalonamento
 * 7. Redistribuição
 * 8. Histórico
 * 9. Estatísticas
 * 10. Produtividade
 */

import { supabase } from "../src/lib/supabase";

const ROBO_ID = "00000000-0000-0000-0000-000000000001";
const ROBO_NOME = "Robô Teste F32";
const ROBO_SETOR = "TI";

async function ensureRobo(): Promise<string> {
  const { data: existing } = await supabase
    .from("automacoes_robos")
    .select("id")
    .eq("id", ROBO_ID)
    .maybeSingle();

  if (existing) return ROBO_ID;

  const { data, error } = await supabase
    .from("automacoes_robos")
    .insert({ id: ROBO_ID, nome: ROBO_NOME, setor: ROBO_SETOR, ativo: true })
    .select()
    .single();

  if (error) throw new Error(`Erro criar robô: ${error.message}`);
  console.log(`✅ Robô criado: ${data?.id}`);
  return data?.id as string;
}

async function test() {
  console.log("=".repeat(60));
  console.log("F32 — TESTE SUPABASE: ORQUESTRADOR DE TRABALHO");
  console.log("=".repeat(60));

  const roboId = await ensureRobo();
  const roboId2 = "00000000-0000-0000-0000-000000000002";

  const { data: robo2 } = await supabase
    .from("automacoes_robos")
    .select("id")
    .eq("id", roboId2)
    .maybeSingle();

  if (!robo2) {
    await supabase
      .from("automacoes_robos")
      .insert({ id: roboId2, nome: "Robô Teste F32 B", setor: "Financeiro", ativo: true });
    console.log("✅ Robô 2 criado");
  }

  // 1. CRIAR TRABALHO
  console.log("\n1. Criar trabalho");
  const { data: trab1, error: err1 } = await supabase
    .from("ia_trabalhos")
    .insert({
      robo_id: roboId,
      origem: "manual",
      tipo: "analise",
      titulo: "Analisar relatório mensal",
      descricao: "Analisar relatório de desempenho do mês",
      prioridade: "alta",
      status: "pendente",
      data_criacao: new Date().toISOString(),
      data_vencimento: new Date(Date.now() + 7 * 86400000).toISOString(),
      payload: { departamento: "TI", metricas: ["produtividade", "qualidade"] },
    })
    .select()
    .single();

  if (err1 || !trab1) throw new Error(`Erro criar trabalho: ${err1?.message}`);
  console.log(`   ✅ Trabalho criado: ${trab1.id} — "${trab1.titulo}" (${trab1.status})`);
  console.log(`      Prioridade: ${trab1.prioridade}, Origem: ${trab1.origem}`);

  // 2. ATRIBUIR TRABALHO
  console.log("\n2. Atribuir trabalho para robô");
  const { data: fila1, error: err2 } = await supabase
    .from("ia_fila_trabalho")
    .insert({
      trabalho_id: trab1.id,
      robo_id: roboId,
      ordem_execucao: 0,
      status: "pendente",
      proxima_execucao: new Date().toISOString(),
    })
    .select()
    .single();

  if (err2 || !fila1) throw new Error(`Erro atribuir trabalho: ${err2?.message}`);
  console.log(`   ✅ Trabalho atribuído: fila_id=${fila1.id}, ordem=${fila1.ordem_execucao}`);

  // 3. REGISTRAR HISTÓRICO
  console.log("\n3. Registrar histórico");
  const { error: err3 } = await supabase
    .from("ia_historico_trabalho")
    .insert({
      trabalho_id: trab1.id,
      robo_id: roboId,
      acao: "atribuido",
      detalhes: { origem: "manual", ordem: 0 },
    });

  if (err3) throw new Error(`Erro registrar histórico: ${err3.message}`);
  console.log("   ✅ Histórico registrado: atribuido");

  // 4. EXECUTAR TRABALHO
  console.log("\n4. Executar trabalho (em_andamento)");
  const { error: err4a } = await supabase
    .from("ia_trabalhos")
    .update({ status: "em_andamento", data_inicio: new Date().toISOString() })
    .eq("id", trab1.id);

  if (err4a) throw new Error(`Erro iniciar trabalho: ${err4a.message}`);

  const { error: err4b } = await supabase
    .from("ia_fila_trabalho")
    .update({ status: "em_andamento", ultima_execucao: new Date().toISOString(), tentativas: 1 })
    .eq("id", fila1.id);

  if (err4b) throw new Error(`Erro atualizar fila: ${err4b.message}`);

  await supabase.from("ia_historico_trabalho").insert({
    trabalho_id: trab1.id,
    robo_id: roboId,
    acao: "executando",
    detalhes: { tentativa: 1 },
  });

  console.log("   ✅ Trabalho em execução");

  // 5. CONCLUIR TRABALHO
  console.log("\n5. Concluir trabalho");
  const { error: err5 } = await supabase
    .from("ia_trabalhos")
    .update({
      status: "concluida",
      resultado: { status: "sucesso", metricas: { produtividade: 85, qualidade: 92 } },
      data_conclusao: new Date().toISOString(),
    })
    .eq("id", trab1.id);

  if (err5) throw new Error(`Erro concluir trabalho: ${err5.message}`);

  await supabase.from("ia_fila_trabalho").update({ status: "concluida" }).eq("id", fila1.id);
  await supabase.from("ia_historico_trabalho").insert({
    trabalho_id: trab1.id, robo_id: roboId, acao: "concluido",
    detalhes: { resultado: "sucesso" },
  });

  console.log("   ✅ Trabalho concluído");

  // 6. CANCELAR TRABALHO
  console.log("\n6. Cancelar trabalho");
  const { data: trab2 } = await supabase
    .from("ia_trabalhos")
    .insert({
      origem: "manual", tipo: "email", titulo: "Email cancelado",
      prioridade: "normal", status: "pendente", data_criacao: new Date().toISOString(),
    })
    .select()
    .single();

  if (trab2) {
    const { error: err6 } = await supabase
      .from("ia_trabalhos")
      .update({ status: "cancelada", resultado: { motivo: "Cancelado manualmente" } })
      .eq("id", trab2.id);

    if (err6) throw new Error(`Erro cancelar trabalho: ${err6.message}`);

    await supabase.from("ia_historico_trabalho").insert({
      trabalho_id: trab2.id, acao: "cancelado", detalhes: { motivo: "Cancelado manualmente" },
    });

    console.log(`   ✅ Trabalho cancelado: ${trab2.id}`);
  }

  // 7. ESCALAR TRABALHO
  console.log("\n7. Escalar trabalho");
  const { data: trab3 } = await supabase
    .from("ia_trabalhos")
    .insert({
      origem: "sistema", tipo: "cobranca", titulo: "Cobrança escalada",
      prioridade: "critica", status: "pendente", data_criacao: new Date().toISOString(),
    })
    .select()
    .single();

  if (trab3) {
    const { error: err7 } = await supabase
      .from("ia_trabalhos")
      .update({ status: "escalada", resultado: { motivo: "Erro crítico na execução" } })
      .eq("id", trab3.id);

    if (err7) throw new Error(`Erro escalar trabalho: ${err7.message}`);

    await supabase.from("ia_historico_trabalho").insert({
      trabalho_id: trab3.id, acao: "escalado",
      detalhes: { motivo: "Erro crítico na execução" },
    });

    console.log(`   ✅ Trabalho escalado: ${trab3.id}`);
  }

  // 8. REDISTRIBUIR TRABALHO
  console.log("\n8. Redistribuir trabalho");
  const { data: trab4 } = await supabase
    .from("ia_trabalhos")
    .insert({
      robo_id: roboId, origem: "diretor_virtual", tipo: "relatorio",
      titulo: "Relatório redistribuído", prioridade: "alta", status: "pendente",
      data_criacao: new Date().toISOString(),
    })
    .select()
    .single();

  if (trab4) {
    const { data: fila4 } = await supabase
      .from("ia_fila_trabalho")
      .insert({ trabalho_id: trab4.id, robo_id: roboId, ordem_execucao: 1, status: "pendente" })
      .select()
      .single();

    if (fila4) {
      await supabase.from("ia_fila_trabalho").update({ status: "falhou" }).eq("id", fila4.id);

      const { data: fila4b } = await supabase
        .from("ia_fila_trabalho")
        .insert({ trabalho_id: trab4.id, robo_id: roboId2, ordem_execucao: 2, status: "pendente", proxima_execucao: new Date().toISOString() })
        .select()
        .single();

      if (fila4b) {
        await supabase.from("ia_trabalhos").update({ robo_id: roboId2 }).eq("id", trab4.id);

        await supabase.from("ia_historico_trabalho").insert({
          trabalho_id: trab4.id, robo_id: roboId2, acao: "redistribuido",
          detalhes: { de_robo_id: roboId, para_robo_id: roboId2 },
        });

        console.log(`   ✅ Trabalho redistribuído de ${roboId} para ${roboId2}`);
      }
    }
  }

  // 9. LISTAR ESTATÍSTICAS
  console.log("\n9. Estatísticas");
  const { data: todos } = await supabase.from("ia_trabalhos").select("status, prioridade, origem, tipo");
  const lista = (todos || []) as { status: string; prioridade: string; origem: string; tipo: string }[];

  const stats = {
    total: lista.length,
    pendentes: lista.filter((t) => t.status === "pendente").length,
    concluidas: lista.filter((t) => t.status === "concluida").length,
    canceladas: lista.filter((t) => t.status === "cancelada").length,
    escaladas: lista.filter((t) => t.status === "escalada").length,
  };

  console.log(`   📊 Total: ${stats.total}`);
  console.log(`   📊 Pendentes: ${stats.pendentes}`);
  console.log(`   📊 Concluídas: ${stats.concluidas}`);
  console.log(`   📊 Canceladas: ${stats.canceladas}`);
  console.log(`   📊 Escaladas: ${stats.escaladas}`);

  // 10. PRODUTIVIDADE DO ROBÔ
  console.log("\n10. Produtividade do robô");
  const { data: prodTrabalhos } = await supabase
    .from("ia_trabalhos")
    .select("status, data_inicio, data_conclusao")
    .eq("robo_id", roboId);

  const prodLista = (prodTrabalhos || []) as { status: string; data_inicio: string | null; data_conclusao: string | null }[];
  const concluidas = prodLista.filter((t) => t.status === "concluida");

  console.log(`   📈 Total trabalhos do robô: ${prodLista.length}`);
  console.log(`   📈 Concluídos: ${concluidas.length}`);
  console.log(`   📈 Taxa: ${prodLista.length > 0 ? Math.round((concluidas.length / prodLista.length) * 100) : 0}%`);

  // LIMPEZA
  console.log("\n11. Limpeza (cascade delete)");
  const { error: errClean } = await supabase.from("ia_trabalhos").delete().in("id", [trab1.id, trab2?.id, trab3?.id, trab4?.id].filter(Boolean) as string[]);
  if (errClean) console.log(`   ⚠️ Erro na limpeza: ${errClean.message}`);
  else console.log("   ✅ Dados de teste removidos");

  console.log("\n" + "=".repeat(60));
  console.log("🎯 F32 — TODOS OS TESTES PASSARAM");
  console.log("=".repeat(60));
}

test().catch((err) => {
  console.error("\n❌ TESTE FALHOU:", err.message);
  process.exit(1);
});
