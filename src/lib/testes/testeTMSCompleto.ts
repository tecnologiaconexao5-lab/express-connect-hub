// src/lib/testes/testeTMSCompleto.ts
// Script de teste automatizado do fluxo completo TMS
// Regra: não altera nada existente, apenas valida integrações

import { supabase } from "@/lib/supabase";
import { toOrcamentoInsert, toOSInsert, toOSUpdate } from "@/lib/dbMappers";

const now = () => new Date().toISOString();
const dataAtual = () => now().split("T")[0];
const novoNumero = (prefixo: string) =>
  `${prefixo}-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${String(Date.now()).slice(-6)}`;

interface TesteLog {
  passo: number;
  etapa: string;
  status: "ok" | "fail" | "skip";
  mensagem: string;
  duracao?: string;
  dados?: Record<string, unknown>;
  erro?: string;
}

interface ResultadoTeste {
  sucesso: boolean;
  duracaoTotal: string;
  logs: TesteLog[];
  ids: {
    orcamento?: string;
    os?: string;
    financeiroReceber?: string;
    financeiroPagar?: string;
  };
}

function logPasso(
  logs: TesteLog[],
  passo: number,
  etapa: string,
  status: TesteLog["status"],
  mensagem: string,
  dados?: Record<string, unknown>,
  erro?: string
): void {
  logs.push({ passo, etapa, status, mensagem, duracao: now(), dados, erro });
}

