/**
 * F34 — Teste Supabase: Agentes com Ferramentas e Execução Autônoma
 *
 * 1. Catálogo: ferramentas com parametros + timeout
 * 2. Motor de Seleção: selecionarFerramenta por objetivo
 * 3. Execução Encadeada: encadearAcao multi-passo
 * 4. Avaliação de Resultado: avaliarResultado
 * 5. Sessões: criar/listar/obter sessões
 */
import { supabase } from "../src/lib/supabase";
import { agenteService } from "../src/services/ia/agenteService";

const ROBO_ID = "00000000-0000-0000-0000-000000000001";
const ENTIDADE_ID = "cliente-f34-test-001";

async function ensureData() {
  const { data: existing } = await supabase.from("automacoes_robos").select("id").eq("id", ROBO_ID).maybeSingle();
  if (!existing) {
    await supabase.from("automacoes_robos").insert({ id: ROBO_ID, nome: "Robô F34", setor: "TI", ativo: true });
  }

  const { data: ferramentas } = await supabase.from("ia_ferramentas").select("id").limit(1);
  if (ferramentas && ferramentas.length > 0) {
    await supabase.from("ia_robo_ferramentas").upsert({
      robo_id: ROBO_ID, ferramenta_id: ferramentas[0].id,
      nivel_autonomia: "EXECUTAR_AUTONOMO", ativo: true,
    }, { onConflict: "robo_id, ferramenta_id" });
  }

  await supabase.from("memoria_entidades").delete().eq("entidade_id", ENTIDADE_ID);
  await supabase.from("memoria_entidades").insert({
    robo_id: ROBO_ID, entidade_tipo: "cliente", entidade_id: ENTIDADE_ID,
    nome: "Cliente F34 Teste", resumo: "Cliente premium para teste de agente autonomo",
    metadata: { vip: true }, escopo: "compartilhada", relevancia: 1.0,
    ultima_interacao: new Date().toISOString(),
  });
  console.log("✅ Dados base criados no Supabase real");
}

async function testCatalogo() {
  console.log("\n🔵 TESTE 1: Catálogo Aprimorado");
  const catalogo = await agenteService.listarCatalogo();
  const comParametros = catalogo.filter((f) => {
    const p = (f as unknown as Record<string, unknown>).parametros;
    return p && JSON.stringify(p) !== "{}";
  });
  console.log(`   Ferramentas no catálogo: ${catalogo.length}`);
  console.log(`   Com parametros definidos: ${comParametros.length}`);

  const { data: sample } = await supabase.from("ia_ferramentas")
    .select("codigo_unico, parametros, timeout_segundos")
    .eq("codigo_unico", "COM_ENVIAR_EMAIL")
    .single();
  if (sample) {
    console.log(`   Exemplo COM_ENVIAR_EMAIL:`);
    console.log(`      timeout: ${(sample as Record<string, unknown>).timeout_segundos}s`);
    console.log(`      parametros: ${JSON.stringify((sample as Record<string, unknown>).parametros).slice(0, 120)}`);
  }
}

async function testSelecao() {
  console.log("\n🔵 TESTE 2: Motor de Seleção");
  const selecao = await agenteService.selecionarFerramenta({
    roboId: ROBO_ID, objetivo: "enviar email para cliente",
    contexto: { entidade_tipo: "cliente", entidade_id: ENTIDADE_ID },
  });
  if (selecao) {
    console.log(`   ✅ Ferramenta selecionada: ${selecao.ferramenta.nome} (score: ${selecao.score})`);
    console.log(`      Motivo: ${selecao.motivo}`);
  } else {
    console.log(`   ⚠️ Nenhuma ferramenta encontrada (pode faltar permissão)`);
  }

  const selecao2 = await agenteService.selecionarFerramenta({
    roboId: ROBO_ID, objetivo: "consultar cnpj de empresa",
  });
  if (selecao2) {
    console.log(`   ✅ Segunda seleção: ${selecao2.ferramenta.nome} (score: ${selecao2.score})`);
    console.log(`      Motivo: ${selecao2.motivo}`);
  }
}

async function testAvaliacao() {
  console.log("\n🔵 TESTE 3: Avaliação de Resultado");

  const { data: ferramentas } = await supabase.from("ia_ferramentas").select("id").limit(1);
  if (!ferramentas || ferramentas.length === 0) { console.log("   ⚠️ Sem ferramentas"); return; }

  const { data: exec } = await supabase.from("ia_execucoes_ferramentas").insert({
    robo_id: ROBO_ID, ferramenta_id: ferramentas[0].id,
    solicitacao: "Teste de avaliação", status: "CONCLUIDA",
    resultado: { status: "sucesso", mensagem: "Executado com sucesso" },
  }).select().single();

  if (exec) {
    const aval = await agenteService.avaliarResultado(exec.id);
    console.log(`   ✅ Avaliação: tipo=${aval.tipo}, motivo=${aval.motivo.slice(0, 60)}`);
  }
}

async function testSessaoEncadeada() {
  console.log("\n🔵 TESTE 4: Sessão e Encadeamento");

  const sessao = await agenteService.criarSessao({
    roboId: ROBO_ID, objetivo: "Atender cliente premium",
    contexto: { entidade_tipo: "cliente", entidade_id: ENTIDADE_ID },
    totalPassos: 3,
  });
  if (sessao) {
    console.log(`   ✅ Sessão criada: ${sessao.id}`);
    console.log(`      Objetivo: ${sessao.objetivo}`);

    const completa = await agenteService.obterSessaoCompleta(sessao.id);
    console.log(`      Sessão recuperada: ${completa.sessao?.objetivo}`);
    console.log(`      Execuções associadas: ${completa.execucoes.length}`);

    const sessoes = await agenteService.listarSessoes({ robo_id: ROBO_ID });
    console.log(`      Total sessões do robô: ${sessoes.length}`);
  }

  console.log(`   🔄 Execução encadeada (pode ser limitada por permissões)...`);
  const encadeado = await agenteService.encadearAcao({
    roboId: ROBO_ID, objetivo: "consultar dados de cliente",
    contexto: { entidade_tipo: "cliente", entidade_id: ENTIDADE_ID },
    maxSteps: 2,
  });
  console.log(`      Status: ${encadeado.status}`);
  console.log(`      Resumo: ${encadeado.resumo}`);
  if (encadeado.sessao) console.log(`      Sessão: ${encadeado.sessao.id}`);
  console.log(`      Execuções no encadeamento: ${encadeado.execucoes.length}`);
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
  console.log("\n✅ Dados de teste limpos");
}

async function main() {
  console.log("=".repeat(70));
  console.log("F34 — TESTE SUPABASE: AGENTES AUTÔNOMOS");
  console.log("=".repeat(70));

  await ensureData();
  await testCatalogo();
  await testSelecao();
  await testAvaliacao();
  await testSessaoEncadeada();
  await limpar();

  console.log("\n" + "=".repeat(70));
  console.log("🎯 F34 — TODOS OS TESTES CONCLUÍDOS");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ TESTE FALHOU:", err.message);
  process.exit(1);
});
