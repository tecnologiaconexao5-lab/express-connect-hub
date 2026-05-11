import { supabase } from "@/lib/supabase";
import type { OrdemServico } from "@/components/operacao/osTypes";

export interface TabelaPrestadorOperacional {
  id?: string;
  nome: string;
  prestador_id?: string;
  tipo_veiculo?: string;
  regiao?: string;
  cidade?: string;
  uf?: string;
  valor_minimo?: number;
  km_incluso?: number;
  valor_km?: number;
  valor_diaria?: number;
  valor_saida?: number;
  percentual_bonus?: number;
  ativo?: boolean;
  observacoes?: string;
}

export interface ComposicaoFinanceiraOS {
  id?: string;
  os_id: string;
  cliente_id?: string;
  prestador_id?: string;
  valor_cliente?: number;
  valor_prestador?: number;
  imposto_percentual?: number;
  imposto_valor?: number;
  seguro_valor?: number;
  pedagio_valor?: number;
  outros_custos?: number;
  margem_bruta?: number;
  margem_liquida?: number;
  percentual_margem_bruta?: number;
  percentual_margem_liquida?: number;
  origem_calculo?: string;
}

/**
 * TAREFA 2.1 - Buscar tabela do prestador com prioridade
 * Prioridade: 1.prestador_id+tipo+cidade/uf, 2.prestador_id+tipo+regiao, 3.prestador_id+tipo, 4.tipo+cidade/uf, 5.tipo+regiao, 6.tipo genérico
 */
export const buscarTabelaPrestador = async (params: {
  prestador_id?: string;
  tipo_veiculo?: string;
  cidade?: string;
  uf?: string;
  regiao?: string;
}): Promise<TabelaPrestadorOperacional | null> => {
  try {
    const { prestador_id, tipo_veiculo, cidade, uf, regiao } = params;

    // 1. prestador_id + tipo_veiculo + cidade/uf
    if (prestador_id && tipo_veiculo && cidade && uf) {
      const { data, error } = await supabase
        .from("tabela_prestador")
        .select("*")
        .eq("prestador_id", prestador_id)
        .ilike("tipo_veiculo", tipo_veiculo)
        .ilike("cidade", cidade)
        .ilike("uf", uf)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      
      if (data && !error) {
        console.log("[Tabela Prestador] 1. Usada tabela prestador+tipo+cidade:", data.nome);
        return data as TabelaPrestadorOperacional;
      }
    }

    // 2. prestador_id + tipo_veiculo + regiao
    if (prestador_id && tipo_veiculo && regiao) {
      const { data, error } = await supabase
        .from("tabela_prestador")
        .select("*")
        .eq("prestador_id", prestador_id)
        .ilike("tipo_veiculo", tipo_veiculo)
        .ilike("regiao", regiao)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      
      if (data && !error) {
        console.log("[Tabela Prestador] 2. Usada tabela prestador+tipo+regiao:", data.nome);
        return data as TabelaPrestadorOperacional;
      }
    }

    // 3. prestador_id + tipo_veiculo
    if (prestador_id && tipo_veiculo) {
      const { data, error } = await supabase
        .from("tabela_prestador")
        .select("*")
        .eq("prestador_id", prestador_id)
        .ilike("tipo_veiculo", tipo_veiculo)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      
      if (data && !error) {
        console.log("[Tabela Prestador] 3. Usada tabela prestador+tipo:", data.nome);
        return data as TabelaPrestadorOperacional;
      }
    }

    // 4. tipo_veiculo + cidade/uf
    if (tipo_veiculo && cidade && uf) {
      const { data, error } = await supabase
        .from("tabela_prestador")
        .select("*")
        .ilike("tipo_veiculo", tipo_veiculo)
        .ilike("cidade", cidade)
        .ilike("uf", uf)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      
      if (data && !error) {
        console.log("[Tabela Prestador] 4. Usada tabela tipo+cidade/uf:", data.nome);
        return data as TabelaPrestadorOperacional;
      }
    }

    // 5. tipo_veiculo + regiao
    if (tipo_veiculo && regiao) {
      const { data, error } = await supabase
        .from("tabela_prestador")
        .select("*")
        .ilike("tipo_veiculo", tipo_veiculo)
        .ilike("regiao", regiao)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      
      if (data && !error) {
        console.log("[Tabela Prestador] 5. Usada tabela tipo+regiao:", data.nome);
        return data as TabelaPrestadorOperacional;
      }
    }

    // 6. tipo_veiculo genérico
    if (tipo_veiculo) {
      const { data, error } = await supabase
        .from("tabela_prestador")
        .select("*")
        .ilike("tipo_veiculo", tipo_veiculo)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      
      if (data && !error) {
        console.log("[Tabela Prestador] 6. Usada tabela genérica por tipo:", data.nome);
        return data as TabelaPrestadorOperacional;
      }
    }

    console.warn("[Tabela Prestador] Nenhuma tabela encontrada para:", params);
    return null;
  } catch (e) {
    console.error("[Tabela Prestador] Erro na busca:", e);
    return null;
  }
};

