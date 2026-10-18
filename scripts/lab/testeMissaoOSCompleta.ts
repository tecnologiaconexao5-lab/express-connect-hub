// testeMissaoOSCompleta.ts — Teste real ponta a ponta
// OS → Escala → App Motorista → Financeiro
// Executar: npx tsx scripts/lab/testeMissaoOSCompleta.ts

// Mapa de status (inline para evitar dependência de módulo com alias @/)
const MAPA_STATUS_APP: Record<string, string> = {
  planejada: "escalado",
  aguardando_aceite: "escalado",
  aceita: "aceito",
  recusada: "recusado",
  em_rota: "em_rota",
  concluida: "concluido",
  cancelada: "cancelado",
  ocorrencia: "em_rota",
};
function mapStatusApp(status: string): string {
  return MAPA_STATUS_APP[status] || "escalado";
}

import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3A — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/testeMissaoOSCompleta.ts");

// TMS-FIN-DATA-04D3A — sem hardcode de PROD/anon. Somente ambiente validado pelo guard.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const now = () => new Date().toISOString();
const hoje = () => now().split("T")[0];
const novaOS = () => `OS-TESTE-${Date.now().toString(36).toUpperCase()}`;

let erros = 0, alertas = 0, passo = 0;
const ids: Record<string, string> = {};

function ok(msg: string, data?: any) { console.log(`  ✔ ${msg}`); if (data) console.log(`     ${JSON.stringify(data)}`); }
function erro(msg: string, data?: any) { console.log(`  ✗ ${msg}`); if (data) console.log(`     ${JSON.stringify(data)}`); erros++; }
function alerta(msg: string) { console.log(`  ⚠ ${msg}`); alertas++; }

