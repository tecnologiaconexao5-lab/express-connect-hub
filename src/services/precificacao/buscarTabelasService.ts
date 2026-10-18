import { supabase } from "@/lib/supabase";
import type { PricingInput, PricingAlerta, TabelaValorAplicada, TabelaPrestadorAplicada } from "./types";
import { resolverFranquiaEfetiva, resolverTarifaKmExcedente } from "@/helpers/franquiaKm";

const N = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const S = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v);
};

type QueryResult = Record<string, any> | null;

async function resolverNomeCliente(clienteId: string): Promise<string | null> {
  const { data } = await supabase
    .from("clientes")
    .select("nome_fantasia")
    .eq("id", clienteId)
    .single() as unknown as { data: { nome_fantasia: string } | null };
  return (data?.nome_fantasia || "").trim().toUpperCase() || null;
}

async function resolverNomePrestador(prestadorId: string): Promise<string | null> {
  const { data } = await supabase
    .from("prestadores")
    .select("nome_completo")
    .eq("id", prestadorId)
    .single() as unknown as { data: { nome_completo: string } | null };
  return data?.nome_completo || null;
}

export interface HierarquiaInfo {
  nivel: number;
  descricao: string;
  versao: number;
  prioridade: number;
}

export async function buscarTabelaValoresCliente(
  input: PricingInput
): Promise<{ tabela: TabelaValorAplicada; alertas: PricingAlerta[]; memoria: string[]; hierarquia?: HierarquiaInfo }> {
  const alertas: PricingAlerta[] = [];
  const memoria: string[] = [];
  const tenant_id = input.tenant_id;
  const cliente_id = input.cliente_id;
  const tipo_veiculo = input.tipo_veiculo?.toLowerCase().trim() || "";
  const data_operacao = input.data_operacao ? new Date(input.data_operacao) : new Date();

  const clienteNome = (input.cliente_nome?.trim().toUpperCase()) || (cliente_id ? await resolverNomeCliente(cliente_id) : null);
  memoria.push(`1. Buscando tabela para cliente ${clienteNome || cliente_id || "(não informado)"}, veículo ${tipo_veiculo}`);

  const baseQuery = () => supabase
    .from("tabelas_valores")
    .select("*")
    .eq("tenant_id", tenant_id)
    .eq("ativo", true);

  // Nível 1: Valor negociado na OS (cliente_id match direto)
  const tabNeg = cliente_id
    ? (await baseQuery()
        .eq("cliente", cliente_id)
        .ilike("tipo_veiculo", tipo_veiculo)
        .order("prioridade", { ascending: false })
        .limit(1)) as unknown as { data: QueryResult[] }
    : { data: [] as QueryResult[] };
  const tabNegRow = tabNeg?.data?.[0] || null;
  if (tabNegRow) {
    memoria.push(`2. [NÍVEL 1] Tabela por cliente_id: ${tabNegRow.nome}`);
    const t = montarTabelaValorAplicada(tabNegRow, 'tabelas_valores');
    return { tabela: t, alertas, memoria, hierarquia: { nivel: 1, descricao: 'Cliente ID match', versao: tabNegRow.versao || 1, prioridade: tabNegRow.prioridade || 0 } };
  }

  // Nível 2: Contrato (se informado)
  if (input.contrato_id) {
    const { data: tabC } = await baseQuery()
      .eq("contrato_id", input.contrato_id)
      .ilike("tipo_veiculo", tipo_veiculo)
      .limit(1) as unknown as { data: QueryResult[] };
    if (tabC && tabC.length > 0 && tabC[0]) {
      memoria.push(`2. [NÍVEL 2] Tabela por contrato: ${tabC[0].nome}`);
      return { tabela: montarTabelaValorAplicada(tabC[0], 'tabelas_valores'), alertas, memoria,
        hierarquia: { nivel: 2, descricao: 'Contrato', versao: tabC[0].versao || 1, prioridade: tabC[0].prioridade || 0 } };
    }
  }

  // Nível 3: Cliente (nome) + tipo_veiculo + vigência
  // Fetch all active tables for vehicle type and match client name with normalization
  if (clienteNome) {
    const { data: candidateTables } = await baseQuery()
      .eq("tipo_veiculo", tipo_veiculo) as unknown as { data: QueryResult[] };

    if (candidateTables && candidateTables.length > 0) {
      const normalizar = (s: string) => (s || "").trim().toUpperCase();
      const matchCliente = (t: QueryResult) => normalizar(t?.cliente || "") === normalizar(clienteNome);

      // Nível 3: com vigência
      const tab3 = candidateTables.find(t =>
        matchCliente(t) &&
        t?.data_inicio && new Date(t.data_inicio) <= data_operacao &&
        (!t.data_fim || new Date(t.data_fim) >= data_operacao)
      );
      if (tab3) {
        memoria.push(`2. [NÍVEL 3] Tabela específica: ${tab3.nome} (cliente + veículo + vigência)`);
        return { tabela: montarTabelaValorAplicada(tab3, 'tabelas_valores'), alertas, memoria,
          hierarquia: { nivel: 3, descricao: 'Cliente + veículo + vigência', versao: tab3.versao || 1, prioridade: tab3.prioridade || 0 } };
      }

      // Nível 4: sem vigência
      const tab4 = candidateTables.find(t => matchCliente(t) && !t?.data_inicio);
      if (tab4) {
        memoria.push(`2. [NÍVEL 4] Tabela específica: ${tab4.nome} (cliente + veículo, sem vigência)`);
        return { tabela: montarTabelaValorAplicada(tab4, 'tabelas_valores'), alertas, memoria,
          hierarquia: { nivel: 4, descricao: 'Cliente + veículo (sem vigência)', versao: tab4.versao || 1, prioridade: tab4.prioridade || 0 } };
      }
    }
  }

  // Nível 5: Universal + tipo_veiculo + vigência
  const { data: tab5 } = await supabase
    .from("tabelas_valores")
    .select("*")
    .eq("tenant_id", tenant_id)
    .eq("universal", true)
    .eq("ativo", true)
    .ilike("tipo_veiculo", tipo_veiculo)
    .lte("data_inicio", data_operacao.toISOString())
    .or(`data_fim.gte.${data_operacao.toISOString()},data_fim.is.null`)
    .order("prioridade", { ascending: false })
    .limit(1) as unknown as { data: QueryResult[] };
  if (tab5 && tab5.length > 0 && tab5[0]) {
    memoria.push(`2. [NÍVEL 5] Tabela universal: ${tab5[0].nome} (veículo + vigência)`);
    return { tabela: montarTabelaValorAplicada(tab5[0], 'universal'), alertas, memoria,
      hierarquia: { nivel: 5, descricao: 'Universal + vigência', versao: tab5[0].versao || 1, prioridade: tab5[0].prioridade || 0 } };
  }

  // Nível 6: Universal + tipo_veiculo (sem vigência)
  const { data: tab6 } = await supabase
    .from("tabelas_valores")
    .select("*")
    .eq("tenant_id", tenant_id)
    .eq("universal", true)
    .eq("ativo", true)
    .ilike("tipo_veiculo", tipo_veiculo)
    .is("data_inicio", null)
    .order("prioridade", { ascending: false })
    .limit(1) as unknown as { data: QueryResult[] };
  if (tab6 && tab6.length > 0 && tab6[0]) {
    memoria.push(`2. [NÍVEL 6] Tabela universal: ${tab6[0].nome} (veículo, sem vigência)`);
    return { tabela: montarTabelaValorAplicada(tab6[0], 'universal'), alertas, memoria,
      hierarquia: { nivel: 6, descricao: 'Universal (sem vigência)', versao: tab6[0].versao || 1, prioridade: tab6[0].prioridade || 0 } };
  }

  // Nível 7: Fallback
  alertas.push({
    tipo: 'warning',
    mensagem: `Nenhuma tabela encontrada. Usando fallback genérico.`,
    campo: 'tipo_veiculo'
  });
  memoria.push(`2. [NÍVEL 7] Fallback genérico`);

  return {
    tabela: {
      id: '', nome: 'Fallback Genérico', fonte: 'fallback_hardcoded',
      valor_base: 0, franquia_km: 0, valor_km_excedente: 0, percentual_prestador: 80,
    },
    alertas, memoria,
    hierarquia: { nivel: 7, descricao: 'Fallback genérico', versao: 0, prioridade: 0 },
  };
}