/**
 * TAREFA 2.2 - Calcular valor do prestador baseado na tabela
 * Fórmula: valor = valor_minimo + (distanciaKm > km_incluso ? (distanciaKm - km_incluso) * valor_km : 0) + valor_saida
 * Nunca retorna NaN.
 */
export const calcularValorPrestador = (
  distanciaKm: number,
  tabela: TabelaPrestadorOperacional | null
): { valor: number; valorBase: number; kmExcedente: number; valorKmExcedente: number } => {
  if (!tabela) {
    return { valor: 0, valorBase: 0, kmExcedente: 0, valorKmExcedente: 0 };
  }

  const valorMinimo = Number(tabela.valor_minimo) || 0;
  const kmIncluso = Number(tabela.km_incluso) || 0;
  const valorKm = Number(tabela.valor_km) || 0;
  const valorSaida = Number(tabela.valor_saida) || 0;

  // Garantir que distanciaKm é um número válido
  const distancia = Number(distanciaKm) || 0;
  
  const kmExcedente = Math.max(0, distancia - kmIncluso);
  const valorKmExcedente = kmExcedente * valorKm;
  
  let valorCalculado = valorMinimo + valorKmExcedente;
  
  // Adicionar valor_saida se existir
  if (valorSaida > 0) {
    valorCalculado += valorSaida;
  }
  
  // Garantir que nunca retorna NaN
  const valorFinal = isNaN(valorCalculado) ? valorMinimo : valorCalculado;
  
  return {
    valor: Math.round(valorFinal * 100) / 100,
    valorBase: valorMinimo,
    kmExcedente: Math.round(kmExcedente * 10) / 10,
    valorKmExcedente: Math.round(valorKmExcedente * 100) / 100
  };
};

/**
 * TAREFA 2.3 - Calcular composição financeira completa
 */
export const calcularComposicaoFinanceira = (params: {
  valor_cliente: number;
  valor_prestador: number;
  imposto_percentual?: number;
  seguro_valor?: number;
  pedagio_valor?: number;
  outros_custos?: number;
}): ComposicaoFinanceiraOS => {
  const {
    valor_cliente,
    valor_prestador,
    imposto_percentual = 4.5, // Default 4.5% (PIS/COFINS/ISS)
    seguro_valor = 0,
    pedagio_valor = 0,
    outros_custos = 0
  } = params;

  const imposto_valor = Number(((valor_cliente * imposto_percentual) / 100).toFixed(2));
  
  const margem_bruta = Number((valor_cliente - valor_prestador - pedagio_valor - outros_custos).toFixed(2));
  const margem_liquida = Number((margem_bruta - imposto_valor - seguro_valor).toFixed(2));
  
  const percentual_margem_bruta = valor_cliente > 0 
    ? Number(((margem_bruta / valor_cliente) * 100).toFixed(2)) 
    : 0;
  const percentual_margem_liquida = valor_cliente > 0 
    ? Number(((margem_liquida / valor_cliente) * 100).toFixed(2)) 
    : 0;

  return {
    valor_cliente,
    valor_prestador,
    imposto_percentual,
    imposto_valor,
    seguro_valor,
    pedagio_valor,
    outros_custos,
    margem_bruta,
    margem_liquida,
    percentual_margem_bruta,
    percentual_margem_liquida,
    origem_calculo: 'ordem_servico'
  };
};