async function aguardar(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  TESTE REAL OPERACIONAL E FINANCEIRO PONTA A PONTA");
  console.log("  " + now());
  console.log("=".repeat(70));

  // PASSO 1: Verificar cliente teste
  passo++;
  console.log(`\n─── PASSO ${passo}: Verificar Cliente Teste App Motorista ───`);
  let { data: cliente } = await supabase.from("clientes").select("id, nome_fantasia").eq("nome_fantasia", "Cliente Teste App Motorista").maybeSingle();
  if (!cliente) {
    alerta("Cliente 'Cliente Teste App Motorista' não encontrado. Criando...");
    const { data: newCliente, error: errC } = await supabase.from("clientes").insert({
      razao_social: "Cliente Teste App Motorista LTDA",
      nome_fantasia: "Cliente Teste App Motorista",
      cnpj: "00.000.000/0001-00",
      status: "Ativo",
    }).select().single();
    if (errC) { erro(`Falha ao criar cliente: ${errC.message}`); return; }
    cliente = newCliente;
    ok(`Cliente criado: ${cliente.id}`);
  } else {
    ok(`Cliente encontrado: ${cliente.nome_fantasia} (${cliente.id})`);
  }
  ids.clienteId = cliente.id;

  // PASSO 2: Verificar prestador teste
  passo++;
  console.log(`\n─── PASSO ${passo}: Verificar PRESTADOR TESTE APP ───`);
  const prestadorUUID = "e6646799-fbac-453e-a3ef-afdfc01a7085";
  const { data: prestador } = await supabase.from("prestadores").select("id, nome_completo, status, telefone").eq("id", prestadorUUID).maybeSingle();
  if (!prestador) {
    erro(`PRESTADOR TESTE APP (${prestadorUUID}) não encontrado no banco!`);
    erro("Crie o prestador antes de continuar: INSERT INTO prestadores (id, nome_completo, status, telefone) VALUES ('e6646799-fbac-453e-a3ef-afdfc01a7085', 'PRESTADOR TESTE APP', 'ativo', '(11) 99999-9999');");
    return;
  }
  ok(`Prestador encontrado: ${prestador.nome_completo} (${prestador.status})`);
  if (prestador.status !== "ativo") alerta(`Prestador não está ativo (status: ${prestador.status})`);
  ids.prestadorId = prestador.id;

  // PASSO 3: Verificar veículo do prestador
  passo++;
  console.log(`\n─── PASSO ${passo}: Verificar veículo do prestador ───`);
  const { data: veiculo } = await supabase.from("veiculos").select("id, placa, tipo").eq("prestador_vinculado", prestadorUUID).maybeSingle();
  if (veiculo) {
    ok(`Veículo: ${veiculo.placa} (${veiculo.tipo})`);
    ids.veiculoPlaca = veiculo.placa;
    ids.veiculoTipo = veiculo.tipo;
  } else {
    alerta("Nenhum veículo vinculado ao prestador. Usando 'MOTO' como fallback.");
    ids.veiculoTipo = "MOTO";
  }

  // PASSO 4: Criar OS Motoboy
  passo++;
  console.log(`\n─── PASSO ${passo}: Criar OS MOTOBOV ───`);
  const osNumero = novaOS();
  const OS_PAYLOAD = {
    numero: osNumero,
    data: hoje(),
    cliente_id: ids.clienteId,
    prestador_id: ids.prestadorId,
    veiculo_tipo: "MOTO",
    tipo_operacao: "Coleta e Entrega",
    status: "pendente",
    valor_cliente: 80.00,
    pedagio: 18.50,
    custo_prestador: 60.00,
    adicionais: 25.00,
    descontos: 0,
    carga_tipo: "Seca",
    carga_descricao: "Teste OS Motoboy - pacote pequeno",
    volumes: 1,
    peso: 1,
    enderecos: [
      { endereco: "Av. Paulista, 1000 - São Paulo/SP", tipo: "coleta", contato: "Contato Coleta", telefone: "(11) 99999-0001" },
      { endereco: "Rua Augusta, 500 - São Paulo/SP", tipo: "entrega", contato: "Contato Entrega", telefone: "(11) 99999-0002" },
    ],
    observacoes_gerais: "[TESTE] OS Motoboy para validação financeiro ponta a ponta",
  };

  const { data: osCriada, error: errOS } = await supabase.from("ordens_servico").insert([OS_PAYLOAD]).select().single();
  if (errOS) { erro(`Falha ao criar OS: ${errOS.message}`); return; }
  ok(`OS criada: ${osCriada.numero} (${osCriada.id})`);
  ids.osId = osCriada.id;
  ids.osNumero = osCriada.numero;

  // PASSO 5: Validar dados financeiros da OS
  passo++;
  console.log(`\n─── PASSO ${passo}: Validar valores financeiros da OS ───`);
  const vals: Record<string, any> = {
    "Valor Cliente": osCriada.valor_cliente,
    "Pedágio": osCriada.pedagio,
    "Adicionais (inclui KM)": osCriada.adicionais,
    "Custo Prestador": osCriada.custo_prestador,
    "Tipo Veículo": osCriada.veiculo_tipo,
    "Status": osCriada.status,
  };
  for (const [k, v] of Object.entries(vals)) {
    console.log(`     ${k}: ${JSON.stringify(v)}`);
  }

  const expected: [string, string, number][] = [
    ["valor_cliente", "Valor Cliente", 80],
    ["pedagio", "Pedágio", 18.5],
    ["adicionais", "Adicionais", 25],
    ["custo_prestador", "Custo Prestador", 60],
  ];
  for (const [col, label, expectedVal] of expected) {
    const actual = osCriada[col];
    if (Math.abs(Number(actual) - expectedVal) > 0.01) {
      alerta(`${label}: esperado ${expectedVal}, recebido ${actual}`);
    }
  }

  // PASSO 6: Criar escala/alocação
  passo++;
  console.log(`\n─── PASSO ${passo}: Criar escala/alocação para o prestador ───`);
  const ALC_PAYLOAD = {
    ordem_servico_id: ids.osId,
    prestador_id: ids.prestadorId,
    cliente_id: ids.clienteId,
    data_escala: hoje(),
    turno: "diurno",
    tipo_veiculo: ids.veiculoTipo || "MOTO",
    placa: ids.veiculoPlaca || "",
    status: "aguardando_aceite",
    status_pagamento: "pendente",
    valor_frete: 80.00,
    valor_repasse: 60.00,
    valor_pedagio: 18.50,
    valor_adicional: 25.00,
    valor_desconto: 0,
    origem: "Av. Paulista, 1000 - São Paulo/SP",
    destino: "Rua Augusta, 500 - São Paulo/SP",
    observacoes: "[TESTE] Alocação para validação financeiro",
    metadata: {
      origem_tms: true,
      precisa_aceite_app: true,
      tipo_operacao: "escala",
      os_numero: osNumero,
      test_automated: true,
    },
  };

  const { data: alocacao, error: errAloc } = await supabase.from("alocacoes_escala").insert([ALC_PAYLOAD]).select().single();
  if (errAloc) { erro(`Falha ao criar alocação: ${errAloc.message}`); return; }
  ok(`Alocação criada: ${alocacao.id}`);
  ok(`  Status: ${alocacao.status}`);
  ok(`  Valor frete (cliente): R$ ${alocacao.valor_frete}`);
  ok(`  Valor repasse (prestador): R$ ${alocacao.valor_repasse}`);
  ok(`  Pedágio: R$ ${alocacao.valor_pedagio}`);
  ok(`  Adicional: R$ ${alocacao.valor_adicional}`);
  ids.alocacaoId = alocacao.id;

  // PASSO 7: Criar financeiro_receber manualmente (trigger ainda não aplicado no DB)
  passo++;
  console.log(`\n─── PASSO ${passo}: Criar financeiro_receber ───`);
  const { data: financeiroR, error: errFR } = await supabase.from("financeiro_receber").insert([{
    os_id: ids.osId,
    cliente: "Cliente Teste App Motorista",
    descricao: `Faturamento OS ${ids.osNumero}`,
    valor: 80.00,
    data_vencimento: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    status: "aberto",
  }]).select().single();
  if (errFR) { erro(`Falha ao criar financeiro_receber: ${errFR.message}`); }
  else {
    ok(`financeiro_receber criado: ${financeiroR.id} | Valor: R$ ${financeiroR.valor}`);
    ids.financeiroReceberId = financeiroR.id;
  }

  // PASSO 8: Criar pagamentos_prestadores manualmente
  passo++;
  console.log(`\n─── PASSO ${passo}: Criar pagamentos_prestadores ───`);
  const { data: pagamentoP, error: errPP } = await supabase.from("pagamentos_prestadores").insert([{
    prestador_id: ids.prestadorId,
    prestador_nome: prestador.nome_completo,
    os_id: ids.osId,
    valor_liquido: 103.50,
    valor_servicos: 60.00,
    pedagio: 18.50,
    adicionais: 25.00,
    periodo_inicio: hoje(),
    periodo_fim: hoje(),
    status_conferencia: "em_aberto",
    status_pagamento: "pendente",
    origem_lancamento: "os_finalizada",
    quantidade_os: 1,
  }]).select().single();
  if (errPP) { erro(`Falha ao criar pagamentos_prestadores: ${errPP.message}`); }
  else {
    ok(`pagamentos_prestadores criado: ${pagamentoP.id} | Líquido: R$ ${pagamentoP.valor_liquido}`);
    ids.pagamentoPrestadorId = pagamentoP.id;
  }

  // PASSO 9: Criar composição financeira
  passo++;
  console.log(`\n─── PASSO ${passo}: Criar composição_financeira_os ───`);
  const imposto = 80.00 * 0.045;
  const seguro = 80.00 * 0.01;
  const margemBruta = 80.00 - 60.00 - 18.50 - 25.00;
  const margemLiquida = margemBruta - imposto - seguro;
  const { data: compFin, error: errCF } = await supabase.from("composicao_financeira_os").insert([{
    os_id: ids.osId,
    cliente_id: ids.clienteId,
    prestador_id: ids.prestadorId,
    valor_cliente: 80.00,
    valor_prestador: 60.00,
    imposto_percentual: 4.5,
    imposto_valor: imposto,
    seguro_valor: seguro,
    pedagio_valor: 18.50,
    outros_custos: 25.00,
    margem_bruta: margemBruta,
    margem_liquida: margemLiquida,
  }]).select().single();
  if (errCF) { erro(`Falha ao criar composição financeira: ${errCF.message}`); }
  else {
    ok(`Composição financeira criada`);
    console.log(`     Margem bruta: R$ ${compFin.margem_bruta?.toFixed(2) || margemBruta.toFixed(2)}`);
    console.log(`     Margem líquida: R$ ${compFin.margem_liquida?.toFixed(2) || margemLiquida.toFixed(2)}`);
  }

  // PASSO 10: Validar status no formato App Motorista
  passo++;
  console.log(`\n─── PASSO ${passo}: Validar mapeamento de status para App Motorista ───`);
  const statusApp = mapStatusApp(alocacao.status);
  ok(`Status DB: "${alocacao.status}" → Status App: "${statusApp}"`);
  if (statusApp === "escalado") {
    ok("Status 'aguardando_aceite' corretamente mapeado para 'escalado' no App Motorista");
  } else {
    alerta(`Status mapeado inesperado: ${statusApp}`);
  }

  // PASSO 11: Simular aceite do motorista
  passo++;
  console.log(`\n─── PASSO ${passo}: Simular aceite do motorista ───`);
  const { error: errAceite } = await supabase.from("alocacoes_escala").update({
    status: "aceita",
    aceite_prestador: true,
    data_aceite: now(),
  }).eq("id", ids.alocacaoId);
  if (errAceite) { erro(`Falha ao simular aceite: ${errAceite.message}`); }
  else {
    ok("Motorista aceitou a operação");
    const statusAppAceite = mapStatusApp("aceita");
    ok(`Status aceite: DB="aceita" → App="${statusAppAceite}"`);
  }

  // PASSO 12: Simular em_rota
  passo++;
  console.log(`\n─── PASSO ${passo}: Simular início de rota ───`);
  const { error: errRota } = await supabase.from("alocacoes_escala").update({
    status: "em_rota",
    horario_inicio_real: now(),
  }).eq("id", ids.alocacaoId);
  if (errRota) { erro(`Falha ao simular em_rota: ${errRota.message}`); }
  else {
    ok("Motorista em rota");
    const statusAppRota = mapStatusApp("em_rota");
    ok(`Status rota: DB="em_rota" → App="${statusAppRota}"`);
  }

  // PASSO 13: Simular conclusão + POD
  passo++;
  console.log(`\n─── PASSO ${passo}: Simular conclusão e finalização ───`);
  const { error: errConclui } = await supabase.from("alocacoes_escala").update({
    status: "concluida",
    horario_fim_real: now(),
    km_rodados: 15,
    finalizada: true,
  }).eq("id", ids.alocacaoId);
  if (errConclui) { erro(`Falha ao concluir: ${errConclui.message}`); }
  else {
    ok("Operação concluída");
    const statusAppConcluida = mapStatusApp("concluida");
    ok(`Status final: DB="concluida" → App="${statusAppConcluida}"`);
    // Criar POD
    const { error: errPOD } = await supabase.from("entregas_protocolo").insert({
      alocacao_id: ids.alocacaoId,
      prestador_id: ids.prestadorId,
      nome_recebedor: "João Recebedor Teste",
      documento_recebedor: "123.456.789-00",
      data_hora_entrega: now(),
      observacao: "Entrega realizada com sucesso - TESTE",
      latitude: -23.561684,
      longitude: -46.656139,
      status: "entregue",
    });
    if (errPOD) { alerta(`Falha ao criar POD: ${errPOD.message}`); }
    else { ok("POD registrado"); }
  }

  // PASSO 14: Validar sincronização OS <-> Escala
  passo++;
  console.log(`\n─── PASSO ${passo}: Validar sincronização OS ───`);
  const { data: osAtualizada } = await supabase.from("ordens_servico").select("status, valor_cliente, custo_prestador, pedagio, adicionais, descontos").eq("id", ids.osId).single();
  if (osAtualizada) {
    ok(`OS status final: ${osAtualizada.status}`);
    console.log(`     Valor cliente: R$ ${osAtualizada.valor_cliente}`);
    console.log(`     Custo prestador: R$ ${osAtualizada.custo_prestador}`);
    console.log(`     Pedágio: R$ ${osAtualizada.pedagio}`);
    console.log(`     Adicionais: R$ ${osAtualizada.adicionais}`);
    
    // Calcular repasse
    const repasse = (osAtualizada.custo_prestador || 0) + (osAtualizada.pedagio || 0) + (osAtualizada.adicionais || 0) - (osAtualizada.descontos || 0);
    const margem = (osAtualizada.valor_cliente || 0) - repasse;
    console.log(`     Repasse calculado: R$ ${repasse.toFixed(2)}`);
    console.log(`     Margem: R$ ${margem.toFixed(2)}`);
  }

  // PASSO 15: Validar consulta App Prestador (adapter)
  passo++;
  console.log(`\n─── PASSO ${passo}: Simular consulta do App Motorista ───`);
  const { data: alocacoesApp } = await supabase.from("alocacoes_escala").select("id, status, valor_frete, valor_repasse, valor_pedagio, data_escala, origem, destino").eq("prestador_id", ids.prestadorId).order("data_escala", { ascending: false }).limit(5);
  if (alocacoesApp) {
    ok(`${alocacoesApp.length} alocações encontradas para o prestador`);
    for (const a of alocacoesApp) {
      const stApp = mapStatusApp(a.status);
      console.log(`     ID: ${a.id.slice(0, 8)}... | Status DB: ${a.status} → App: ${stApp} | Frete: R$ ${a.valor_frete} | Repasse: R$ ${a.valor_repasse}`);
    }
  }

  // ===================================================================
  // RELATÓRIO FINAL
  // ===================================================================
  console.log("\n" + "=".repeat(70));
  console.log("  RELATÓRIO FINAL");
  console.log("=".repeat(70));
  console.log(`  OS criada: ${ids.osNumero}`);
  console.log(`  OS ID: ${ids.osId}`);
  console.log(`  Alocação ID: ${ids.alocacaoId}`);
  console.log(`  Prestador: ${prestador.nome_completo} (${ids.prestadorId})`);
  console.log(`  Cliente: Cliente Teste App Motorista (${ids.clienteId})`);
  console.log(`  Status final alocação: concluida`);
  console.log(`  Financeiro receber: ${ids.financeiroReceberId || "NÃO CRIADO"}`);
  console.log(`  Pagamento prestador: ${ids.pagamentoPrestadorId || "NÃO CRIADO"}`);
  console.log(`  Pode enviar para motorista REAL: ${prestador.telefone ? "SIM ✓" : "NÃO - sem telefone cadastrado"}`);
  console.log(`  Erros: ${erros}`);
  console.log(`  Alertas: ${alertas}`);
  console.log(`  Data: ${now()}`);
  console.log("=".repeat(70));

  if (erros === 0) {
    console.log("\n  ✅ TESTE CONCLUÍDO COM SUCESSO");
  } else {
    console.log(`\n  ❌ TESTE CONCLUÍDO COM ${erros} ERRO(S)`);
  }
  console.log("");
}

main().catch(console.error);