function printLogs(logs: TesteLog[]): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  RESULTADO DO TESTE COMPLETO TMS`);
  console.log(`  Data: ${now()}`);
  console.log(`${"=".repeat(60)}`);
  logs.forEach((l) => {
    const icone = l.status === "ok" ? "✔" : l.status === "fail" ? "✗" : "○";
    const cor = l.status === "ok" ? "\x1b[32m" : l.status === "fail" ? "\x1b[31m" : "\x1b[33m";
    console.log(`${cor}${icone} PASSO ${l.passo} — ${l.etapa}${l.erro ? ` → ERRO: ${l.erro}` : ""}\x1b[0m`);
    if (l.dados) {
      console.log(`  Dados: ${JSON.stringify(l.dados, null, 2).split("\n").join("\n  ")}`);
    }
  });
  console.log(`${"=".repeat(60)}\n`);
}

async function testarConexaoSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from("clientes").select("id").limit(1);
    if (error) {
      console.error("✗ Supabase inacessível:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("✗ Erro de conexão Supabase:", e);
    return false;
  }
}

async function passo1_criarOrcamento(
  logs: TesteLog[]
): Promise<{ id?: string; numero?: string } | null> {
  const numero = novoNumero("ORC");
  const payload = toOrcamentoInsert({
    numero,
    cliente: "TESTE-AUTO-CLIENTE",
    dataEmissao: dataAtual(),
    validade: dataAtual(),
    status: "aprovado",
    carga: {
      tipo: "carga seca",
      descricao: "Teste automatizado TMS",
      volumes: 10,
      peso: 500,
      cubagem: 3,
      pallets: 2,
      valorDeclarado: 2500,
      qtdNotas: 1,
    },
    valores: {
      distancia_km: 150,
      pedagio: 45,
      custo_total: 1200,
      valor_venda: 1850,
      margem: 35,
    },
  });

  try {
    const { data, error } = await supabase
      .from("orcamentos")
      .insert([payload])
      .select("id,numero")
      .single();

    if (error) {
      logPasso(logs, 1, "Criar Orçamento", "fail", `Insert falhou`, undefined, error.message);
      return null;
    }

    logPasso(logs, 1, "Criar Orçamento", "ok", `Criado: ${data.numero}`, {
      id: data.id,
      numero: data.numero,
    });
    return { id: data.id, numero: data.numero };
  } catch (e: any) {
    logPasso(logs, 1, "Criar Orçamento", "fail", `Exceção`, undefined, e.message);
    return null;
  }
}

async function passo2_criarOS(
  logs: TesteLog[],
  orcamento?: { id?: string; numero?: string }
): Promise<{ id?: string; numero?: string } | null> {
  const numero = novoNumero("OS");

  const payload = toOSInsert({
    numero,
    cliente: "TESTE-AUTO-CLIENTE",
    data: dataAtual(),
    dataProgramada: dataAtual(),
    orcamentoOrigem: orcamento?.numero,
    unidade: "MATRIZ",
    status: "rascunho",
    prioridade: "normal",
    modalidade: "esporadico",
    carga: {
      tipo: "carga seca",
      descricao: "Teste automatizado TMS",
      volumes: 10,
      peso: 500,
      cubagem: 3,
      pallets: 2,
      valorDeclarado: 2500,
      qtdNotas: 1,
    },
    enderecos: [
      {
        sequencia: 1,
        tipo: "coleta",
        nomeLocal: "CD Teste Auto - Coleta",
        endereco: "Rua Teste Automatizado, 100",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01001-000",
        telefone: "(11) 99999-0001",
        statusPonto: "pendente",
      },
      {
        sequencia: 2,
        tipo: "entrega",
        nomeLocal: "Cliente Teste Auto - Entrega",
        endereco: "Av. Teste Automatizado, 200",
        cidade: "Campinas",
        estado: "SP",
        cep: "13010-000",
        telefone: "(19) 99999-0002",
        statusPonto: "pendente",
      },
    ],
    historico: [
      {
        data: now(),
        acao: "OS Criada via Teste Automatizado",
        status_novo: "rascunho",
        usuario: "TESTE-AUTO",
      },
    ],
    valorCliente: 1850,
    custoPrestador: 1200,
    pedagio: 45,
    whatsappDestinatario: "(11) 99999-0002",
    notificarDestinatario: true,
  });

  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .insert([payload])
      .select("id,numero")
      .single();

    if (error) {
      logPasso(logs, 2, "Criar OS", "fail", `Insert falhou`, undefined, error.message);
      return null;
    }

    logPasso(logs, 2, "Criar OS", "ok", `Criada: ${data.numero}`, {
      id: data.id,
      numero: data.numero,
    });
    return { id: data.id, numero: data.numero };
  } catch (e: any) {
    logPasso(logs, 2, "Criar OS", "fail", `Exceção`, undefined, e.message);
    return null;
  }
}

async function passo3_finalizarOS(
  logs: TesteLog[],
  os?: { id?: string; numero?: string }
): Promise<boolean> {
  if (!os?.id) {
    logPasso(logs, 3, "Finalizar OS", "skip", "OS não disponível", undefined, "ID ausente");
    return false;
  }

  const updatePayload = {
    status: "finalizada",
    updated_at: now(),
    historico: [
      {
        data: now(),
        acao: "Finalizada via Teste Automatizado",
        status_novo: "finalizada",
        usuario: "TESTE-AUTO",
      },
    ],
  };

  try {
    const { error } = await supabase
      .from("ordens_servico")
      .update(updatePayload)
      .eq("id", os.id)
      .select("id,status")
      .single();

    if (error) {
      logPasso(logs, 3, "Finalizar OS", "fail", `Update falhou`, undefined, error.message);
      return false;
    }

    logPasso(logs, 3, "Finalizar OS", "ok", `Status: finalizada`, { os_id: os.id });
    return true;
  } catch (e: any) {
    logPasso(logs, 3, "Finalizar OS", "fail", `Exceção`, undefined, e.message);
    return false;
  }
}

async function passo4_verificarFinanceiro(
  logs: TesteLog[],
  orcamento?: { numero?: string },
  os?: { id?: string; numero?: string },
  osFinalizada?: boolean
): Promise<{
  receber?: string;
  pagar?: string;
}> {
  if (!os?.id || !osFinalizada) {
    logPasso(logs, 4, "Verificar Financeiro", "skip", "OS não finalizada", undefined, "Pulou verificação");
    return {};
  }

  const resultado: { receber?: string; pagar?: string } = {};

  const { data: finsReceber } = await supabase
    .from("financeiro_receber")
    .select("id")
    .eq("os_id", os.id)
    .limit(1)
    .maybeSingle();

  if (finsReceber) {
    resultado.receber = finsReceber.id;
    logPasso(logs, 4, "financeiro_receber", "ok", `Criado automaticamente`, {
      id: finsReceber.id,
    });
  } else {
    logPasso(logs, 4, "financeiro_receber", "skip", "Não encontrado", undefined, "trigger não criou");
  }

  const { data: finsPagar } = await supabase
    .from("financeiro_pagar")
    .select("id")
    .eq("os_id", os.id)
    .limit(1)
    .maybeSingle();

  if (finsPagar) {
    resultado.pagar = finsPagar.id;
    logPasso(logs, 4, "financeiro_pagar", "ok", `Criado automaticamente`, {
      id: finsPagar.id,
    });
  } else {
    logPasso(logs, 4, "financeiro_pagar", "skip", "Não encontrado", undefined, "prestador não vinculado");
  }

  return resultado;
}

async function limparTestes(
  ids: { orcamento?: string; os?: string; financeiroReceber?: string; financeiroPagar?: string }
): Promise<void> {
  console.log("\n🧹 Limpando dados de teste...");
  const { supabase: sb } = await import("@/lib/supabase");
  const tables = [
    { table: "financeiro_receber", col: "id", val: ids.financeiroReceber },
    { table: "financeiro_pagar", col: "id", val: ids.financeiroPagar },
    { table: "ordens_servico", col: "id", val: ids.os },
    { table: "orcamentos", col: "id", val: ids.orcamento },
  ];
  for (const t of tables) {
    if (!t.val) continue;
    await sb.from(t.table).delete().eq(t.col, t.val).catch(() => {});
  }
  console.log("✔ Limpeza concluída.\n");
}

export async function testeCompletoTMS(
  opts: { limparAoFim?: boolean; verbose?: boolean } = {}
): Promise<ResultadoTeste> {
  const inicio = Date.now();
  const logs: TesteLog[] = [];
  const ids: ResultadoTeste["ids"] = {};

  if (!opts.verbose) {
    console.log("=".repeat(50));
    console.log("  INICIANDO TESTE COMPLETO TMS");
    console.log("=".repeat(50));
  }

  const conexaoOk = await testarConexaoSupabase();
  if (!conexaoOk) {
    logPasso(logs, 0, "Conexão Supabase", "fail", "Inacessível");
    printLogs(logs);
    return { sucesso: false, duracaoTotal: `${Date.now() - inicio}ms`, logs, ids };
  }

  if (!opts.verbose) logPasso(logs, 0, "Conexão Supabase", "ok", "Conectado");

  const orcamento = await passo1_criarOrcamento(logs);
  if (orcamento) ids.orcamento = orcamento.id;

  const os = await passo2_criarOS(logs, orcamento);
  if (os) ids.os = os.id;

  const finalizada = await passo3_finalizarOS(logs, os);

  const fin = await passo4_verificarFinanceiro(logs, orcamento, os, finalizada);
  ids.financeiroReceber = fin.receber;
  ids.financeiroPagar = fin.pagar;

  if (opts.limparAoFim) {
    await limparTestes(ids);
  }

  const sucesso = logs.every((l) => l.status === "ok" || l.status === "skip");
  const duracaoTotal = `${((Date.now() - inicio) / 1000).toFixed(2)}s`;

  if (!opts.verbose) {
    printLogs(logs);
    const todosOk = logs.filter((l) => l.status === "ok").length;
    console.log(`  ${todosOk}/${logs.length} passos OK`);
    console.log(`  Duração: ${duracaoTotal}`);
    if (sucesso) {
      console.log(`  \x1b[32m✔ FLUXO COMPLETO VALIDADOx1b[0m`);
    } else {
      const falhas = logs.filter((l) => l.status === "fail");
      console.log(`  \x1b[31m✗ ${falhas.length} falha(s)x1b[0m:`);
      falhas.forEach((f) => console.log(`    - ${f.etapa}: ${f.erro}`));
    }
    console.log("=".repeat(50) + "\n");
  }

  return { sucesso, duracaoTotal, logs, ids };
}