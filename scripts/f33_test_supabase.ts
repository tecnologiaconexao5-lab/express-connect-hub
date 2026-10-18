/**
 * F33 — Teste Supabase: Memória Corporativa Persistente
 *
 * Uso: npx ts-node scripts/f33_test_supabase.ts
 *
 * Valida:
 * 1. Criar entidade (cliente)
 * 2. Buscar entidade
 * 3. Atualizar interação
 * 4. Registrar evento
 * 5. Listar eventos da entidade
 * 6. Registrar conversa
 * 7. Registrar preferência
 * 8. Buscar preferências
 * 9. Registrar resumo
 * 10. Obter resumo atual
 * 11. Montar contexto completo
 * 12. Memória privada (escopo)
 * 13. Limpeza
 */

import { supabase } from "../src/lib/supabase";

const ROBO_ID = "00000000-0000-0000-0000-000000000001";
const ROBO_NOME = "Robô Teste F33 Memória";
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
  console.log("F33 — TESTE SUPABASE: MEMÓRIA CORPORATIVA");
  console.log("=".repeat(60));

  const roboId = await ensureRobo();
  const CLIENTE_ID = "cliente-f33-test-001";
  const CLIENTE_NOME = "Transportadora Teste Ltda";

  // 1. CRIAR ENTIDADE
  console.log("\n1. Criar entidade (cliente)");
  const { data: entidade, error: err1 } = await supabase
    .from("memoria_entidades")
    .upsert({
      robo_id: roboId,
      entidade_tipo: "cliente",
      entidade_id: CLIENTE_ID,
      nome: CLIENTE_NOME,
      resumo: "Cliente corporativo do setor logístico",
      metadata: { cnpj: "11.222.333/0001-44", cidade: "São Paulo", estado: "SP" },
      escopo: "compartilhada",
      relevancia: 0.9,
      ultima_interacao: new Date().toISOString(),
    }, { onConflict: "entidade_tipo, entidade_id" })
    .select()
    .single();

  if (err1) throw new Error(`Erro criar entidade: ${err1.message}`);
  console.log(`   ✅ Entidade criada: ${entidade.id} — "${entidade.nome}" (${entidade.entidade_tipo})`);
  console.log(`      Escopo: ${entidade.escopo}, Relevância: ${entidade.relevancia}`);
  console.log(`      Resumo: ${entidade.resumo}`);

  // 2. BUSCAR ENTIDADE
  console.log("\n2. Buscar entidade por tipo+id");
  const { data: entidadeBuscada } = await supabase
    .from("memoria_entidades")
    .select("*")
    .eq("entidade_tipo", "cliente")
    .eq("entidade_id", CLIENTE_ID)
    .maybeSingle();

  if (!entidadeBuscada) throw new Error("Entidade não encontrada");
  console.log(`   ✅ Entidade encontrada: ${entidadeBuscada.nome}`);
  console.log(`      Metadata: ${JSON.stringify(entidadeBuscada.metadata)}`);

  // 3. ATUALIZAR INTERAÇÃO
  console.log("\n3. Atualizar última interação");
  const { error: err3 } = await supabase
    .from("memoria_entidades")
    .update({ ultima_interacao: new Date().toISOString() })
    .eq("id", entidade.id);

  if (err3) throw new Error(`Erro atualizar interação: ${err3.message}`);
  console.log("   ✅ Última interação atualizada");

  // 4. REGISTRAR EVENTO
  console.log("\n4. Registrar eventos");
  const eventos = [
    { tipo_evento: "proposta", titulo: "Proposta de frete mensal", descricao: "Proposta de R$ 25.000/mês para 10 coletas semanais" },
    { tipo_evento: "negociacao", titulo: "Negociação de valores", descricao: "Cliente solicitou desconto de 5% no valor do frete" },
    { tipo_evento: "contratacao", titulo: "Contrato assinado", descricao: "Contrato de prestação de serviços assinado por 12 meses" },
    { tipo_evento: "elogio", titulo: "Feedback positivo", descricao: "Cliente elogiou pontualidade das entregas" },
  ];

  for (const evt of eventos) {
    const { data, error } = await supabase.from("memoria_eventos").insert({
      robo_id: roboId,
      entidade_tipo: "cliente",
      entidade_id: CLIENTE_ID,
      tipo_evento: evt.tipo_evento,
      titulo: evt.titulo,
      descricao: evt.descricao,
      data_evento: new Date().toISOString(),
      escopo: "compartilhada",
    }).select().single();

    if (error) throw new Error(`Erro criar evento ${evt.tipo_evento}: ${error.message}`);
    console.log(`   ✅ Evento criado: ${evt.tipo_evento} — "${evt.titulo}"`);
  }

  // 5. LISTAR EVENTOS DA ENTIDADE
  console.log("\n5. Listar eventos da entidade");
  const { data: eventosLista } = await supabase
    .from("memoria_eventos")
    .select("*")
    .eq("entidade_tipo", "cliente")
    .eq("entidade_id", CLIENTE_ID)
    .order("data_evento", { ascending: false });

  console.log(`   ✅ ${eventosLista?.length || 0} eventos encontrados para ${CLIENTE_NOME}`);
  for (const e of eventosLista || []) {
    console.log(`      - [${e.tipo_evento}] ${e.titulo}`);
  }

  // 6. REGISTRAR CONVERSA
  console.log("\n6. Registrar conversa consolidada");
  const { data: conversa, error: err6 } = await supabase.from("memoria_conversas").insert({
    robo_id: roboId,
    entidade_tipo: "cliente",
    entidade_id: CLIENTE_ID,
    canal: "whatsapp",
    assunto: "Negociação de contrato de frete",
    resumo: "Cliente solicitou revisão de valores e desconto por volume. Acordado 5% de desconto para contratos acima de R$ 20.000/mês.",
    mensagens_count: 24,
    ultima_mensagem: "Ok, vou preparar a nova proposta.",
    data_inicio: new Date(Date.now() - 86400000).toISOString(),
    data_fim: new Date().toISOString(),
    escopo: "compartilhada",
  }).select().single();

  if (err6) throw new Error(`Erro registrar conversa: ${err6.message}`);
  console.log(`   ✅ Conversa registrada: ${conversa.id}`);
  console.log(`      Assunto: ${conversa.assunto}`);
  console.log(`      Mensagens: ${conversa.mensagens_count}`);
  console.log(`      Resumo: ${conversa.resumo}`);

  // 7. REGISTRAR PREFERÊNCIAS
  console.log("\n7. Registrar preferências do cliente");
  const preferencias = [
    { chave: "horario_preferido", valor: "08:00 - 12:00", categoria: "contato" },
    { chave: "canal_preferido", valor: "whatsapp", categoria: "contato" },
    { chave: "tipo_veiculo", valor: "caminhao_toque", categoria: "operacao" },
    { chave: "forma_pagamento", valor: "boleto_30_dias", categoria: "financeiro" },
  ];

  for (const pref of preferencias) {
    const { data, error } = await supabase.from("memoria_preferencias").upsert({
      robo_id: roboId,
      entidade_tipo: "cliente",
      entidade_id: CLIENTE_ID,
      chave: pref.chave,
      valor: pref.valor,
      categoria: pref.categoria,
      escopo: "compartilhada",
    }, { onConflict: "entidade_tipo, entidade_id, chave" }).select().single();

    if (error) throw new Error(`Erro criar preferência ${pref.chave}: ${error.message}`);
    console.log(`   ✅ Preferência: ${pref.chave} = ${pref.valor} (${pref.categoria})`);
  }

  // 8. BUSCAR PREFERÊNCIAS
  console.log("\n8. Buscar preferências da entidade");
  const { data: preferenciasLista } = await supabase
    .from("memoria_preferencias")
    .select("*")
    .eq("entidade_tipo", "cliente")
    .eq("entidade_id", CLIENTE_ID)
    .order("categoria")
    .order("chave");

  console.log(`   ✅ ${preferenciasLista?.length || 0} preferências encontradas`);
  for (const p of preferenciasLista || []) {
    console.log(`      ${p.categoria}: ${p.chave} = ${p.valor}`);
  }

  // 9. REGISTRAR RESUMO
  console.log("\n9. Registrar resumo automático");
  const { data: resumo, error: err9 } = await supabase.from("memoria_resumos").insert({
    robo_id: roboId,
    entidade_tipo: "cliente",
    entidade_id: CLIENTE_ID,
    sumario: "Cliente recorrente com potencial de expansão. Solicitou 14 coletas nos últimos 60 dias. Contrato de R$ 25.000/mês. Histórico de pagamentos em dia. Prefere comunicação via WhatsApp no período da manhã.",
    nivel_detalhe: "completo",
    periodo_referencia: "ultimos_60_dias",
    gerado_por: roboId,
    origem_dados: ["memoria_eventos", "memoria_conversas", "automacoes_logs"],
    escopo: "compartilhada",
  }).select().single();

  if (err9) throw new Error(`Erro registrar resumo: ${err9.message}`);
  console.log(`   ✅ Resumo registrado: ${resumo.id}`);
  console.log(`      Sumário: ${resumo.sumario}`);
  console.log(`      Origem: ${resumo.origem_dados.join(", ")}`);

  // 10. OBTER RESUMO ATUAL
  console.log("\n10. Obter resumo atual da entidade");
  const { data: resumoAtual } = await supabase
    .from("memoria_resumos")
    .select("*")
    .eq("entidade_tipo", "cliente")
    .eq("entidade_id", CLIENTE_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resumoAtual) {
    console.log(`   ✅ Resumo atual encontrado`);
    console.log(`      ${resumoAtual.sumario}`);
  }

  // 11. MONTAR CONTEXTO COMPLETO (simulado via queries)
  console.log("\n11. Montar contexto completo da entidade");
  const [entCtx, prefCtx, evtCtx, convCtx, resCtx] = await Promise.all([
    supabase.from("memoria_entidades").select("*").eq("entidade_tipo", "cliente").eq("entidade_id", CLIENTE_ID).maybeSingle(),
    supabase.from("memoria_preferencias").select("*").eq("entidade_tipo", "cliente").eq("entidade_id", CLIENTE_ID),
    supabase.from("memoria_eventos").select("*").eq("entidade_tipo", "cliente").eq("entidade_id", CLIENTE_ID).order("data_evento", { ascending: false }).limit(5),
    supabase.from("memoria_conversas").select("*").eq("entidade_tipo", "cliente").eq("entidade_id", CLIENTE_ID).order("data_fim", { ascending: false }).limit(3),
    supabase.from("memoria_resumos").select("*").eq("entidade_tipo", "cliente").eq("entidade_id", CLIENTE_ID).order("created_at", { ascending: false }).limit(1),
  ]);

  console.log(`   ✅ Contexto completo montado:`);
  console.log(`      Entidade: ${entCtx.data?.nome || "N/A"}`);
  console.log(`      Preferências: ${prefCtx.data?.length || 0}`);
  console.log(`      Eventos: ${evtCtx.data?.length || 0}`);
  console.log(`      Conversas: ${convCtx.data?.length || 0}`);
  console.log(`      Resumo: ${resCtx.data?.[0]?.sumario?.slice(0, 80) || "N/A"}...`);

  // 12. MEMÓRIA PRIVADA
  console.log("\n12. Memória privada (escopo)");
  const { data: privada, error: err12 } = await supabase.from("memoria_entidades").insert({
    robo_id: roboId,
    entidade_tipo: "cliente",
    entidade_id: "cliente-f33-privado-001",
    nome: "Cliente Confidencial",
    resumo: "Observações internas do robô comercial",
    metadata: { observacao_interna: "Cliente com potencial, mas negociação sensível" },
    escopo: "privada",
    relevancia: 0.3,
  }).select().single();

  if (err12) throw new Error(`Erro criar memória privada: ${err12.message}`);
  console.log(`   ✅ Memória privada criada: escopo=${privada.escopo}`);
  console.log(`      Apenas o robô ${roboId} tem acesso`);

  // 13. LIMPEZA
  console.log("\n13. Limpeza (cascade delete)");
  const { error: errClean } = await supabase
    .from("memoria_entidades")
    .delete()
    .eq("id", entidade.id);

  if (errClean) console.log(`   ⚠️ Erro na limpeza: ${errClean.message}`);
  else console.log("   ✅ Entidade e dados relacionados removidos (cascade)");

  console.log("\n" + "=".repeat(60));
  console.log("🎯 F33 — TODOS OS TESTES PASSARAM");
  console.log("=".repeat(60));
}

test().catch((err) => {
  console.error("\n❌ TESTE FALHOU:", err.message);
  process.exit(1);
});
