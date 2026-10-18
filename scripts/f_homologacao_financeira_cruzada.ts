/**
 * scripts/f_homologacao_financeira_cruzada.ts
 *
 * Homologação financeira cruzada — valida se os dados criados pelo teste
 * Playwright homologacao-critica-pontaponta.spec.ts foram propagados
 * corretamente para todas as tabelas financeiras.
 *
 * O teste cria:
 *   - Cliente  (razao_social = QA_CRIT_<timestamp>_CLIENTE)
 *   - Prestador (nome_completo = QA_CRIT_<timestamp>_PRESTADOR)
 *   - Alocação em alocacoes_escala com valor_frete=1000, valor_repasse=600
 *
 * O script lê o prefixo do relatório gerado pelo teste
 * (test-results/e2e/homologacao-critica/relatorio-critico.json)
 * e então consulta todas as tabelas do fluxo financeiro para verificar
 * a propagação dos dados.
 *
 * Uso:
 *   npx tsx scripts/f_homologacao_financeira_cruzada.ts
 *   npx tsx scripts/f_homologacao_financeira_cruzada.ts QA_CRIT_2026-06-25_17-24-43
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

config({ path: path.resolve(".env") });

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RELATORIO_PATH = path.resolve("test-results/e2e/homologacao-critica/relatorio-critico.json");

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

let reportId = 0;
function nextId(): string {
  reportId++;
  return `CRUZ_${String(reportId).padStart(2, "0")}`;
}

// ── Tipos do relatório ─────────────────────────────────────────────────────────

type Classificacao =
  | "OK"
  | "NAO_PROPAGADO"
  | "SEM_ORIGEM"
  | "CALCULO_ERRADO"
  | "NAO_EXIBE";

interface TabelaReport {
  tabela: string;
  registros: number;
  valores: Record<string, unknown>;
  classificacao: Classificacao;
  detalhe: string;
}

// ── Leitura do prefixo ─────────────────────────────────────────────────────────

function lerPrefixo(cliArg: string | undefined): string {
  if (cliArg) {
    console.log(`[INFO] Usando prefixo da CLI: ${cliArg}`);
    return cliArg;
  }
  if (fs.existsSync(RELATORIO_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(RELATORIO_PATH, "utf-8"));
      if (raw.prefixo) {
        console.log(`[INFO] Prefixo lido do relatório: ${raw.prefixo}`);
        return raw.prefixo;
      }
    } catch {
      console.warn("[WARN] Falha ao ler relatorio-critico.json");
    }
  }
  console.error(
    "Prefixo não encontrado. Forneça como argumento:\n" +
    "  npx tsx scripts/f_homologacao_financeira_cruzada.ts QA_CRIT_2026-06-25_17-24-43"
  );
  process.exit(1);
}

// ── Funções de consulta ────────────────────────────────────────────────────────

async function consultaAlocacoes(pref: string, clienteId: string, prestadorId: string): Promise<TabelaReport> {
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("prestador_id", prestadorId)
    .not("metadata", "is", null);

  if (error) {
    return {
      tabela: "alocacoes_escala",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Erro na consulta: ${error.message}`,
    };
  }

  const filtradas = (data || []).filter((r: any) =>
    r.metadata?.teste_critico === true || r.metadata?.origem_tms === true
  );

  if (filtradas.length === 0) {
    return {
      tabela: "alocacoes_escala",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Nenhuma alocação encontrada para cliente=${clienteId} prestador=${prestadorId} com metadata.teste_critico`,
    };
  }

  const receitaTotal = filtradas.reduce((s: number, r: any) => s + (r.valor_frete ?? r.valor_cliente ?? 0), 0);
  const custoTotal = filtradas.reduce((s: number, r: any) => s + (r.valor_repasse ?? r.custo_prestador ?? 0), 0);
  const margemTotal = receitaTotal - custoTotal;
  const margemPct = receitaTotal > 0 ? (margemTotal / receitaTotal) * 100 : 0;

  const divergencias: string[] = [];
  for (const aloc of filtradas) {
    if (aloc.valor_frete !== 1000) divergencias.push(`aloc ${aloc.id}: valor_frete=${aloc.valor_frete} esperado=1000`);
    if (aloc.valor_repasse !== 600) divergencias.push(`aloc ${aloc.id}: valor_repasse=${aloc.valor_repasse} esperado=600`);
  }

  const classificacao: Classificacao = divergencias.length > 0 ? "CALCULO_ERRADO" : "OK";

  return {
    tabela: "alocacoes_escala",
    registros: filtradas.length,
    valores: {
      receita: receitaTotal,
      custo: custoTotal,
      margem: margemTotal,
      margem_percentual: Math.round(margemPct * 10) / 10,
      ids: filtradas.map((r: any) => r.id),
    },
    classificacao,
    detalhe: divergencias.length > 0
      ? `Divergências: ${divergencias.join("; ")}`
      : `Dados corretos: receita=${fmtBRL(receitaTotal)}, custo=${fmtBRL(custoTotal)}, margem=${fmtBRL(margemTotal)}`,
  };
}

async function consultaOrdensServico(alocacaoIds: string[]): Promise<TabelaReport> {
  if (alocacaoIds.length === 0) {
    return {
      tabela: "ordens_servico",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: "Nenhum ID de alocação para buscar OS vinculada",
    };
  }

  const { data, error } = await supabase
    .from("ordens_servico")
    .select("*")
    .in("alocacao_id", alocacaoIds);

  if (error) {
    return {
      tabela: "ordens_servico",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Erro na consulta: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    return {
      tabela: "ordens_servico",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Nenhuma OS vinculada às alocações (alocacoes_escala → ordens_servico não propagou)`,
    };
  }

  const receitaTotal = data.reduce((s: number, r: any) => s + (r.valor_cliente ?? 0), 0);
  const custoTotal = data.reduce((s: number, r: any) => s + (r.custo_prestador ?? 0), 0);
  const margemTotal = receitaTotal - custoTotal;

  return {
    tabela: "ordens_servico",
    registros: data.length,
    valores: {
      receita: receitaTotal,
      custo: custoTotal,
      margem: margemTotal,
      status: data.map((r: any) => r.status).join(", "),
      ids: data.map((r: any) => r.id),
    },
    classificacao: "OK",
    detalhe: `${data.length} OS(s) vinculada(s)`,
  };
}

async function consultaFinanceiroReceber(alocacaoIds: string[], clienteId: string): Promise<TabelaReport> {
  const orConditions = [
    `os_id.in.(${alocacaoIds.map(id => `"${id}"`).join(",")})`,
    `cliente_id.eq.${clienteId}`,
  ];

  const { data, error } = await supabase
    .from("financeiro_receber")
    .select("*")
    .or(orConditions[0]);

  if (error) {
    return {
      tabela: "financeiro_receber",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Erro na consulta: ${error.message}`,
    };
  }

  const filtradas = (data || []).filter((r: any) =>
    r.os_id && alocacaoIds.includes(r.os_id) && (!clienteId || r.cliente_id === clienteId)
  );

  if (filtradas.length === 0 && (data || []).length > 0) {
    return {
      tabela: "financeiro_receber",
      registros: (data || []).length,
      valores: {},
      classificacao: "SEM_ORIGEM",
      detalhe: `Registros encontrados mas sem vínculo com as alocações QA`,
    };
  }

  if (filtradas.length === 0) {
    return {
      tabela: "financeiro_receber",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Nenhum registro em financeiro_receber vinculado às alocações — dados NÃO propagados para contas a receber`,
    };
  }

  const valorTotal = filtradas.reduce((s: number, r: any) => s + (r.valor ?? r.valor_liquido ?? 0), 0);
  const esperado = 1000 * filtradas.length;

  const classificacao: Classificacao = Math.abs(valorTotal - esperado) < 0.01 ? "OK" : "CALCULO_ERRADO";

  return {
    tabela: "financeiro_receber",
    registros: filtradas.length,
    valores: {
      valor_total: valorTotal,
      valor_esperado: esperado,
      divergencia: valorTotal - esperado,
      ids: filtradas.map((r: any) => r.id),
      status: filtradas.map((r: any) => r.status).join(", "),
    },
    classificacao,
    detalhe: classificacao === "OK"
      ? `Receita de ${fmtBRL(valorTotal)} correta em ${filtradas.length} registro(s)`
      : `Valor total ${fmtBRL(valorTotal)} diverge do esperado ${fmtBRL(esperado)}`,
  };
}

async function consultaFinanceiroPagar(alocacaoIds: string[], prestadorId: string): Promise<TabelaReport> {
  const { data, error } = await supabase
    .from("financeiro_pagar")
    .select("*")
    .eq("favorecido_id", prestadorId);

  if (error) {
    return {
      tabela: "financeiro_pagar",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Erro na consulta: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    return {
      tabela: "financeiro_pagar",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Nenhum registro em financeiro_pagar para o prestador — dados NÃO propagados para contas a pagar`,
    };
  }

  const valorTotal = data.reduce((s: number, r: any) => s + (r.valor ?? r.valor_liquido ?? 0), 0);

  return {
    tabela: "financeiro_pagar",
    registros: data.length,
    valores: {
      valor_total: valorTotal,
      ids: data.map((r: any) => r.id),
      status: data.map((r: any) => r.status).join(", "),
    },
    classificacao: "OK",
    detalhe: `${data.length} registro(s) em contas a pagar, total ${fmtBRL(valorTotal)}`,
  };
}

async function consultaPagamentosPrestadores(alocacaoIds: string[], prestadorId: string): Promise<TabelaReport> {
  const { data, error } = await supabase
    .from("pagamentos_prestadores")
    .select("*")
    .in("os_id", alocacaoIds);

  if (error) {
    return {
      tabela: "pagamentos_prestadores",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Erro na consulta: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    return {
      tabela: "pagamentos_prestadores",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Nenhum pagamento registrado para as alocações — dados NÃO propagados`,
    };
  }

  const valorTotal = data.reduce((s: number, r: any) => s + (r.valor ?? r.valor_liquido ?? r.valor_servicos ?? 0), 0);
  const esperado = 600 * data.length;

  const classificacao: Classificacao = Math.abs(valorTotal - esperado) < 0.01 ? "OK" : "CALCULO_ERRADO";

  return {
    tabela: "pagamentos_prestadores",
    registros: data.length,
    valores: {
      valor_total: valorTotal,
      valor_esperado: esperado,
      divergencia: valorTotal - esperado,
      status: data.map((r: any) => r.status_pagamento).join(", "),
      ids: data.map((r: any) => r.id),
    },
    classificacao,
    detalhe: classificacao === "OK"
      ? `Custo de ${fmtBRL(valorTotal)} correto em ${data.length} registro(s)`
      : `Valor total ${fmtBRL(valorTotal)} diverge do esperado ${fmtBRL(esperado)}`,
  };
}

async function consultaComposicaoFinanceira(alocacaoIds: string[]): Promise<TabelaReport> {
  const { data, error } = await supabase
    .from("composicao_financeira_os")
    .select("*")
    .in("os_id", alocacaoIds);

  if (error) {
    return {
      tabela: "composicao_financeira_os",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Erro na consulta: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    return {
      tabela: "composicao_financeira_os",
      registros: 0,
      valores: {},
      classificacao: "NAO_PROPAGADO",
      detalhe: `Nenhum registro em composicao_financeira_os — margem financeira não foi calculada/propagada`,
    };
  }

  const receitaTotal = data.reduce((s: number, r: any) => s + (r.valor_cliente ?? 0), 0);
  const custoTotal = data.reduce((s: number, r: any) => s + (r.custo_prestador ?? r.valor_prestador ?? 0), 0);
  const margemBruta = data.reduce((s: number, r: any) => s + (r.margem_bruta ?? 0), 0);
  const margemLiq = data.reduce((s: number, r: any) => s + (r.margem_liquida ?? 0), 0);

  const esperado = 1000 * data.length;
  const margemEsperada = (1000 - 600) * data.length;

  const divergencias: string[] = [];
  if (Math.abs(receitaTotal - esperado) >= 0.01) divergencias.push(`receita ${fmtBRL(receitaTotal)} != esperado ${fmtBRL(esperado)}`);
  if (Math.abs(margemLiq - margemEsperada) >= 0.01) divergencias.push(`margem ${fmtBRL(margemLiq)} != esperado ${fmtBRL(margemEsperada)}`);

  const classificacao: Classificacao = divergencias.length > 0 ? "CALCULO_ERRADO" : "OK";

  return {
    tabela: "composicao_financeira_os",
    registros: data.length,
    valores: {
      receita: receitaTotal,
      custo: custoTotal,
      margem_bruta: margemBruta,
      margem_liquida: margemLiq,
      receita_esperada: esperado,
      margem_esperada: margemEsperada,
      ids: data.map((r: any) => r.id),
    },
    classificacao,
    detalhe: divergencias.length > 0
      ? `Divergências: ${divergencias.join("; ")}`
      : `Composição correta: receita=${fmtBRL(receitaTotal)}, margem=${fmtBRL(margemLiq)}`,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function run() {
  console.log("=".repeat(70));
  console.log("  HOMOLOGAÇÃO FINANCEIRA CRUZADA — TMS Conexão Express");
  console.log(`  ${new Date().toLocaleString("pt-BR")}`);
  console.log("=".repeat(70));

  const cliArg = process.argv[2];
  const prefixo = lerPrefixo(cliArg);

  console.log(`\n[PASSO 1] Buscando cliente e prestador com prefixo "${prefixo}"...`);

  const [clienteRes, prestadorRes] = await Promise.all([
    supabase.from("clientes").select("id, razao_social").ilike("razao_social", `${prefixo}_CLIENTE`).maybeSingle(),
    supabase.from("prestadores").select("id, nome_completo").ilike("nome_completo", `${prefixo}_PRESTADOR`).maybeSingle(),
  ]);

  if (clienteRes.error) {
    console.error(`  ERRO ao buscar cliente: ${clienteRes.error.message}`);
    process.exit(1);
  }
  if (prestadorRes.error) {
    console.error(`  ERRO ao buscar prestador: ${prestadorRes.error.message}`);
    process.exit(1);
  }

  const cliente = clienteRes.data;
  const prestador = prestadorRes.data;

  if (!cliente) {
    console.error(`  Cliente "${prefixo}_CLIENTE" não encontrado. Execute o teste Playwright primeiro.`);
    process.exit(1);
  }
  if (!prestador) {
    console.error(`  Prestador "${prefixo}_PRESTADOR" não encontrado. Execute o teste Playwright primeiro.`);
    process.exit(1);
  }

  console.log(`  ✅ Cliente: ${cliente.razao_social} (${cliente.id})`);
  console.log(`  ✅ Prestador: ${prestador.nome_completo} (${prestador.id})`);

  // ── PASSO 2: Consultar alocações ──────────────────────────────────────────────

  console.log(`\n[PASSO 2] Consultando alocacoes_escala...`);
  const alocReport = await consultaAlocacoes(prefixo, cliente.id, prestador.id);
  console.log(`  ${alocReport.classificacao === "OK" ? "✅" : "❌"} ${alocReport.tabela}: ${alocReport.registros} registro(s) — ${alocReport.classificacao}`);
  console.log(`    ${alocReport.detalhe}`);

  const alocIds: string[] = (alocReport.valores.ids as unknown as string[]) || [];

  // ── PASSO 3: Consultar tabelas financeiras ────────────────────────────────────

  console.log(`\n[PASSO 3] Consultando tabelas do fluxo financeiro...`);

  const reports: TabelaReport[] = [alocReport];

  const [osReport, receberReport, pagarReport, pagamentosReport, composicaoReport] = await Promise.all([
    consultaOrdensServico(alocIds),
    consultaFinanceiroReceber(alocIds, cliente.id),
    consultaFinanceiroPagar(alocIds, prestador.id),
    consultaPagamentosPrestadores(alocIds, prestador.id),
    consultaComposicaoFinanceira(alocIds),
  ]);

  reports.push(osReport, receberReport, pagarReport, pagamentosReport, composicaoReport);

  for (const r of [osReport, receberReport, pagarReport, pagamentosReport, composicaoReport]) {
    const icon = r.classificacao === "OK" ? "✅" : "⚠️";
    console.log(`  ${icon} ${r.tabela}: ${r.registros} registro(s) — ${r.classificacao}`);
    console.log(`      ${r.detalhe}`);
  }

  // ── PASSO 4: Montar relatório JSON ────────────────────────────────────────────

  console.log(`\n[PASSO 4] Consolidando relatório...`);

  const resumo = {
    total_tabelas: reports.length,
    ok: reports.filter((r) => r.classificacao === "OK").length,
    nao_propagado: reports.filter((r) => r.classificacao === "NAO_PROPAGADO").length,
    sem_origem: reports.filter((r) => r.classificacao === "SEM_ORIGEM").length,
    calculo_errado: reports.filter((r) => r.classificacao === "CALCULO_ERRADO").length,
    nao_exibe: reports.filter((r) => r.classificacao === "NAO_EXIBE").length,
  };

  const relatorioFinal = {
    titulo: "HOMOLOGAÇÃO FINANCEIRA CRUZADA — Relatório de Propagação de Dados",
    data: new Date().toISOString(),
    prefixo,
    entidades: {
      cliente: { id: cliente.id, nome: cliente.razao_social },
      prestador: { id: prestador.id, nome: prestador.nome_completo },
    },
    valores_origem: {
      receita: 1000,
      custo: 600,
      margem: 400,
    },
    tabelas: reports.map((r) => ({
      id: nextId(),
      tabela: r.tabela,
      registros: r.registros,
      valores: r.valores,
      classificacao: r.classificacao,
      detalhe: r.detalhe,
    })),
    resumo,
  };

  const OUTPUT_PATH = path.resolve("test-results/e2e/homologacao-critica/homologacao-financeira-cruzada.json");
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(relatorioFinal, null, 2), "utf-8");

  console.log(`\n📄 Relatório salvo em: ${OUTPUT_PATH}`);
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  RESUMO DA HOMOLOGAÇÃO CRUZADA`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  ✅ OK:              ${resumo.ok} / ${resumo.total_tabelas}`);
  console.log(`  ⚠️  NAO_PROPAGADO:   ${resumo.nao_propagado}`);
  console.log(`  ⚠️  SEM_ORIGEM:      ${resumo.sem_origem}`);
  console.log(`  ❌ CALCULO_ERRADO:  ${resumo.calculo_errado}`);
  console.log(`  ⚠️  NAO_EXIBE:       ${resumo.nao_exibe}`);
  console.log(`${"=".repeat(70)}`);

  if (resumo.nao_propagado > 0 || resumo.calculo_errado > 0) {
    console.log(`\n🔴 Falhas de propagação detectadas. Revise o relatório JSON.`);
  } else {
    console.log(`\n🟢 Todos os dados financeiros propagados corretamente!`);
  }

  // Exibe o JSON na saída padrão também
  console.log(`\n${"=".repeat(70)}`);
  console.log("  JSON DO RELATÓRIO");
  console.log(`${"=".repeat(70)}`);
  console.log(JSON.stringify(relatorioFinal, null, 2));
}

run().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
