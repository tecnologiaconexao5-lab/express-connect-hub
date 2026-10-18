/**
 * P0 — Validação do trigger de propagação financeira
 *
 * Cria uma alocação finalizada e verifica se as 5 tabelas financeiras
 * receberam os dados automaticamente.
 *
 * Uso: npx tsx scripts/f_p0_validate_financial_trigger.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TS = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).replace(/T/, "_");
const QA = `QA_TRG_${TS}`;

interface Resultado {
  tabela: string;
  registros: number;
  valor_encontrado: number;
  valor_esperado: number;
  status: "OK" | "FAIL" | "PARCIAL";
  mensagem: string;
}

async function main() {
  console.log(`[P0] Iniciando validação do trigger financeiro — prefixo: ${QA}`);
  const resultados: Resultado[] = [];
  let totalOk = 0;
  let totalFail = 0;

  try {
    // ─── SETUP ─────────────────────────────────────────────────────────────────
    // 1. Cliente
    const { data: cliente, error: ec } = await supabase
      .from("clientes")
      .insert({ razao_social: `${QA}_CLIENTE`, nome_fantasia: `${QA}_CLIENTE`, cnpj: `99.${TS.slice(0,2)}.${TS.slice(3,5)}/0001-${TS.slice(6,8)}`, status: "ativo" })
      .select("id").single();
    if (ec) throw new Error(`Cliente: ${ec.message}`);
    console.log(`  ✓ Cliente: ${cliente.id}`);

    // 2. Prestador
    const { data: prestador, error: ep } = await supabase
      .from("prestadores")
      .insert({ nome_completo: `${QA}_PRESTADOR`, cpf_cnpj: `${TS.slice(0,3)}.${TS.slice(3,6)}.${TS.slice(6,9)}-${TS.slice(9,11)}`, telefone: "11999999999", tipo_parceiro: "autonomo", status: "ativo" })
      .select("id").single();
    if (ep) throw new Error(`Prestador: ${ep.message}`);
    console.log(`  ✓ Prestador: ${prestador.id}`);

    // 3. Veículo
    const { data: veiculo, error: ev } = await supabase
      .from("veiculos")
      .insert({ placa: `TRG${TS.slice(0,2)}`, tipo_veiculo: "VUC", status: "ativo" })
      .select("id").single();
    if (ev) throw new Error(`Veículo: ${ev.message}`);
    console.log(`  ✓ Veículo: ${veiculo.id}`);

    // ─── TESTE: Alocação finalizada via INSERT ──────────────────────────────
    const agora = new Date().toISOString();
    const hoje = agora.split("T")[0];
    const { data: aloc, error: ea } = await supabase
      .from("alocacoes_escala")
      .insert({
        cliente_id: cliente.id,
        prestador_id: prestador.id,
        data_escala: hoje,
        turno: "diurno",
        tipo_veiculo: "VUC",
        placa: `TRG${TS.slice(0,2)}`,
        origem: `${QA}_ORIGEM`,
        destino: `${QA}_DESTINO`,
        rota: "ROTA TRIGGER TEST",
        status: "concluida",
        finalizada: true,
        aceite_prestador: true,
        data_aceite: agora,
        horario_inicio_real: agora,
        horario_fim_real: agora,
        data_finalizacao: agora,
        km_rodados: 50,
        valor_frete: 1000,
        valor_repasse: 600,
        valor_pedagio: 0,
        metadata: { origem_tms: true, teste_trigger: true },
      })
      .select("id").single();
    if (ea) throw new Error(`Alocação: ${ea.message}`);
    console.log(`  ✓ Alocação: ${aloc.id} (trigger deve disparar agora)`);
    const alocId = aloc.id;

    // Aguarda um momento para o trigger completar
    await new Promise(r => setTimeout(r, 2000));

    // ─── VALIDAÇÕES ─────────────────────────────────────────────────────────
    const RECEITA = 1000;
    const CUSTO = 600;

    // 1. ordens_servico
    const { data: os } = await supabase.from("ordens_servico").select("*").eq("id", alocId).maybeSingle();
    resultados.push({
      tabela: "ordens_servico",
      registros: os ? 1 : 0,
      valor_encontrado: os?.valor_cliente ?? 0,
      valor_esperado: RECEITA,
      status: os ? "OK" : "FAIL",
      mensagem: os
        ? `OS criada: valor_cliente=${os.valor_cliente}, custo_prestador=${os.custo_prestador}, status=${os.status}`
        : "OS NÃO foi criada — trigger pode não ter disparado",
    });

    // 2. financeiro_receber
    const { data: receber } = await supabase.from("financeiro_receber").select("*").eq("os_id", alocId);
    const valRec = (receber || []).reduce((s, r: any) => s + (r.valor ?? 0), 0);
    resultados.push({
      tabela: "financeiro_receber",
      registros: receber?.length ?? 0,
      valor_encontrado: valRec,
      valor_esperado: RECEITA,
      status: (receber?.length ?? 0) > 0 && valRec === RECEITA ? "OK" : "FAIL",
      mensagem: (receber?.length ?? 0) > 0
        ? `${receber!.length} registro(s), valor total R$ ${valRec}`
        : "Nenhum registro encontrado",
    });

    // 3. financeiro_pagar
    const { data: pagar } = await supabase.from("financeiro_pagar").select("*").eq("os_id", alocId);
    const valPag = (pagar || []).reduce((s, r: any) => s + (r.valor ?? 0), 0);
    resultados.push({
      tabela: "financeiro_pagar",
      registros: pagar?.length ?? 0,
      valor_encontrado: valPag,
      valor_esperado: CUSTO,
      status: (pagar?.length ?? 0) > 0 && valPag === CUSTO ? "OK" : "FAIL",
      mensagem: (pagar?.length ?? 0) > 0
        ? `${pagar!.length} registro(s), valor total R$ ${valPag}`
        : "Nenhum registro encontrado",
    });

    // 4. pagamentos_prestadores
    const { data: pagtos } = await supabase.from("pagamentos_prestadores").select("*").eq("os_id", alocId);
    const valPagtos = (pagtos || []).reduce((s, r: any) => s + (r.valor ?? r.valor_servicos ?? 0), 0);
    resultados.push({
      tabela: "pagamentos_prestadores",
      registros: pagtos?.length ?? 0,
      valor_encontrado: valPagtos,
      valor_esperado: CUSTO,
      status: (pagtos?.length ?? 0) > 0 && valPagtos === CUSTO ? "OK" : "FAIL",
      mensagem: (pagtos?.length ?? 0) > 0
        ? `${pagtos!.length} registro(s), valor total R$ ${valPagtos}`
        : "Nenhum registro encontrado",
    });

    // 5. composicao_financeira_os
    const { data: comp } = await supabase.from("composicao_financeira_os").select("*").eq("os_id", alocId);
    const margem = (comp || []).reduce((s, r: any) => s + (r.margem_bruta ?? 0), 0);
    const margemLiq = (comp || []).reduce((s, r: any) => s + (r.margem_liquida ?? 0), 0);
    resultados.push({
      tabela: "composicao_financeira_os",
      registros: comp?.length ?? 0,
      valor_encontrado: margem,
      valor_esperado: RECEITA - CUSTO, // 400
      status: (comp?.length ?? 0) > 0 ? "OK" : "FAIL",
      mensagem: (comp?.length ?? 0) > 0
        ? `margem_bruta=${margem}, margem_liquida=${margemLiq}, regs=${comp!.length}`
        : "Nenhum registro encontrado",
    });

    // ─── CLEANUP ───────────────────────────────────────────────────────────────
    await supabase.from("alocacoes_escala").delete().eq("id", alocId);
    await supabase.from("veiculos").delete().eq("id", veiculo.id);
    await supabase.from("prestadores").delete().eq("id", prestador.id);
    await supabase.from("clientes").delete().eq("id", cliente.id);

    // Limpa registros órfãos (cascade deve cuidar, mas só por garantia)
    await supabase.from("composicao_financeira_os").delete().eq("os_id", alocId);
    await supabase.from("pagamentos_prestadores").delete().eq("os_id", alocId);
    await supabase.from("financeiro_pagar").delete().eq("os_id", alocId);
    await supabase.from("financeiro_receber").delete().eq("os_id", alocId);
    await supabase.from("ordens_servico").delete().eq("id", alocId);

  } catch (err: any) {
    console.error(`[P0] ERRO: ${err.message}`);
    process.exit(1);
  }

  // ─── RELATÓRIO ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(80));
  console.log("RELATÓRIO P0 — VALIDAÇÃO DO TRIGGER DE PROPAGAÇÃO FINANCEIRA");
  console.log("=".repeat(80));

  for (const r of resultados) {
    const icon = r.status === "OK" ? "✅" : r.status === "PARCIAL" ? "⚠️" : "❌";
    console.log(`  ${icon} ${r.tabela.padEnd(30)} ${r.registros} reg, R$ ${r.valor_encontrado} (esperado R$ ${r.valor_esperado}) — ${r.mensagem}`);
    if (r.status === "OK") totalOk++;
    else totalFail++;
  }

  console.log("-".repeat(80));
  console.log(`  Total: ${resultados.length} | ✅ OK: ${totalOk} | ❌ FAIL: ${totalFail}`);
  console.log("=".repeat(80));

  if (totalFail > 0) {
    console.log("\n❌ VALIDAÇÃO FALHOU — Correção necessária");
    process.exit(1);
  }
  console.log("\n✅ VALIDAÇÃO APROVADA — Trigger de propagação financeira funcionando");
}

main();
