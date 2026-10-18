import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { memoriaService } from "@/services/ia/memoriaService";

export type PrioridadeTrabalho = "baixa" | "normal" | "alta" | "critica";
export type StatusTrabalho = "pendente" | "em_andamento" | "concluida" | "falhou" | "cancelada" | "escalada";
export type StatusFilaTrabalho = "pendente" | "em_andamento" | "concluida" | "falhou";

export interface IaTrabalho {
  id: string;
  robo_id: string | null;
  origem: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  prioridade: PrioridadeTrabalho;
  status: StatusTrabalho;
  criado_por_robo: string | null;
  atribuido_por_robo: string | null;
  data_criacao: string;
  data_vencimento: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  payload: Record<string, unknown>;
  resultado: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IaFilaTrabalho {
  id: string;
  trabalho_id: string;
  robo_id: string;
  ordem_execucao: number;
  status: StatusFilaTrabalho;
  tentativas: number;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  created_at: string;
  updated_at: string;
}

export interface IaHistoricoTrabalho {
  id: string;
  trabalho_id: string;
  robo_id: string | null;
  acao: string;
  detalhes: Record<string, unknown>;
  created_at: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

export const workforceOrchestratorService = {
  async criarTrabalho(params: {
    robo_id?: string;
    origem: string;
    tipo: string;
    titulo: string;
    descricao?: string;
    prioridade?: PrioridadeTrabalho;
    data_vencimento?: string;
    criado_por_robo?: string;
    atribuido_por_robo?: string;
    payload?: Record<string, unknown>;
  }): Promise<IaTrabalho | null> {
    const payload = params.payload || {};
    let textoContextoMemoria = "";
    if (payload.entidade_tipo && payload.entidade_id && params.robo_id) {
      try {
        const completo = await memoriaService.montarContextoCompleto({
          roboId: params.robo_id,
          entidadeTipo: payload.entidade_tipo as "cliente" | "lead" | "motorista" | "prestador" | "fornecedor" | "colaborador" | "robo" | "projeto" | "contrato" | "outro",
          entidadeId: payload.entidade_id as string,
          consulta: params.titulo,
        });
        textoContextoMemoria = completo.texto_contexto;
        payload.contexto_memoria = textoContextoMemoria;
        void centralIaService.registrarLog({
          robo_id: params.robo_id,
          acao: "memoria_consultada",
          entrada: { entidade_tipo: payload.entidade_tipo, entidade_id: payload.entidade_id, motivo: "criar_trabalho" },
          saida: { contexto_length: completo.texto_contexto.length },
          status: "info",
        });
      } catch { /* memoria indisponivel */ }
    }

    const { data, error } = await supabase.from("ia_trabalhos").insert({
      robo_id: params.robo_id || null,
      origem: params.origem,
      tipo: params.tipo,
      titulo: params.titulo,
      descricao: params.descricao || null,
      prioridade: params.prioridade || "normal",
      status: "pendente",
      criado_por_robo: params.criado_por_robo || null,
      atribuido_por_robo: params.atribuido_por_robo || null,
      data_criacao: nowISO(),
      data_vencimento: params.data_vencimento || null,
      payload,
    }).select().single();

    if (error) { console.error("[Workforce] erro criar trabalho:", error.message); return null; }

    if (data && params.robo_id) {
      await this.atribuirTrabalho(data.id, params.robo_id, params.atribuido_por_robo);
    }

    void centralIaService.registrarLog({
      acao: "trabalho_criado",
      entrada: { titulo: params.titulo, tipo: params.tipo, origem: params.origem },
      saida: { trabalho_id: data?.id },
      status: "sucesso",
    });

    return data as IaTrabalho;
  },

  async atribuirTrabalho(trabalhoId: string, roboId: string, atribuidoPor?: string): Promise<IaFilaTrabalho | null> {
    const { data: maxOrdem } = await supabase
      .from("ia_fila_trabalho")
      .select("ordem_execucao")
      .eq("robo_id", roboId)
      .order("ordem_execucao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ordem = (maxOrdem?.ordem_execucao ?? -1) + 1;
    const proxima = nowISO();

    const { data, error } = await supabase.from("ia_fila_trabalho").insert({
      trabalho_id: trabalhoId,
      robo_id: roboId,
      ordem_execucao: ordem,
      status: "pendente",
      tentativas: 0,
      proxima_execucao: proxima,
    }).select().single();

    if (error) { console.error("[Workforce] erro atribuir trabalho:", error.message); return null; }

    await supabase.from("ia_trabalhos").update({
      robo_id: roboId,
      atribuido_por_robo: atribuidoPor || null,
    }).eq("id", trabalhoId);

    await this.registrarHistorico(trabalhoId, roboId, "atribuido", {
      fila_id: data.id,
      ordem_execucao: ordem,
      atribuido_por: atribuidoPor || null,
    });

    return data as IaFilaTrabalho;
  },

  async executarTrabalho(filaId: string): Promise<boolean> {
    const { data: fila } = await supabase
      .from("ia_fila_trabalho")
      .select("*, ia_trabalhos(*)")
      .eq("id", filaId)
      .single();

    if (!fila) return false;

    await supabase.from("ia_fila_trabalho").update({
      status: "em_andamento",
      ultima_execucao: nowISO(),
      tentativas: (fila.tentativas || 0) + 1,
    }).eq("id", filaId);

    await supabase.from("ia_trabalhos").update({
      status: "em_andamento",
      data_inicio: nowISO(),
    }).eq("id", fila.trabalho_id);

    await this.registrarHistorico(fila.trabalho_id, fila.robo_id, "executando", {
      fila_id: filaId,
      tentativa: (fila.tentativas || 0) + 1,
    });

    const resultado: Record<string, unknown> = {
      status: "simulado",
      mensagem: "Trabalho executado com sucesso",
      timestamp: nowISO(),
    };

    await supabase.from("ia_trabalhos").update({
      status: "concluida",
      resultado,
      data_conclusao: nowISO(),
    }).eq("id", fila.trabalho_id);

    await supabase.from("ia_fila_trabalho").update({
      status: "concluida",
      ultima_execucao: nowISO(),
    }).eq("id", filaId);

    await this.registrarHistorico(fila.trabalho_id, fila.robo_id, "concluido", {
      fila_id: filaId,
      resultado,
    });

    void centralIaService.registrarLog({
      robo_id: fila.robo_id,
      acao: "trabalho_executado",
      entrada: { trabalho_id: fila.trabalho_id, fila_id: filaId },
      saida: resultado,
      status: "sucesso",
    });

    return true;
  },

  async concluirTrabalho(trabalhoId: string, resultado?: Record<string, unknown>): Promise<void> {
    await supabase.from("ia_trabalhos").update({
      status: "concluida",
      resultado: resultado || {},
      data_conclusao: nowISO(),
    }).eq("id", trabalhoId);

    await supabase.from("ia_fila_trabalho").update({
      status: "concluida",
    }).eq("trabalho_id", trabalhoId).eq("status", "em_andamento");

    await this.registrarHistorico(trabalhoId, null, "concluido", { resultado });
  },

  async cancelarTrabalho(trabalhoId: string, motivo?: string): Promise<void> {
    await supabase.from("ia_trabalhos").update({
      status: "cancelada",
      resultado: { motivo_cancelamento: motivo || "Cancelado manualmente" },
    }).eq("id", trabalhoId);

    await supabase.from("ia_fila_trabalho").update({
      status: "falhou",
    }).eq("trabalho_id", trabalhoId).in("status", ["pendente", "em_andamento"]);

    await this.registrarHistorico(trabalhoId, null, "cancelado", { motivo });
  },

  async escalarTrabalho(trabalhoId: string, motivo: string, roboId?: string): Promise<void> {
    await supabase.from("ia_trabalhos").update({
      status: "escalada",
      resultado: { motivo_escalacao: motivo },
    }).eq("id", trabalhoId);

    await this.registrarHistorico(trabalhoId, roboId || null, "escalado", { motivo });

    await centralIaService.criarTarefa({
      robo_id: roboId || "00000000-0000-0000-0000-000000000000",
      setor: "TI / Governança",
      tipo_tarefa: "escalar_trabalho",
      titulo: `[Workforce] Trabalho escalado: ${trabalhoId}`,
      descricao: motivo,
      prioridade: "alta",
      payload: { trabalho_id: trabalhoId, motivo },
    });

    void centralIaService.registrarLog({
      acao: "trabalho_escalado",
      entrada: { trabalho_id: trabalhoId, motivo },
      saida: {},
      status: "alerta",
    });
  },

  async redistribuirTrabalho(trabalhoId: string, novoRoboId: string, redistribuidoPor?: string): Promise<IaFilaTrabalho | null> {
    const { data: trabalho } = await supabase
      .from("ia_trabalhos")
      .select("*")
      .eq("id", trabalhoId)
      .single();

    if (!trabalho) return null;

    await supabase.from("ia_fila_trabalho").update({
      status: "falhou",
    }).eq("trabalho_id", trabalhoId).in("status", ["pendente", "em_andamento"]);

    const fila = await this.atribuirTrabalho(trabalhoId, novoRoboId, redistribuidoPor);

    await this.registrarHistorico(trabalhoId, novoRoboId, "redistribuido", {
      de_robo_id: trabalho.robo_id,
      para_robo_id: novoRoboId,
      redistribuido_por: redistribuidoPor || null,
    });

    return fila;
  },

  async listarFila(params?: {
    robo_id?: string;
    status?: StatusFilaTrabalho;
    limite?: number;
  }): Promise<(IaFilaTrabalho & { trabalho?: IaTrabalho })[]> {
    let query = supabase
      .from("ia_fila_trabalho")
      .select("*, ia_trabalhos(*)")
      .order("ordem_execucao", { ascending: true });

    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.status) query = query.eq("status", params.status);
    if (params?.limite) query = query.limit(params.limite);

    const { data } = await query;
    return ((data as Record<string, unknown>[]) || []).map((f) => ({
      ...(f as unknown as IaFilaTrabalho),
      trabalho: (f as { ia_trabalhos?: IaTrabalho }).ia_trabalhos,
    }));
  },

  async listarTrabalhos(params?: {
    robo_id?: string;
    status?: StatusTrabalho;
    prioridade?: PrioridadeTrabalho;
    origem?: string;
    tipo?: string;
    limite?: number;
    offset?: number;
  }): Promise<IaTrabalho[]> {
    let query = supabase
      .from("ia_trabalhos")
      .select("*")
      .order("data_criacao", { ascending: false });

    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.status) query = query.eq("status", params.status);
    if (params?.prioridade) query = query.eq("prioridade", params.prioridade);
    if (params?.origem) query = query.eq("origem", params.origem);
    if (params?.tipo) query = query.eq("tipo", params.tipo);
    if (params?.limite) query = query.limit(params.limite);
    if (params?.offset) query = query.range(params.offset, params.offset + (params.limite || 50) - 1);

    const { data } = await query;
    return (data as IaTrabalho[]) || [];
  },