function montarTabelaValorAplicada(t: Record<string, any>, fonte: TabelaValorAplicada['fonte']): TabelaValorAplicada {
  return {
    id: S(t.id),
    nome: S(t.nome),
    fonte,
    valor_base: N(t.valor_base),
    franquia_km: resolverFranquiaEfetiva(t.franquia_km, t.km_franquia),
    valor_km_excedente: resolverTarifaKmExcedente(t.valor_km_excedente, t.valor_km),
    percentual_prestador: N(t.percentual_prestador ?? 80),
    valor_fixo_prestador: N(t.valor_fixo_prestador ?? 0),
    tipo_repasse_prestador: t.tipo_repasse_prestador || 'percentual',
    adicionais: t.adicionais || {},
    versao: t.versao || 1,
    prioridade: t.prioridade || 0,
    data_inicio: t.data_inicio || null,
    data_fim: t.data_fim || null,
  };
}

export async function buscarTabelaPrestador(
  input: PricingInput
): Promise<{ tabela: TabelaPrestadorAplicada; alertas: { tipo: 'info' | 'warning' | 'error'; mensagem: string }[]; memoria: string[] }> {
  const alertas: PricingAlerta[] = [];
  const memoria: string[] = [];
  const prestador_id = input.prestador_id;
  const tipo_veiculo = input.tipo_veiculo?.toLowerCase().trim() || "";
  const cidade = input.origem?.cidade || "";
  const uf = input.origem?.uf || "";
  const regiao = uf;

  const prestadorNome = prestador_id ? await resolverNomePrestador(prestador_id) : null;
  memoria.push(`3. Buscando custo do prestador ${prestadorNome || prestador_id || "N/A"}, veículo ${tipo_veiculo}`);

  const data_operacao = input.data_operacao ? new Date(input.data_operacao) : new Date();

  const buscaTabela = async (filtros: Record<string, any>) => {
    let q = supabase.from("tabela_prestador").select("*") as any;
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        q = k === 'tipo_veiculo' ? q.ilike(k, v) : q.eq(k, v);
      }
    });
    q = q.eq("ativo", true);
    // Aplica vigência: data_inicio <= hoje AND (data_fim >= hoje OR data_fim IS NULL)
    q = q.lte("data_inicio", data_operacao.toISOString().split('T')[0]);
    q = q.or(`data_fim.gte.${data_operacao.toISOString().split('T')[0]},data_fim.is.null`);
    q = q.order("prioridade", { ascending: false });
    return (await q.limit(1).maybeSingle()) as unknown as { data: QueryResult };
  };

  if (prestadorNome) {
    const t1 = await buscaTabela({ nome: prestadorNome, tipo_veiculo, cidade, uf });
    if (t1.data) { memoria.push(`4. Tabela prestador (nível 1): ${t1.data.nome}`); return { tabela: montarTabelaPrestadorAplicada(t1.data, 'tabela_prestador'), alertas, memoria }; }

    const t2 = await buscaTabela({ nome: prestadorNome, tipo_veiculo, regiao });
    if (t2.data) { memoria.push(`4. Tabela prestador (nível 2): ${t2.data.nome}`); return { tabela: montarTabelaPrestadorAplicada(t2.data, 'tabela_prestador'), alertas, memoria }; }

    const t3 = await buscaTabela({ nome: prestadorNome, tipo_veiculo });
    if (t3.data) { memoria.push(`4. Tabela prestador (nível 3): ${t3.data.nome}`); return { tabela: montarTabelaPrestadorAplicada(t3.data, 'tabela_prestador'), alertas, memoria }; }
  }

  const t4 = await buscaTabela({ tipo_veiculo, cidade, uf });
  if (t4.data) { memoria.push(`4. Tabela prestador (nível 4): ${t4.data.nome}`); return { tabela: montarTabelaPrestadorAplicada(t4.data, 'tabela_prestador'), alertas, memoria }; }

  const t5 = await buscaTabela({ tipo_veiculo, regiao });
  if (t5.data) { memoria.push(`4. Tabela prestador (nível 5): ${t5.data.nome}`); return { tabela: montarTabelaPrestadorAplicada(t5.data, 'tabela_prestador'), alertas, memoria }; }

  const t6 = await buscaTabela({ tipo_veiculo } as any);
  if (t6.data && !t6.data.nome) {
    memoria.push(`4. Tabela prestador (nível 6 - genérica): ${t6.data.nome}`);
    return { tabela: montarTabelaPrestadorAplicada(t6.data, 'tabela_prestador'), alertas, memoria };
  }

  if (prestador_id) {
    memoria.push(`4. Nenhuma tabela_prestador. Buscando cadastro do prestador.`);
    const { data: prest } = await supabase
      .from("prestadores")
      .select("valor_diaria, valor_km, franquia_km, valor_saida, valor_ajudante, valor_espera, valor_reentrega, valor_devolucao, fixo_mensal")
      .eq("id", prestador_id)
      .single() as unknown as { data: QueryResult };

    if (prest && (N(prest.valor_diaria) > 0 || N(prest.valor_km) > 0)) {
      memoria.push(`5. Usando cadastro do prestador: diária=${prest.valor_diaria}, km=${prest.valor_km}`);
      return {
        tabela: {
          id: null, nome: 'Cadastro do Prestador', fonte: 'prestadores_cadastro',
          valor_minimo: N(prest.valor_diaria ?? prest.valor_saida ?? 0),
          km_incluso: N(prest.franquia_km ?? 0),
          valor_km: N(prest.valor_km ?? 0),
          valor_diaria: N(prest.valor_diaria ?? 0),
          valor_saida: N(prest.valor_saida ?? 0),
        },
        alertas, memoria
      };
    }
  }

  alertas.push({
    tipo: 'error',
    mensagem: `Nenhuma tabela de custo encontrada para o prestador ${prestadorNome || prestador_id || "N/A"}.`,
    campo: 'prestador_id'
  });
  memoria.push(`5. Nenhuma fonte de custo encontrada.`);

  return {
    tabela: { id: null, nome: 'Não encontrada', fonte: 'nao_encontrada' },
    alertas, memoria
  };
}

function montarTabelaPrestadorAplicada(t: Record<string, any>, fonte: TabelaPrestadorAplicada['fonte']): TabelaPrestadorAplicada {
  return {
    id: S(t.id) || null,
    nome: S(t.nome),
    fonte,
    valor_minimo: N(t.valor_minimo ?? 0),
    km_incluso: N(t.km_incluso ?? 0),
    valor_km: N(t.valor_km ?? 0),
    valor_diaria: N(t.valor_diaria ?? 0),
    valor_saida: N(t.valor_saida ?? 0),
  };
}

export async function buscarAliquotaIss(cliente_id: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("clientes")
      .select("aliquota_iss")
      .eq("id", cliente_id)
      .single() as unknown as { data: QueryResult };
    return N(data?.aliquota_iss ?? 4.5);
  } catch {
    return 4.5;
  }
}
