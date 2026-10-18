/**
 * F34A — Teste Supabase: Motor Cognitivo LLM dos Funcionários Digitais
 *
 * 1. Prompt Dinâmico: verifica montagem com todas as fontes
 * 2. Planejamento Cognitivo: LLM sugere ferramenta
 * 3. Execução Cognitiva: encadearAcaoCognitiva executa
 * 4. Fallback: LLM indisponível → fallback determinístico
 */
import { supabase } from "../src/lib/supabase";
import { cognitivoPlannerService } from "../src/services/ia/cognitivoPlannerService";
import { agenteService } from "../src/services/ia/agenteService";

const ROBO_ID = "00000000-0000-0000-0000-000000000001";
const ENTIDADE_ID = "cliente-f34a-test-001";

async function ensureData() {
  // Garante robô admin
  const { data: existing } = await supabase.from("automacoes_robos").select("id").eq("id", ROBO_ID).maybeSingle();
  if (!existing) {
    await supabase.from("automacoes_robos").insert({
      id: ROBO_ID, nome: "Robô F34A", setor: "TI", ativo: true,
      modo_atual: "homologacao", nivel_autonomia: "automatico_seguro",
      permite_envio_externo: false, exige_aprovacao_humana: false,
    });
  }

  // Garante permissão em pelo menos uma ferramenta
  const { data: ferramentas } = await supabase.from("ia_ferramentas").select("id, codigo_unico").limit(3);
  if (ferramentas && ferramentas.length > 0) {
    for (const f of ferramentas) {
      await supabase.from("ia_robo_ferramentas").upsert({
        robo_id: ROBO_ID, ferramenta_id: f.id,
        nivel_autonomia: "EXECUTAR_AUTONOMO", ativo: true,
      }, { onConflict: "robo_id, ferramenta_id" });
    }
  }

  // Cria entidade de memória
  await supabase.from("memoria_entidades").delete().eq("entidade_id", ENTIDADE_ID);
  await supabase.from("memoria_entidades").insert({
    robo_id: ROBO_ID, entidade_tipo: "cliente", entidade_id: ENTIDADE_ID,
    nome: "Cliente F34A Teste", resumo: "Cliente premium para teste cognitivo",
    metadata: { vip: true, setor: "logistica" }, escopo: "compartilhada", relevancia: 1.0,
    ultima_interacao: new Date().toISOString(),
  });

  // Cria preferência
  await supabase.from("memoria_preferencias").upsert({
    robo_id: ROBO_ID, entidade_tipo: "cliente", entidade_id: ENTIDADE_ID,
    chave: "canal_preferido", valor: "email", tipo: "texto", categoria: "comunicacao",
    aprendido_automaticamente: true, escopo: "compartilhada",
  }, { onConflict: "entidade_tipo, entidade_id, chave" });

  // Cria evento
  await supabase.from("memoria_eventos").insert({
    robo_id: ROBO_ID, entidade_tipo: "cliente", entidade_id: ENTIDADE_ID,
    tipo_evento: "negociacao", titulo: "Negociação de renovação de contrato",
    descricao: "Cliente solicitou renovação com desconto de 5%", escopo: "compartilhada",
  });

  console.log("✅ Dados base criados no Supabase real");
}

async function testPromptDinamico() {
  console.log("\n🔵 TESTE 1: Prompt Dinâmico (FASE 3)");

  const resultado = await cognitivoPlannerService.montarPromptDinamico({
    roboId: ROBO_ID,
    objetivo: "enviar orçamento para cliente premium",
    entidadeTipo: "cliente",
    entidadeId: ENTIDADE_ID,
  });

  const fontesStr = resultado.fontes.map((f) => `${f.tipo}(${f.count})`).join(", ");
  console.log(`   Fontes incluídas: ${fontesStr}`);
  console.log(`   Tamanho do prompt: ${resultado.prompt.length} caracteres`);
  console.log(`   Alertas: ${resultado.alertas.length > 0 ? resultado.alertas.join("; ") : "nenhum"}`);

  // Verifica que contém elementos obrigatórios
  const prompt = resultado.prompt;
  const checks = [
    { name: "Identidade do Robô", check: prompt.includes("=== IDENTIDADE DO ROBÔ ===") || prompt.includes("Nome:") },
    { name: "Instrução ativa", check: prompt.includes("=== INSTRUÇÃO ATIVA") || prompt.includes("Nenhuma instrução") },
    { name: "Ferramentas disponíveis", check: prompt.includes("=== FERRAMENTAS DISPONÍVEIS ===") },
    { name: "Objetivo atual", check: prompt.includes("=== OBJETIVO ATUAL ===") },
    { name: "Instruções para análise", check: prompt.includes("=== INSTRUÇÕES PARA ANÁLISE ===") },
    { name: "Formato JSON", check: prompt.includes("ferramenta_codigo") },
  ];

  for (const c of checks) {
    console.log(`   ${c.check ? "✅" : "⚠️"} ${c.name}`);
  }

  return resultado;
}