  async listarHistorico(params?: {
    trabalho_id?: string;
    robo_id?: string;
    limite?: number;
  }): Promise<IaHistoricoTrabalho[]> {
    let query = supabase
      .from("ia_historico_trabalho")
      .select("*")
      .order("created_at", { ascending: false });

    if (params?.trabalho_id) query = query.eq("trabalho_id", params.trabalho_id);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.limite) query = query.limit(params.limite);

    const { data } = await query;
    return (data as IaHistoricoTrabalho[]) || [];
  },

  async registrarHistorico(trabalhoId: string, roboId: string | null, acao: string, detalhes?: Record<string, unknown>): Promise<void> {
    await supabase.from("ia_historico_trabalho").insert({
      trabalho_id: trabalhoId,
      robo_id: roboId,
      acao,
      detalhes: detalhes || {},
    });
  },

  async obterEstatisticas(): Promise<{
    total: number;
    pendentes: number;
    em_andamento: number;
    concluidas: number;
    falhas: number;
    canceladas: number;
    escaladas: number;
    atrasadas: number;
    por_prioridade: Record<string, number>;
    por_origem: Record<string, number>;
    por_tipo: Record<string, number>;
  }> {
    const { data: todos } = await supabase.from("ia_trabalhos").select("status, prioridade, origem, tipo, data_vencimento");

    const lista = (todos || []) as { status: string; prioridade: string; origem: string; tipo: string; data_vencimento: string | null }[];
    const agora = nowISO();

    const stats = {
      total: lista.length,
      pendentes: lista.filter((t) => t.status === "pendente").length,
      em_andamento: lista.filter((t) => t.status === "em_andamento").length,
      concluidas: lista.filter((t) => t.status === "concluida").length,
      falhas: lista.filter((t) => t.status === "falhou").length,
      canceladas: lista.filter((t) => t.status === "cancelada").length,
      escaladas: lista.filter((t) => t.status === "escalada").length,
      atrasadas: lista.filter((t) => t.data_vencimento && t.data_vencimento < agora && t.status !== "concluida" && t.status !== "cancelada").length,
      por_prioridade: {} as Record<string, number>,
      por_origem: {} as Record<string, number>,
      por_tipo: {} as Record<string, number>,
    };

    for (const t of lista) {
      stats.por_prioridade[t.prioridade] = (stats.por_prioridade[t.prioridade] || 0) + 1;
      stats.por_origem[t.origem] = (stats.por_origem[t.origem] || 0) + 1;
      stats.por_tipo[t.tipo] = (stats.por_tipo[t.tipo] || 0) + 1;
    }

    return stats;
  },

