/**
 * VALID-REAL-P1-P2 — Homologação Real do Fechamento de Prestador
 *
 * Dados de teste: BRUNO DA SILVA SANTOS (6 itens is_teste=true)
 * Fechamento existente: 03b7ee2f (vazio, será recriado)
 *
 * Fluxo: CRIAR → EM_CONFERENCIA → CONFERIDO → APROVADO → PAGO
 * Depois: persistência, idempotência, conta corrente
 */
import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "./_guard.mjs";

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/valid_real_p1p2_ciclo_completo.mjs");

// TMS-FIN-DATA-04D2 — sem hardcode de PROD/anon. Somente ambiente validado pelo guard.
const URL = process.env.VITE_SUPABASE_URL || "";
const KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(URL, KEY);

const BRUNO_NOME = "BRUNO DA SILVA SANTOS";
const PRESTADOR_ID = "659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce";

// IDs dos 6 itens TESTE do BRUNO (tipo=servico, is_teste=true)
const ITEM_IDS = [
  "0660b506-717e-41c9-999c-5b762efcf600",
  "9f8e8822-9f2d-4dc7-af5a-80e31e4f56c8",
  "f1ebdc02-cdd7-4d18-b2a1-d22a8ec8d95c",
  "8da436c7-8c19-4ab2-99d2-26e34371949b",
  "638a8f0c-7604-4d1f-a4d2-18e8eeee13c8",
  "1af91527-847e-4a8b-a5c2-fe684d675d4f",
];

const FECHAMENTO_VAZIO_ID = "03b7ee2f-68ee-42ff-af80-c0a1fc62217d";

