import { supabase } from "@/lib/supabase";

export interface RegraFiscalNfse {
  id: string;
  emitente_id: string | null;
  cliente_id: string | null;
  municipio_prestacao: string;
  uf: string | null;
  codigo_servico: string;
  descricao_servico: string | null;
  aliquota_iss: number | null;
  iss_retido: boolean | null;
  observacao: string | null;
  ativo: boolean | null;
}

export interface BuscarRegraNfseParams {
  emitente_id?: string | null;
  cliente_id?: string | null;
  municipio_prestacao?: string | null;
}

export async function buscarRegraNfse(params: BuscarRegraNfseParams): Promise<RegraFiscalNfse | null> {
  try {
    const { emitente_id, cliente_id, municipio_prestacao } = params;
    if (!municipio_prestacao) return null;

    const tentativas = [];

    // Prioridade 1: emitente + cliente + municipio
    if (emitente_id && cliente_id) {
      tentativas.push(
        supabase.from("regras_fiscais_nfse").select("*").eq("ativo", true)
          .eq("emitente_id", emitente_id).eq("cliente_id", cliente_id)
          .eq("municipio_prestacao", municipio_prestacao).limit(1).maybeSingle()
      );
    }
    // Prioridade 2: emitente + municipio
    if (emitente_id) {
      tentativas.push(
        supabase.from("regras_fiscais_nfse").select("*").eq("ativo", true)
          .eq("emitente_id", emitente_id).is("cliente_id", null)
          .eq("municipio_prestacao", municipio_prestacao).limit(1).maybeSingle()
      );
    }
    // Prioridade 3: cliente + municipio
    if (cliente_id) {
      tentativas.push(
        supabase.from("regras_fiscais_nfse").select("*").eq("ativo", true)
          .is("emitente_id", null).eq("cliente_id", cliente_id)
          .eq("municipio_prestacao", municipio_prestacao).limit(1).maybeSingle()
      );
    }
    // Prioridade 4: municipio (fallback generico)
    tentativas.push(
      supabase.from("regras_fiscais_nfse").select("*").eq("ativo", true)
        .is("emitente_id", null).is("cliente_id", null)
        .eq("municipio_prestacao", municipio_prestacao).limit(1).maybeSingle()
    );

    const resultados = await Promise.all(tentativas);
    for (const { data, error } of resultados) {
      if (!error && data) return data as RegraFiscalNfse;
    }
    return null;
  } catch (err: any) {
    console.error("[RegrasFiscaisNfse] Erro ao buscar:", err);
    return null;
  }
}

export async function listarRegrasNfse(): Promise<RegraFiscalNfse[]> {
  const { data } = await supabase.from("regras_fiscais_nfse").select("*").order("created_at", { ascending: false });
  return (data || []) as RegraFiscalNfse[];
}

export async function salvarRegraNfse(dados: {
  emitente_id?: string | null; cliente_id?: string | null;
  municipio_prestacao: string; uf?: string | null;
  codigo_servico: string; descricao_servico?: string | null;
  aliquota_iss?: number | null; iss_retido?: boolean | null;
  observacao?: string | null; ativo?: boolean;
}) {
  const { data, error } = await supabase.from("regras_fiscais_nfse").insert([dados]).select("*").single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: data as RegraFiscalNfse };
}