/**
 * TAREFA 2.4 - Salvar composição financeira (evitar duplicidade)
 */
export const salvarComposicaoFinanceira = async (
  osId: string,
  composicao: ComposicaoFinanceiraOS
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    // Verificar se já existe
    const { data: existente } = await supabase
      .from("composicao_financeira_os")
      .select("id")
      .eq("os_id", osId)
      .limit(1)
      .maybeSingle();

    const payload = {
      os_id: osId,
      cliente_id: composicao.cliente_id,
      prestador_id: composicao.prestador_id,
      valor_cliente: composicao.valor_cliente || 0,
      valor_prestador: composicao.valor_prestador || 0,
      imposto_percentual: composicao.imposto_percentual || 4.5,
      imposto_valor: composicao.imposto_valor || 0,
      seguro_valor: composicao.seguro_valor || 0,
      pedagio_valor: composicao.pedagio_valor || 0,
      outros_custos: composicao.outros_custos || 0,
      margem_bruta: composicao.margem_bruta || 0,
      margem_liquida: composicao.margem_liquida || 0,
      percentual_margem_bruta: composicao.percentual_margem_bruta || 0,
      percentual_margem_liquida: composicao.percentual_margem_liquida || 0,
      origem_calculo: composicao.origem_calculo || 'ordem_servico'
    };

    if (existente?.id) {
      // Atualizar
      const { error } = await supabase
        .from("composicao_financeira_os")
        .update(payload)
        .eq("id", existente.id);
      
      if (error) {
        console.error("[Composição Financeira] Erro ao atualizar:", error);
        return { success: false, error: error.message };
      }
      
      console.log("[Composição Financeira] Atualizada para OS:", osId);
      return { success: true, id: existente.id };
    } else {
      // Inserir
      const { data, error } = await supabase
        .from("composicao_financeira_os")
        .insert([payload])
        .select("id")
        .single();
      
      if (error) {
        console.error("[Composição Financeira] Erro ao inserir:", error);
        return { success: false, error: error.message };
      }
      
      console.log("[Composição Financeira] Criada para OS:", osId);
      return { success: true, id: data?.id };
    }
  } catch (e: any) {
    console.error("[Composição Financeira] Erro geral:", e);
    return { success: false, error: e.message };
  }
};

/**
 * Buscar composição financeira por OS
 */
export const buscarComposicaoFinanceira = async (osId: string): Promise<ComposicaoFinanceiraOS | null> => {
  try {
    const { data, error } = await supabase
      .from("composicao_financeira_os")
      .select("*")
      .eq("os_id", osId)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error("[Composição Financeira] Erro ao buscar:", error);
      return null;
    }
    
    return data as ComposicaoFinanceiraOS | null;
  } catch (e) {
    console.error("[Composição Financeira] Erro geral:", e);
    return null;
  }
};

/**
 * Listar composições para relatório
 */
export const listarComposicoesFinanceiras = async (params?: {
  dataInicio?: string;
  dataFim?: string;
  cliente_id?: string;
  prestador_id?: string;
  margemMinima?: number;
}): Promise<(ComposicaoFinanceiraOS & { os?: any })[]> => {
  try {
    let query = supabase
      .from("composicao_financeira_os")
      .select(`
        *,
        os:ordens_servico(
          id, numero, status, created_at
        )
      `)
      .order("created_at", { ascending: false });

    if (params?.dataInicio) {
      query = query.gte("created_at", params.dataInicio);
    }
    if (params?.dataFim) {
      query = query.lte("created_at", params.dataFim);
    }
    if (params?.cliente_id) {
      query = query.eq("cliente_id", params.cliente_id);
    }
    if (params?.prestador_id) {
      query = query.eq("prestador_id", params.prestador_id);
    }
    if (params?.margemMinima) {
      query = query.gte("percentual_margem_liquida", params.margemMinima);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("[Composição Financeira] Erro ao listar:", error);
      return [];
    }
    
    return (data || []) as any;
  } catch (e) {
    console.error("[Composição Financeira] Erro geral:", e);
    return [];
  }
};