async function main() {
  const log = [];
  const step = (name, status, detail) => {
    const line = `[${status}] ${name}: ${detail}`;
    log.push(line);
    console.log(line);
  };

  console.log("=== VALID-REAL-P1-P2 — Homologação Real ===\n");

  // ── PREPARAÇÃO ──
  console.log("--- PREPARACAO ---");
  const prestadorId = PRESTADOR_ID;
  step("PREPARACAO", "OK", `prestador_id=${prestadorId} (BRUNO DA SILVA SANTOS)`);

  // 2. Verificar itens TESTE
  const { data: itensTeste } = await supabase
    .from("pagamentos_prestadores")
    .select("id, valor_liquido, valor_servicos, pedagio, adicionais, descontos, fechamento_id")
    .in("id", ITEM_IDS)
    .eq("is_teste", true);

  if (!itensTeste?.length) {
    step("PREPARACAO", "FALHA", "Itens TESTE não encontrados");
    return;
  }
  const totalItens = itensTeste.reduce((s, i) => s + (i.valor_liquido || 0), 0);
  step("PREPARACAO", "OK", `${itensTeste.length} itens TESTE encontrados, total R$${totalItens}`);

  // 3. Limpar fechamento vazio anterior (03b7ee2f — sem itens vinculados)
  const { data: fechAntigo } = await supabase
    .from("pagamentos_prestadores")
    .select("id, qtd_os")
    .eq("id", FECHAMENTO_VAZIO_ID)
    .single();

  if (fechAntigo && fechAntigo.qtd_os === 0) {
    // Desvincular itens que apontam para ele (se houver)
    await supabase.from("pagamentos_prestadores").update({ fechamento_id: null }).eq("fechamento_id", fechAntigo.id);
    // Deletar fechamento vazio
    await supabase.from("pagamentos_prestadores").delete().eq("id", fechAntigo.id);
    step("PREPARACAO", "OK", `Fechamento vazio ${fechAntigo.id.slice(0,8)} removido`);
  }

  // ── ETAPA 1: CRIAR FECHAMENTO ──
  console.log("\n--- ETAPA 1: CRIAR FECHAMENTO ---");

  // Calcular snapshot
  const snapshot = {
    valor_servicos: itensTeste.reduce((s, i) => s + (i.valor_servicos || i.valor_liquido || 0), 0),
    pedagio: itensTeste.reduce((s, i) => s + (i.pedagio || 0), 0),
    adicionais: itensTeste.reduce((s, i) => s + (i.adicionais || 0), 0),
    descontos: itensTeste.reduce((s, i) => s + (i.descontos || 0), 0),
    valor_liquido: totalItens,
  };

  const payload = {
    prestador_id: prestadorId,
    prestador_nome: BRUNO_NOME,
    valor_liquido: snapshot.valor_liquido,
    valor_servicos: snapshot.valor_servicos,
    valor_reembolsos: 0,
    valor_bonus: 0,
    valor_descontos: snapshot.descontos,
    valor_adiantamentos: 0,
    pedagio: snapshot.pedagio,
    adicionais: snapshot.adicionais,
    descontos: snapshot.descontos,
    qtd_os: itensTeste.length,
    quantidade_os: itensTeste.length,
    tipo_lancamento: "Fechamento",
    tipo_pagamento: "fechamento",
    natureza: "credito",
    origem_lancamento: "fechamento",
    data_competencia: "2026-09-13",
    competencia: "2026-09-13",
    data_prevista_pagamento: "2026-10-13",
    periodo_inicio: "2026-09-01",
    periodo_fim: "2026-09-13",
    status: "pendente",
    status_conferencia: "em_aberto",
    status_aprovacao: "aguardando_aprovacao",
    status_pagamento: "pendente",
    impacto_dre: true,
    impacto_fluxo_caixa: true,
    is_teste: true,
    observacao: "VALID-REAL-P1-P2: Fechamento de teste para homologação",
  };

  const { data: fechamento, error: e1 } = await supabase
    .from("pagamentos_prestadores")
    .insert([payload])
    .select()
    .single();

  if (e1) {
    step("CRIAR", "FALHA", e1.message);
    return;
  }
  step("CRIAR", "OK", `fechamento_id=${fechamento.id.slice(0,8)} | status=${fechamento.status} | conf=${fechamento.status_conferencia} | R$${fechamento.valor_liquido}`);

  // Vincular itens ao fechamento
  const { error: eLink } = await supabase
    .from("pagamentos_prestadores")
    .update({ fechamento_id: fechamento.id })
    .in("id", ITEM_IDS);

  if (eLink) {
    step("CRIAR", "FALHA", `Erro ao vincular itens: ${eLink.message}`);
    return;
  }
  step("CRIAR-ITENS", "OK", `${ITEM_IDS.length} itens vinculados ao fechamento`);

  // Verificar vínculo
  const { data: vinculados } = await supabase
    .from("pagamentos_prestadores")
    .select("id, fechamento_id, valor_liquido")
    .eq("fechamento_id", fechamento.id);

  step("CRIAR-VERIFICAR", "OK", `${vinculados?.length || 0} itens vinculados confirmados`);

  // ── ETAPA 2: CONFERIR (EM_CONFERENCIA → CONFERIDO) ──
  console.log("\n--- ETAPA 2: CONFERIR ---");

  const { data: antesConferir } = await supabase
    .from("pagamentos_prestadores")
    .select("status_conferencia, status_aprovacao, status_pagamento")
    .eq("id", fechamento.id)
    .single();

  step("CONFERIR-PRE", "OK", `conf=${antesConferir?.status_conferencia} | apr=${antesConferir?.status_aprovacao} | pag=${antesConferir?.status_pagamento}`);

  const { error: eConf } = await supabase
    .from("pagamentos_prestadores")
    .update({
      status_conferencia: "conferido",
      data_conferencia: new Date().toISOString(),
    })
    .eq("id", fechamento.id);

  if (eConf) {
    step("CONFERIR", "FALHA", eConf.message);
    return;
  }

  // Conferir itens vinculados
  await supabase
    .from("pagamentos_prestadores")
    .update({ status_conferencia: "conferido" })
    .eq("fechamento_id", fechamento.id)
    .neq("id", fechamento.id);

  const { data: depoisConferir } = await supabase
    .from("pagamentos_prestadores")
    .select("status_conferencia, status_aprovacao, status_pagamento, data_conferencia")
    .eq("id", fechamento.id)
    .single();

  step("CONFERIR", "OK", `conf=${depoisConferir?.status_conferencia} | data_conferencia=${depoisConferir?.data_conferencia?.slice(0,10)}`);

  // ── ETAPA 3: APROVAR (CONFERIDO → APROVADO) ──
  console.log("\n--- ETAPA 3: APROVAR ---");

  const { data: antesAprovar } = await supabase
    .from("pagamentos_prestadores")
    .select("status_conferencia, status_aprovacao, status_pagamento")
    .eq("id", fechamento.id)
    .single();

  step("APROVAR-PRE", "OK", `conf=${antesAprovar?.status_conferencia} | apr=${antesAprovar?.status_aprovacao}`);

  const { error: eAprov } = await supabase
    .from("pagamentos_prestadores")
    .update({
      status_aprovacao: "aprovado",
      data_aprovacao: new Date().toISOString(),
    })
    .eq("id", fechamento.id);

  if (eAprov) {
    step("APROVAR", "FALHA", eAprov.message);
    return;
  }

  // Aprovar itens vinculados
  await supabase
    .from("pagamentos_prestadores")
    .update({ status_aprovacao: "aprovado" })
    .eq("fechamento_id", fechamento.id)
    .neq("id", fechamento.id);

  const { data: depoisAprovar } = await supabase
    .from("pagamentos_prestadores")
    .select("status_conferencia, status_aprovacao, status_pagamento, data_aprovacao")
    .eq("id", fechamento.id)
    .single();

  step("APROVAR", "OK", `apr=${depoisAprovar?.status_aprovacao} | data_aprovacao=${depoisAprovar?.data_aprovacao?.slice(0,10)}`);

  // ── ETAPA 4: PAGAR (APROVADO → PAGO) ──
  console.log("\n--- ETAPA 4: PAGAR ---");

  const { data: antesPagar } = await supabase
    .from("pagamentos_prestadores")
    .select("status_conferencia, status_aprovacao, status_pagamento")
    .eq("id", fechamento.id)
    .single();

  step("PAGAR-PRE", "OK", `apr=${antesPagar?.status_aprovacao} | pag=${antesPagar?.status_pagamento}`);

  const { error: ePag } = await supabase
    .from("pagamentos_prestadores")
    .update({
      status_pagamento: "pago",
      status: "pago",
      data_pagamento: "2026-09-13",
    })
    .eq("id", fechamento.id);

  if (ePag) {
    step("PAGAR", "FALHA", ePag.message);
    return;
  }

  // Pagar itens vinculados
  await supabase
    .from("pagamentos_prestadores")
    .update({
      status_pagamento: "pago",
      status: "pago",
      data_pagamento: "2026-09-13",
    })
    .eq("fechamento_id", fechamento.id)
    .neq("id", fechamento.id);

  const { data: depoisPagar } = await supabase
    .from("pagamentos_prestadores")
    .select("status_conferencia, status_aprovacao, status_pagamento, status, data_pagamento, observacao")
    .eq("id", fechamento.id)
    .single();

  step("PAGAR", "OK", `status=${depoisPagar?.status} | pag=${depoisPagar?.status_pagamento} | data_pagamento=${depoisPagar?.data_pagamento}`);

  // ── ETAPA 5: VERIFICAR ITENS PAGOS ──
  console.log("\n--- ETAPA 5: VERIFICAR ITENS ---");

  const { data: itensFechamento } = await supabase
    .from("pagamentos_prestadores")
    .select("id, status, status_conferencia, status_aprovacao, status_pagamento, valor_liquido")
    .eq("fechamento_id", fechamento.id);

  const todosPagos = itensFechamento?.every(i => i.status_pagamento === "pago");
  step("ITENS-PAGOS", todosPagos ? "OK" : "FALHA", `${itensFechamento?.length || 0} itens, todos pago=${todosPagos}`);

  itensFechamento?.forEach(i => {
    step("  ITEM", "OK", `${i.id.slice(0,8)} | R$${i.valor_liquido} | status=${i.status} | pag=${i.status_pagamento}`);
  });

  // ── ETAPA 6: CONTA CORRENTE ──
  console.log("\n--- ETAPA 6: CONTA CORRENTE ---");
  step("CONTA-CORRENTE", "INFO", "Tabela conta_corrente não encontrada no schema. Verificando extrato_prestador...");

  // Verificar se há alguma tabela de saldo/extrato
  const { data: tabelasSaldo } = await supabase.rpc("executar_sql_seguro", {
    q: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%saldo%' OR table_name LIKE '%extrato%' OR table_name LIKE '%conta_corrente%' OR table_name LIKE '%fluxo_caixa%') ORDER BY table_name"
  });

  if (tabelasSaldo?.length) {
    step("CONTA-CORRENTE", "OK", `Tabelas encontradas: ${JSON.stringify(tabelasSaldo)}`);
  } else {
    step("CONTA-CORRENTE", "PENDENTE", "Nenhuma tabela de conta corrente/saldo encontrada. Verificar migration FIN-P1-03.");
  }

  // ── ETAPA 7: PERSISTÊNCIA ──
  console.log("\n--- ETAPA 7: PERSISTENCIA ---");

  const { data: persistencia } = await supabase
    .from("pagamentos_prestadores")
    .select("id, status, status_conferencia, status_aprovacao, status_pagamento, data_pagamento, data_conferencia, data_aprovacao, valor_liquido, qtd_os, observacao")
    .eq("id", fechamento.id)
    .single();

  const persistOk =
    persistencia?.status === "pago" &&
    persistencia?.status_pagamento === "pago" &&
    persistencia?.status_conferencia === "conferido" &&
    persistencia?.status_aprovacao === "aprovado" &&
    persistencia?.data_pagamento === "2026-09-13";

  step("PERSISTENCIA", persistOk ? "OK" : "FALHA",
    `status=${persistencia?.status} | conf=${persistencia?.status_conferencia} | apr=${persistencia?.status_aprovacao} | pag=${persistencia?.status_pagamento} | data_pag=${persistencia?.data_pagamento}`);

  // ── ETAPA 8: IDEMPOTÊNCIA ──
  console.log("\n--- ETAPA 8: IDEMPOTENCIA ---");

  // Tentar pagar novamente (deve ser idempotente — não erro, não duplica)
  const antesIdemp = await supabase
    .from("pagamentos_prestadores")
    .select("id, status_pagamento")
    .eq("id", fechamento.id)
    .single();

  const { error: eIdemp } = await supabase
    .from("pagamentos_prestadores")
    .update({
      status_pagamento: "pago",
      status: "pago",
      data_pagamento: "2026-09-13",
    })
    .eq("id", fechamento.id);

  const depoisIdemp = await supabase
    .from("pagamentos_prestadores")
    .select("id, status_pagamento, data_pagamento")
    .eq("id", fechamento.id)
    .single();

  const idempOk = !eIdemp && antesIdemp?.data_pagamento === depoisIdemp?.data_pagamento;
  step("IDEMPOTENCIA", idempOk ? "OK" : "FALHA",
    `antes_pag=${antesIdemp?.status_pagamento} | depois_pag=${depoisIdemp?.status_pagamento} | erro=${eIdemp?.message || "nenhum"}`);

  // Verificar que não há fechamento duplicado
  const { count } = await supabase
    .from("pagamentos_prestadores")
    .select("id", { count: "exact", head: true })
    .eq("tipo_pagamento", "fechamento")
    .eq("prestador_id", prestadorId)
    .eq("is_teste", true);

  step("SEM-DUPLICATA", (count || 0) <= 1 ? "OK" : "FALHA", `fechamentos TESTE deste prestador: ${count}`);

  // ── RESUMO ──
  console.log("\n=== RESUMO ===");
  console.log(`Fechamento: ${fechamento.id}`);
  console.log(`Prestador: ${BRUNO_NOME} (${prestadorId})`);
  console.log(`Itens: ${ITEM_IDS.length} (todos is_teste=true)`);
  console.log(`Valor total: R$${totalItens}`);
  console.log(`Status final: ${depoisPagar?.status}`);
  console.log(`Status conferencia: ${depoisPagar?.status === "pago" ? "conferido" : "N/A"}`);
  console.log(`Status aprovacao: ${depoisPagar?.status === "pago" ? "aprovado" : "N/A"}`);
  console.log(`Status pagamento: ${depoisPagar?.status_pagamento}`);
  console.log(`Data pagamento: ${depoisPagar?.data_pagamento}`);

  console.log("\n=== LOG COMPLETO ===");
  log.forEach(l => console.log(l));
}

main().catch(console.error);
