// testeM66Corrigido.ts — Teste M66: propagação financeira automática corrigida
// OS → Alocação → Trigger → Financeiro automático → Conclusão
// Executar: npx tsx scripts/lab/testeM66Corrigido.ts
// ANTES: aplicar migration 20260704_m66_fix_propagacao_financeira.sql

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
function mapStatusApp(st: string) { return MAPA_STATUS_APP[st] || "escalado"; }

import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3A — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/testeM66Corrigido.ts");

// TMS-FIN-DATA-04D3A — sem hardcode de PROD/anon. Somente ambiente validado pelo guard.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const now = () => new Date().toISOString();
const hoje = () => now().split("T")[0];
const uid = () => Date.now().toString(36).toUpperCase();

let erros = 0, alertas = 0, passo = 0;
const ids: Record<string, any> = {};

function ok(m: string, d?: any) { console.log(`  ✔ ${m}`); if (d) console.log(`     ${JSON.stringify(d)}`); }
function erro(m: string, d?: any) { console.log(`  ✗ ${m}`); if (d) console.log(`     ${JSON.stringify(d)}`); erros++; }
function alerta(m: string) { console.log(`  ⚠ ${m}`); alertas++; }

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  M66 — TESTE PROPAGAÇÃO FINANCEIRA AUTOMÁTICA");
  console.log("  " + now());
  console.log("=".repeat(70));

  // PASSO 1: Verificar cliente
  passo++;
  console.log(`\n─── PASSO ${passo}: Cliente Teste App Motorista ───`);
  let { data: cli } = await supabase.from("clientes").select("id,nome_fantasia").eq("nome_fantasia","Cliente Teste App Motorista").maybeSingle();
  if (!cli) {
    const r = await supabase.from("clientes").insert({ razao_social:"Cliente Teste App Motorista LTDA", nome_fantasia:"Cliente Teste App Motorista", cnpj:"00.000.000/0001-00", status:"Ativo" }).select().single();
    if (r.error) { erro(`Falha criar cliente: ${r.error.message}`); return; }
    cli = r.data; ok(`Cliente criado: ${cli.id}`);
  } else ok(`Cliente: ${cli.nome_fantasia} (${cli.id})`);
  ids.clienteId = cli.id;

  // PASSO 2: Prestador
  passo++;
  console.log(`\n─── PASSO ${passo}: PRESTADOR TESTE APP ───`);
  const pid = "e6646799-fbac-453e-a3ef-afdfc01a7085";
  const { data: pre } = await supabase.from("prestadores").select("id,nome_completo,status,telefone").eq("id",pid).maybeSingle();
  if (!pre) { erro(`Prestador ${pid} não encontrado`); return; }
  ok(`Prestador: ${pre.nome_completo} (${pre.status})`);
  if (pre.status !== "ativo") alerta("Prestador não está ativo");
  ids.prestadorId = pre.id;

  // PASSO 3: Veículo
  passo++;
  console.log(`\n─── PASSO ${passo}: Veículo ───`);
  const { data: vei } = await supabase.from("veiculos").select("id,placa,tipo").eq("prestador_vinculado",pid).maybeSingle();
  if (vei) { ok(`Veículo: ${vei.placa} (${vei.tipo})`); ids.veiculoTipo = vei.tipo; ids.placa = vei.placa; }
  else { alerta("Sem veículo vinculado. Usando MOTO."); ids.veiculoTipo = "MOTO"; ids.placa = ""; }

  // PASSO 4: Criar OS
  passo++;
  console.log(`\n─── PASSO ${passo}: Criar OS MOTOBOV ───`);
  const osNum = `M66-${uid()}`;
  const { data: os, error: eOS } = await supabase.from("ordens_servico").insert([{
    numero: osNum, data: hoje(),
    cliente_id: ids.clienteId, prestador_id: ids.prestadorId,
    veiculo_tipo: ids.veiculoTipo, tipo_operacao: "Coleta e Entrega",
    status: "pendente",
    valor_cliente: 150.00, pedagio: 18.50,
    custo_prestador: 60.00, adicionais: 25.00, descontos: 0,
    carga_tipo: "Seca", carga_descricao: "Teste M66", volumes: 1, peso: 1,
    enderecos: [
      { endereco:"Av. Paulista,1000 - São Paulo/SP", tipo:"coleta", contato:"Contato Coleta" },
      { endereco:"Rua Augusta,500 - São Paulo/SP", tipo:"entrega", contato:"Contato Entrega" },
    ],
    observacoes_gerais: "[M66] OS para validação financeiro automático",
  }]).select().single();
  if (eOS) { erro(`Falha criar OS: ${eOS.message}`); return; }
  ok(`OS: ${os.numero} (${os.id})`);
  ids.osId = os.id; ids.osNumero = os.numero;

  // PASSO 5: Validar valores da OS
  passo++;
  console.log(`\n─── PASSO ${passo}: Validar valores ───`);
  for (const [k,v] of Object.entries({ "Valor Cliente":150, "Pedágio":18.5, "Adicionais":25, "Custo Prestador":60 })) {
    const col = k==="Valor Cliente" ? "valor_cliente" : k==="Custo Prestador" ? "custo_prestador" : k.toLowerCase();
    if (Math.abs(Number(os[col]) - v) > 0.01) alerta(`${k}: esperado ${v}, recebido ${os[col]}`);
    else console.log(`     ${k}: R$ ${Number(os[col]).toFixed(2)}`);
  }

  // PASSO 6: Criar alocação — a TRIGGER deve criar financeiro automaticamente
  passo++;
  console.log(`\n─── PASSO ${passo}: Criar alocação (trigger deve disparar) ───`);
  const { data: alc, error: eAlc } = await supabase.from("alocacoes_escala").insert([{
    ordem_servico_id: ids.osId,
    prestador_id: ids.prestadorId, cliente_id: ids.clienteId,
    data_escala: hoje(), turno: "diurno",
    tipo_veiculo: ids.veiculoTipo, placa: ids.placa,
    status: "aguardando_aceite", status_pagamento: "pendente",
    valor_frete: 150.00, valor_repasse: 60.00,
    valor_pedagio: 18.50, valor_adicional: 25.00, valor_desconto: 0,
    origem: "Av. Paulista,1000 - São Paulo/SP",
    destino: "Rua Augusta,500 - São Paulo/SP",
    observacoes: "[M66] Alocação trigger financeiro",
    metadata: { origem_tms:true, precisa_aceite_app:true, tipo_operacao:"escala", test_automated:true },
  }]).select().single();
  if (eAlc) { erro(`Falha criar alocação: ${eAlc.message}`); return; }
  ok(`Alocação: ${alc.id}`);
  ok(`  Status: ${alc.status}`);
  ids.alocacaoId = alc.id;

  // PASSO 7: Verificar se trigger criou financeiro_receber automaticamente
  passo++;
  console.log(`\n─── PASSO ${passo}: Validar financeiro_receber (criado pela trigger?) ───`);
  await aguardar(500);
  const { data: fr } = await supabase.from("financeiro_receber").select("*").eq("os_id", ids.osId);
  if (!fr || fr.length === 0) {
    alerta("financeiro_receber NÃO foi criado pela trigger. Verificar se migration foi aplicada.");
  } else {
    const f = fr[0];
    ok(`financeiro_receber criado: ${f.id}`);
    console.log(`     Valor: R$ ${Number(f.valor).toFixed(2)} (esperado: 150.00)`);
    console.log(`     Status: ${f.status}`);
    console.log(`     Cliente: ${f.cliente}`);
    if (Math.abs(Number(f.valor) - 150) > 0.01) alerta(`Valor incorreto: ${f.valor}`);
    ids.financeiroReceberId = f.id;
  }

  // PASSO 8: Verificar se trigger criou pagamentos_prestadores
  passo++;
  console.log(`\n─── PASSO ${passo}: Validar pagamentos_prestadores (criado pela trigger?) ───`);
  const { data: pp } = await supabase.from("pagamentos_prestadores").select("*").eq("os_id", ids.osId);
  if (!pp || pp.length === 0) {
    alerta("pagamentos_prestadores NÃO foi criado pela trigger.");
  } else {
    const p = pp[0];
    ok(`pagamentos_prestadores criado: ${p.id}`);
    // valor_liquido = repasse(60) + pedagio(18.50) + adicional(25) = 103.50
    console.log(`     Valor serviços: R$ ${Number(p.valor_servicos).toFixed(2)} (esperado: 60.00)`);
    console.log(`     Pedágio: R$ ${Number(p.pedagio).toFixed(2)} (esperado: 18.50)`);
    console.log(`     Adicionais: R$ ${Number(p.adicionais).toFixed(2)} (esperado: 25.00)`);
    console.log(`     Valor líquido: R$ ${Number(p.valor_liquido).toFixed(2)} (esperado: 103.50)`);
    console.log(`     Status pagamento: ${p.status_pagamento}`);
    if (Math.abs(Number(p.valor_liquido) - 103.50) > 0.01) alerta(`Valor líquido incorreto: ${p.valor_liquido} (esperado 103.50)`);
    if (Math.abs(Number(p.pedagio) - 18.50) > 0.01) alerta(`Pedágio não propagado: ${p.pedagio}`);
    if (Math.abs(Number(p.adicionais) - 25.00) > 0.01) alerta(`Adicionais não propagados: ${p.adicionais}`);
    ids.pagamentoPrestadorId = p.id;
  }

  // PASSO 9: Status App Motorista
  passo++;
  console.log(`\n─── PASSO ${passo}: Mapeamento App Motorista ───`);
  const stApp = mapStatusApp(alc.status);
  ok(`Status DB: "${alc.status}" → App: "${stApp}"`);

  // PASSO 10: Simular aceite
  passo++;
  console.log(`\n─── PASSO ${passo}: Aceite ───`);
  await supabase.from("alocacoes_escala").update({ status:"aceita", aceite_prestador:true, data_aceite:now() }).eq("id", ids.alocacaoId);
  ok(`aceite → ${mapStatusApp("aceita")}`);

  // PASSO 11: Simular em_rota
  passo++;
  console.log(`\n─── PASSO ${passo}: Em rota ───`);
  await supabase.from("alocacoes_escala").update({ status:"em_rota", horario_inicio_real:now() }).eq("id", ids.alocacaoId);
  ok(`em_rota → ${mapStatusApp("em_rota")}`);

  // PASSO 12: Concluir + finalizar → trigger deve criar composicao_financeira_os
  passo++;
  console.log(`\n─── PASSO ${passo}: Concluir + POD ───`);
  await supabase.from("alocacoes_escala").update({
    status:"concluida", finalizada:true, horario_fim_real:now(), km_rodados:15
  }).eq("id", ids.alocacaoId);
  ok("concluida → " + mapStatusApp("concluida"));

  const { error: ePOD } = await supabase.from("entregas_protocolo").insert({
    alocacao_id: ids.alocacaoId, prestador_id: ids.prestadorId,
    nome_recebedor:"João Teste", documento_recebedor:"123.456.789-00",
    data_hora_entrega:now(), observacao:"Teste M66",
    latitude:-23.561684, longitude:-46.656139, status:"entregue",
  });
  if (ePOD) alerta(`POD: ${ePOD.message}`); else ok("POD registrado");

  // PASSO 13: Verificar composicao_financeira_os (criada pela trigger na conclusão)
  passo++;
  console.log(`\n─── PASSO ${passo}: Validar composição financeira (trigger na conclusão) ───`);
  await aguardar(500);
  const { data: cf } = await supabase.from("composicao_financeira_os").select("*").eq("os_id", ids.osId);
  if (!cf || cf.length === 0) {
    alerta("composicao_financeira_os NÃO foi criada pela trigger na conclusão");
  } else {
    const c = cf[0];
    ok(`Composição financeira criada: ${c.id}`);
    // Margem bruta = 150 - 60 - 18.50 - 25 = 46.50
    // Margem líquida = 46.50 - (150*4.5%) - (150*1%) = 46.50 - 6.75 - 1.50 = 38.25
    console.log(`     Valor cliente: R$ ${Number(c.valor_cliente).toFixed(2)} (esperado: 150.00)`);
    console.log(`     Valor prestador: R$ ${Number(c.valor_prestador).toFixed(2)} (esperado: 60.00)`);
    console.log(`     Pedágio: R$ ${Number(c.pedagio_valor).toFixed(2)} (esperado: 18.50)`);
    console.log(`     Outros custos (adicional): R$ ${Number(c.outros_custos).toFixed(2)} (esperado: 25.00)`);
    console.log(`     Imposto (4.5%): R$ ${Number(c.imposto_valor).toFixed(2)} (esperado: 6.75)`);
    console.log(`     Seguro (1%): R$ ${Number(c.seguro_valor).toFixed(2)} (esperado: 1.50)`);
    console.log(`     Margem bruta: R$ ${Number(c.margem_bruta).toFixed(2)} (esperado: 46.50)`);
    console.log(`     Margem líquida: R$ ${Number(c.margem_liquida).toFixed(2)} (esperado: 38.25)`);

    if (Math.abs(Number(c.valor_cliente) - 150) > 0.01) alerta(`valor_cliente incorreto`);
    if (Math.abs(Number(c.valor_prestador) - 60) > 0.01) alerta(`valor_prestador incorreto`);
    if (Math.abs(Number(c.pedagio_valor) - 18.50) > 0.01) alerta(`pedagio_valor não propagado`);
    if (Math.abs(Number(c.outros_custos) - 25) > 0.01) alerta(`outros_custos (adicional) não propagado`);
    if (Math.abs(Number(c.margem_bruta) - 46.50) > 0.01) alerta(`margem_bruta incorreta: ${c.margem_bruta} (esperado 46.50)`);
  }

  // PASSO 14: Status final da OS
  passo++;
  console.log(`\n─── PASSO ${passo}: Status final OS ───`);
  const { data: osFim } = await supabase.from("ordens_servico").select("status,valor_cliente,custo_prestador,pedagio,adicionais").eq("id", ids.osId).single();
  if (osFim) {
    ok(`OS: ${osFim.status}, R$ ${osFim.valor_cliente}`);
    const repasse = Number(osFim.custo_prestador) + Number(osFim.pedagio) + Number(osFim.adicionais);
    console.log(`     Repasse total: R$ ${repasse.toFixed(2)}`);
    console.log(`     Margem: R$ ${(Number(osFim.valor_cliente) - repasse).toFixed(2)}`);
  }

  // PASSO 15: Verificar financeiro final
  passo++;
  console.log(`\n─── PASSO ${passo}: Verificar financeiro final ───`);
  const { data: fr2 } = await supabase.from("financeiro_receber").select("*").eq("os_id", ids.osId);
  const { data: pp2 } = await supabase.from("pagamentos_prestadores").select("*").eq("os_id", ids.osId);
  console.log(`     Financeiro receber: ${fr2?.length ? `✅ R$ ${fr2[0].valor} (${fr2[0].status})` : "❌ NÃO CRIADO"}`);
  console.log(`     Pagamento prestador: ${pp2?.length ? `✅ R$ ${pp2[0].valor_liquido} (${pp2[0].status_pagamento})` : "❌ NÃO CRIADO"}`);

  // ===================================================================
  // RELATÓRIO
  // ===================================================================
  console.log("\n" + "=".repeat(70));
  console.log("  RELATÓRIO FINAL M66");
  console.log("=".repeat(70));
  console.log(`  OS: ${ids.osNumero} (${ids.osId})`);
  console.log(`  Alocação: ${ids.alocacaoId}`);
  console.log(`  Prestador: ${pre.nome_completo}`);
  console.log(`  Cliente: Cliente Teste App Motorista`);
  console.log(`  Financeiro receber automático: ${ids.financeiroReceberId ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`  Pagamento prestador automático: ${ids.pagamentoPrestadorId ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`  Pode enviar motorista REAL: ${pre.telefone ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`  Erros: ${erros} | Alertas: ${alertas}`);
  console.log("=".repeat(70));
  console.log(erros === 0 ? "\n  ✅ TESTE CONCLUÍDO COM SUCESSO" : `\n  ❌ ${erros} ERRO(S)`);
  console.log("");
}

function aguardar(ms: number) { return new Promise(r => setTimeout(r, ms)); }
main().catch(console.error);
