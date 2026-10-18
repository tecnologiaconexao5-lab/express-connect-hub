// ═══════════════════════════════════════════════════════════════════════════════
// A29-D — PAINEL DE KM NO TMS OFICIAL (somente leitura)
// kmEvidenciasService.ts — consome a RPC f_km_evidencias_operacao (SECURITY
// DEFINER, guard via tenant_usuarios). NUNCA escreve/fabrica KM ou foto.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

export interface KmEvidencia {
  km_inicial: number | null;
  km_final: number | null;
  km_rodado: number | null;
  km_adicional: number | null;
  valor_adicional_estimado: number | null;
  foto_km_inicial_url: string | null;
  foto_km_final_url: string | null;
  updated_at: string | null;
}

export interface TimelineEvento {
  type: string | null;
  title: string | null;
  event_time: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AlocacaoKmEvidencias {
  alocacao_id: string;
  status: string | null;
  finalizada: boolean;
  placa: string | null;
  tipo_veiculo: string | null;
  tempos: {
    data_escala: string | null;
    data_aceite: string | null;
    horario_inicio_real: string | null;
    horario_fim_real: string | null;
    data_finalizacao: string | null;
    tempo_total_minutos: number | null;
    updated_at: string | null;
  };
  km: KmEvidencia | null;
  timeline: TimelineEvento[];
}

export interface KmEvidenciasDaOS {
  success: boolean;
  os_id: string;
  os_numero: string | null;
  total_alocacoes: number;
  alocacoes: AlocacaoKmEvidencias[];
  error?: string;
}

/** Busca evidências de KM (inicial/final/foto/percorrido) + horários/tempos de uma OS. */
export async function buscarKmEvidenciasDaOS(osId: string): Promise<KmEvidenciasDaOS | null> {
  try {
    const { data, error } = await supabase.rpc("f_km_evidencias_operacao", { p_os_id: osId });
    if (error) {
      console.warn("[kmEvidenciasService] Erro ao buscar evidências de KM:", error.message);
      return null;
    }
    return (data || null) as KmEvidenciasDaOS | null;
  } catch (err) {
    console.warn("[kmEvidenciasService] Exceção ao buscar evidências de KM:", err);
    return null;
  }
}