  async obterProdutividadeRobo(roboId: string): Promise<{
    total: number;
    concluidas: number;
    falhas: number;
    taxa_conclusao: number;
    tempo_medio_execucao_segundos: number;
  }> {
    const { data: trabalhos } = await supabase
      .from("ia_trabalhos")
      .select("status, data_inicio, data_conclusao")
      .eq("robo_id", roboId);

    const lista = (trabalhos || []) as { status: string; data_inicio: string | null; data_conclusao: string | null }[];
    const concluidas = lista.filter((t) => t.status === "concluida");
    const falhas = lista.filter((t) => t.status === "falhou");

    let tempoTotalMs = 0;
    let countTempo = 0;
    for (const t of concluidas) {
      if (t.data_inicio && t.data_conclusao) {
        tempoTotalMs += new Date(t.data_conclusao).getTime() - new Date(t.data_inicio).getTime();
        countTempo++;
      }
    }

    return {
      total: lista.length,
      concluidas: concluidas.length,
      falhas: falhas.length,
      taxa_conclusao: lista.length > 0 ? Math.round((concluidas.length / lista.length) * 100) : 0,
      tempo_medio_execucao_segundos: countTempo > 0 ? Math.round(tempoTotalMs / countTempo / 1000) : 0,
    };
  },
};

export default workforceOrchestratorService;
