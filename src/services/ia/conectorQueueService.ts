import { supabase } from "@/lib/supabase";
import { conectoresService } from "./conectoresService";
import { centralIaService } from "@/services/centralIaService";

type StatusFila = "SOLICITADA" | "EM_EXECUCAO" | "CONCLUIDA" | "FALHOU" | "CANCELADA";

interface FilaItem {
  id: string;
  robo_id: string;
  conector_id: string;
  acao: string;
  status: StatusFila;
  tentativa: number;
  created_at: string;
  conector_nome?: string;
  robo_nome?: string;
}

interface StatusFilaResultado {
  pendentes: number;
  em_execucao: number;
  concluidas_hoje: number;
  falhas_hoje: number;
  total_hoje: number;
  tempo_medio_fila_ms: number;
  itens_pendentes: FilaItem[];
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const conectorQueueService = {
  async enfileirar(params: {
    robo_id: string;
    conector_id: string;
    ferramenta_id?: string;
    acao: string;
    payload?: Record<string, unknown>;
    modo: string;
  }): Promise<string | null> {
    const { data, error } = await supabase.from("ia_execucoes_conectores").insert({
      robo_id: params.robo_id,
      conector_id: params.conector_id,
      ferramenta_id: params.ferramenta_id || null,
      acao: params.acao,
      payload: params.payload || {},
      modo_executado: params.modo,
      status: "SOLICITADA",
      tentativa: 0,
      inicio_execucao: new Date().toISOString(),
    }).select("id").single();

    if (error) {
      console.error("[ConectorQueue] erro enfileirar:", error.message);
      return null;
    }
    return data.id;
  },

  async processarFila(limite = 5): Promise<{ processadas: number; falhas: number }> {
    const { data: pendentes } = await supabase
      .from("ia_execucoes_conectores")
      .select("id, conector_id")
      .eq("status", "SOLICITADA")
      .order("created_at", { ascending: true })
      .limit(limite);

    if (!pendentes || pendentes.length === 0) return { processadas: 0, falhas: 0 };

    let processadas = 0;
    let falhas = 0;

    for (const item of pendentes) {
      // Busca tentativa atual e incrementa
      const { data: atual } = await supabase
        .from("ia_execucoes_conectores")
        .select("tentativa")
        .eq("id", item.id)
        .single();
      const novoTentativa = (atual?.tentativa || 0) + 1;

      await supabase.from("ia_execucoes_conectores").update({
        status: "EM_EXECUCAO",
        tentativa: novoTentativa,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);

      try {
        const sucesso = await conectoresService.executarConector(item.id);
        if (sucesso) processadas++;
        else falhas++;
      } catch {
        await supabase.from("ia_execucoes_conectores").update({
          status: "FALHOU",
          erro: "Erro ao processar item da fila",
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        falhas++;
      }
    }

    return { processadas, falhas };
  },

  async obterStatusFila(): Promise<StatusFilaResultado> {
    const hoje = hojeISO();

    const [{ count: pendentes }, { count: emExecucao }, { data: concluidasHoje }, { data: itensPendentes }] =
      await Promise.all([
        supabase.from("ia_execucoes_conectores").select("id", { count: "exact", head: true }).eq("status", "SOLICITADA"),
        supabase.from("ia_execucoes_conectores").select("id", { count: "exact", head: true }).eq("status", "EM_EXECUCAO"),
        supabase.from("ia_execucoes_conectores").select("id, status").gte("created_at", hoje),
        supabase.from("ia_execucoes_conectores")
          .select("id, robo_id, conector_id, acao, status, tentativa, created_at")
          .in("status", ["SOLICITADA", "EM_EXECUCAO"])
          .order("created_at", { ascending: true })
          .limit(20),
      ]);

    const concluidasHojeCount = concluidasHoje?.filter((e) => e.status === "CONCLUIDA").length || 0;
    const falhasHojeCount = concluidasHoje?.filter((e) => e.status === "FALHOU").length || 0;
    const totalHoje = concluidasHoje?.length || 0;

    // Tempo médio na fila: calcula diff entre created_at e now para pendentes mais antigos
    let tempoMedioFilaMs = 0;
    const agora = Date.now();
    const itensComTempo = (itensPendentes || []).filter((i) => i.created_at);
    if (itensComTempo.length > 0) {
      const somaDiffs = itensComTempo.reduce((acc, i) => {
        return acc + (agora - new Date(i.created_at).getTime());
      }, 0);
      tempoMedioFilaMs = Math.round(somaDiffs / itensComTempo.length);
    }

    return {
      pendentes: pendentes ?? 0,
      em_execucao: emExecucao ?? 0,
      concluidas_hoje: concluidasHojeCount,
      falhas_hoje: falhasHojeCount,
      total_hoje: totalHoje,
      tempo_medio_fila_ms: tempoMedioFilaMs,
      itens_pendentes: (itensPendentes || []) as FilaItem[],
    };
  },

  async obterMetricasFila(): Promise<{
    fila: StatusFilaResultado;
    taxa_sucesso: number;
    taxa_falha: number;
    disponibilidade_percentual: number;
  }> {
    const fila = await this.obterStatusFila();
    const totalProcessados = fila.concluidas_hoje + fila.falhas_hoje;
    const taxaSucesso = totalProcessados > 0 ? Math.round((fila.concluidas_hoje / totalProcessados) * 100) : 100;
    const taxaFalha = totalProcessados > 0 ? Math.round((fila.falhas_hoje / totalProcessados) * 100) : 0;
    const disponibilidade = fila.total_hoje > 0
      ? Math.round((fila.concluidas_hoje / (fila.concluidas_hoje + fila.falhas_hoje)) * 100)
      : 100;

    return {
      fila,
      taxa_sucesso: taxaSucesso,
      taxa_falha: taxaFalha,
      disponibilidade_percentual: disponibilidade,
    };
  },

  async cancelarItemFila(itemId: string, motivo?: string): Promise<boolean> {
    const { error } = await supabase.from("ia_execucoes_conectores").update({
      status: "CANCELADA",
      erro: motivo || "Cancelado manualmente",
      fim_execucao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", itemId);

    if (error) {
      console.error("[ConectorQueue] erro cancelar:", error.message);
      return false;
    }
    return true;
  },
};
