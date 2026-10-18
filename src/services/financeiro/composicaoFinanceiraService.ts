/**
 * @deprecated MISSÃO 78 — Use buscarTabelasService para buscar tabelas e
 * precificacaoEngineService para cálculos. Este serviço tem duplicata de
 * buscarTabelaPrestador() (6 níveis) e calcularValorPrestador() que agora
 * estão centralizados no módulo de precificação.
 *
 * Mantido apenas para referência durante migração. Remover após validação.
 */
import { supabase } from "@/lib/supabase";

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
 * TAREFA 2.3 - Calcular composição financeira completa
 */
/**
 * @deprecated MISSÃO 80 — Use precificacaoEngineService para cálculos de margem.
 * Mantida apenas para compatibilidade com TesteInteligencia.tsx.
 * Função pura (não escreve no banco) — segura manter.
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
 * MISSÃO 80 — salvarComposicaoFinanceira removida.
 * A composição financeira agora é persistida exclusivamente pelos triggers:
 *   - M66 (trg_propagar_financeiro_alocacao) para escalas concluídas
 *   - M80 (trg_propagar_financeiro_os) para OS finalizadas
 * Use calcularComposicaoFinanceira() para preview/validação.
 */

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
