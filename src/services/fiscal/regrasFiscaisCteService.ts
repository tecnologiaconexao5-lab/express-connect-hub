import { supabase } from "@/lib/supabase";

export interface RegraFiscalCte {
  id: string;
  cliente_id: string | null;
  uf_origem: string | null;
  uf_destino: string | null;
  tipo_operacao: string | null;
  cfop: string;
  natureza_operacao: string | null;
  aliquota_icms: number | null;
  observacao: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SalvarRegraFiscalCteInput {
  cliente_id?: string | null;
  uf_origem?: string | null;
  uf_destino?: string | null;
  tipo_operacao?: string | null;
  cfop: string;
  natureza_operacao?: string | null;
  aliquota_icms?: number | null;
  observacao?: string | null;
  ativo?: boolean;
}

interface BuscarCfopParams {
  cliente_id?: string | null;
  uf_origem?: string | null;
  uf_destino?: string | null;
  tipo_operacao?: string | null;
}

export async function buscarCfop(params: BuscarCfopParams): Promise<RegraFiscalCte | null> {
  try {
    const { cliente_id, uf_origem, uf_destino, tipo_operacao } = params;

    const tentativas = [];

    // Prioridade 1: cliente + uf_origem + uf_destino + tipo_operacao
    if (cliente_id && uf_origem && uf_destino && tipo_operacao) {
      tentativas.push(
        supabase.from("regras_fiscais_cte").select("*")
          .eq("ativo", true)
          .eq("cliente_id", cliente_id)
          .eq("uf_origem", uf_origem)
          .eq("uf_destino", uf_destino)
          .eq("tipo_operacao", tipo_operacao)
          .limit(1).maybeSingle()
      );
    }

    // Prioridade 2: cliente + uf_origem + uf_destino
    if (cliente_id && uf_origem && uf_destino) {
      tentativas.push(
        supabase.from("regras_fiscais_cte").select("*")
          .eq("ativo", true)
          .eq("cliente_id", cliente_id)
          .eq("uf_origem", uf_origem)
          .eq("uf_destino", uf_destino)
          .is("tipo_operacao", null)
          .limit(1).maybeSingle()
      );
    }

    // Prioridade 3: uf_origem + uf_destino + tipo_operacao
    if (uf_origem && uf_destino && tipo_operacao) {
      tentativas.push(
        supabase.from("regras_fiscais_cte").select("*")
          .eq("ativo", true)
          .is("cliente_id", null)
          .eq("uf_origem", uf_origem)
          .eq("uf_destino", uf_destino)
          .eq("tipo_operacao", tipo_operacao)
          .limit(1).maybeSingle()
      );
    }

    // Prioridade 4: uf_origem + uf_destino (fallback generico)
    if (uf_origem && uf_destino) {
      tentativas.push(
        supabase.from("regras_fiscais_cte").select("*")
          .eq("ativo", true)
          .is("cliente_id", null)
          .eq("uf_origem", uf_origem)
          .eq("uf_destino", uf_destino)
          .is("tipo_operacao", null)
          .limit(1).maybeSingle()
      );
    }

    if (tentativas.length === 0) return null;

    const resultados = await Promise.all(tentativas);
    for (const { data, error } of resultados) {
      if (!error && data) return data as RegraFiscalCte;
    }

    return null;
  } catch (err: any) {
    console.error("[RegrasFiscaisCte] Erro ao buscar CFOP:", err);
    return null;
  }
}

export async function listarRegrasFiscaisCte(): Promise<RegraFiscalCte[]> {
  try {
    const { data, error } = await supabase
      .from("regras_fiscais_cte")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as RegraFiscalCte[];
  } catch (err: any) {
    console.error("[RegrasFiscaisCte] Erro ao listar:", err);
    return [];
  }
}

export async function salvarRegraFiscalCte(
  dados: SalvarRegraFiscalCteInput
): Promise<{ success: boolean; data?: RegraFiscalCte; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("regras_fiscais_cte")
      .insert([dados])
      .select("*")
      .single();

    if (error) throw error;
    return { success: true, data: data as RegraFiscalCte };
  } catch (err: any) {
    console.error("[RegrasFiscaisCte] Erro ao salvar:", err);
    return { success: false, error: err.message };
  }
}

export async function atualizarRegraFiscalCte(
  id: string,
  dados: Partial<SalvarRegraFiscalCteInput>
): Promise<{ success: boolean; data?: RegraFiscalCte; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("regras_fiscais_cte")
      .update(dados)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return { success: true, data: data as RegraFiscalCte };
  } catch (err: any) {
    console.error("[RegrasFiscaisCte] Erro ao atualizar:", err);
    return { success: false, error: err.message };
  }
}