async function testPlanejamento() {
  console.log("\n🔵 TESTE 2: Planejamento Cognitivo (FASE 2 + 4)");

  const resultado = await cognitivoPlannerService.planejar({
    roboId: ROBO_ID,
    objetivo: "consultar dados cadastrais de cliente",
    entidadeTipo: "cliente",
    entidadeId: ENTIDADE_ID,
  });

  console.log(`   Origem: ${resultado.origem}`);
  console.log(`   Sucesso: ${resultado.sucesso}`);

  if (resultado.sucesso && resultado.plano) {
    console.log(`   Análise: ${resultado.plano.analise_contexto.slice(0, 100)}`);
    console.log(`   Raciocínio: ${resultado.plano.raciocinio.slice(0, 150)}`);
    console.log(`   Etapas planejadas: ${resultado.plano.etapas.length}`);
    for (const e of resultado.plano.etapas) {
      console.log(`      [${e.ordem}] ${e.ferramenta_nome} (${e.ferramenta_codigo}) — risco: ${e.risco}${e.precisa_aprovacao ? " [APROVAÇÃO]" : ""}`);
      console.log(`            Motivo: ${e.motivo}`);
    }
    if (resultado.plano.alertas.length > 0) {
      console.log(`   Alertas: ${resultado.plano.alertas.join("; ")}`);
    }
    console.log(`   Justificativa: ${resultado.plano.justificativa_geral.slice(0, 100)}`);
  }

  return resultado;
}

async function testExecucaoCognitiva() {
  console.log("\n🔵 TESTE 3: Execução Cognitiva Encadeada (FASE 4)");

  const resultado = await agenteService.encadearAcaoCognitiva({
    roboId: ROBO_ID,
    objetivo: "consultar dados de cliente",
    contexto: { entidade_tipo: "cliente", entidade_id: ENTIDADE_ID },
    maxSteps: 2,
  });

  console.log(`   Status: ${resultado.status}`);
  console.log(`   Resumo: ${resultado.resumo}`);
  console.log(`   Execuções: ${resultado.execucoes.length}`);
  console.log(`   Origem planejamento: ${resultado.origem_planejamento || "N/A"}`);
  if (resultado.sessao) {
    const completa = await agenteService.obterSessaoCompleta(resultado.sessao.id);
    console.log(`   Sessão: ${completa.sessao?.objetivo} — estado: ${completa.sessao?.estado}`);
    console.log(`   Execuções na sessão: ${completa.execucoes.length}`);
  }
}

async function testFallback() {
  console.log("\n🔵 TESTE 4: Fallback Determinístico (FASE 5)");

  const resultado = await cognitivoPlannerService.fallbackDeterministico(
    ROBO_ID,
    "enviar email para cliente",
    { entidadeTipo: "cliente", entidadeId: ENTIDADE_ID },
  );

  console.log(`   Sucesso: ${resultado.sucesso}`);
  console.log(`   Origem: ${resultado.origem}`);

  if (resultado.sucesso && resultado.plano) {
    console.log(`   Etapas: ${resultado.plano.etapas.length}`);
    for (const e of resultado.plano.etapas) {
      console.log(`      ${e.ferramenta_nome} — ${e.motivo}`);
    }
    console.log(`   Alertas: ${resultado.plano.alertas.join("; ")}`);
  }

  if (resultado.fallback_selecao) {
    console.log(`   Score fallback: ${resultado.fallback_selecao.score}`);
  }
}

async function limpar() {
  const { data: sessoes } = await supabase.from("ia_agentes_execucao").select("id");
  if (sessoes) {
    for (const s of sessoes) {
      await supabase.from("ia_execucoes_ferramentas").delete().eq("agente_execucao_id", s.id);
    }
    await supabase.from("ia_agentes_execucao").delete().in("id", sessoes.map((s) => s.id));
  }
  await supabase.from("memoria_entidades").delete().eq("entidade_id", ENTIDADE_ID);
  await supabase.from("memoria_eventos").delete().eq("entidade_id", ENTIDADE_ID);
  await supabase.from("memoria_preferencias").delete().eq("entidade_id", ENTIDADE_ID);
  console.log("\n✅ Dados de teste limpos");
}

async function main() {
  console.log("=".repeat(70));
  console.log("F34A — TESTE SUPABASE: MOTOR COGNITIVO LLM");
  console.log("=".repeat(70));

  await ensureData();
  await testPromptDinamico();
  await testPlanejamento();
  await testExecucaoCognitiva();
  await testFallback();
  await limpar();

  console.log("\n" + "=".repeat(70));
  console.log("🎯 F34A — TODOS OS TESTES CONCLUÍDOS");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ TESTE FALHOU:", err.message);
  process.exit(1);
});
