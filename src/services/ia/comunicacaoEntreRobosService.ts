import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { diretorVirtualService } from "./diretorVirtualService";
import { memoriaService } from "@/services/ia/memoriaService";

export type TipoComunicacao = "solicitacao" | "resposta" | "delegacao" | "alerta" | "escalonamento";
export type StatusComunicacao = "pendente" | "enviado" | "respondido" | "concluido" | "erro";
export type PrioridadeComunicacao = "low" | "medium" | "high" | "critical";

export interface ComunicacaoRobo {
  id: string;
  origem_robo_id: string;
  destino_robo_id: string;
  tipo: TipoComunicacao;
  assunto: string;
  mensagem: string;
  contexto: Record<string, unknown>;
  status: StatusComunicacao;
  prioridade: PrioridadeComunicacao;
  tarefa_id: string | null;
  rotina_id: string | null;
  resposta_texto: string | null;
  resposta_robo_id: string | null;
  created_at: string;
  updated_at: string;
  origem_nome?: string;
  destino_nome?: string;
}

export interface FilaComunicacao {
  id: string;
  robo_id: string;
  tipo_evento: string;
  payload: Record<string, unknown>;
  status: "pending" | "processed" | "failed";
  created_at: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function carregarNomesRobos(mensagens: ComunicacaoRobo[]): Promise<ComunicacaoRobo[]> {
  const roboIds = [...new Set(mensagens.flatMap((m) => [m.origem_robo_id, m.destino_robo_id]))];
  const { data: robos } = await supabase.from("automacoes_robos").select("id, nome").in("id", roboIds);
  const mapa = new Map((robos || []).map((r) => [r.id, r.nome]));
  return mensagens.map((m) => ({
    ...m,
    origem_nome: mapa.get(m.origem_robo_id) || m.origem_robo_id.substring(0, 8),
    destino_nome: mapa.get(m.destino_robo_id) || m.destino_robo_id.substring(0, 8),
  }));
}

export const comunicacaoEntreRobosService = {

  async enviarMensagem(
    origemId: string,
    destinoId: string,
    tipo: TipoComunicacao,
    assunto: string,
    mensagem: string,
    contexto: Record<string, unknown> = {},
    prioridade: PrioridadeComunicacao = "medium",
    tarefaId?: string,
    rotinaId?: string,
  ): Promise<ComunicacaoRobo | null> {
    if (!origemId || !destinoId) return null;

    if (contexto.entidade_tipo && contexto.entidade_id) {
      try {
        const completo = await memoriaService.montarContextoCompleto({
          roboId: origemId,
          entidadeTipo: contexto.entidade_tipo as "cliente" | "lead" | "motorista" | "prestador" | "fornecedor" | "colaborador" | "robo" | "projeto" | "contrato" | "outro",
          entidadeId: contexto.entidade_id as string,
          consulta: assunto,
        });
        if (completo.texto_contexto) {
          contexto.contexto_memoria = completo.texto_contexto;
        }
        void centralIaService.registrarLog({
          robo_id: origemId,
          acao: "memoria_consultada",
          entrada: { entidade_tipo: contexto.entidade_tipo, entidade_id: contexto.entidade_id, motivo: "enviar_comunicacao" },
          saida: { contexto_length: completo.texto_contexto.length, preferencias: completo.preferencias.length },
          status: "info",
        });
      } catch { /* memoria indisponivel */ }
    }

    const { data, error } = await supabase.from("ia_comunicacoes_robos").insert({
      origem_robo_id: origemId,
      destino_robo_id: destinoId,
      tipo,
      assunto,
      mensagem,
      contexto,
      prioridade,
      status: "pendente",
      tarefa_id: tarefaId || null,
      rotina_id: rotinaId || null,
    }).select().single();

    if (error || !data) return null;

    await supabase.from("ia_comunicacoes_fila_robos").insert({
      robo_id: destinoId,
      tipo_evento: `comunicacao_${tipo}`,
      payload: { comunicacao_id: data.id, origem_id: origemId, tipo, assunto },
    });

    const [comCarregada] = await carregarNomesRobos([data as ComunicacaoRobo]);
    return comCarregada || null;
  },

  async solicitarTarefa(
    roboOrigemId: string,
    roboDestinoId: string,
    assunto: string,
    contexto: Record<string, unknown> = {},
  ): Promise<ComunicacaoRobo | null> {
    return this.enviarMensagem(
      roboOrigemId, roboDestinoId, "solicitacao", assunto,
      `Solicitação de tarefa: ${assunto}`,
      { ...contexto, tipo_solicitacao: "tarefa" }, "medium",
    );
  },

  async delegarTarefa(
    roboOrigemId: string,
    roboDestinoId: string,
    assunto: string,
    tarefaId: string,
    contexto: Record<string, unknown> = {},
  ): Promise<ComunicacaoRobo | null> {
    return this.enviarMensagem(
      roboOrigemId, roboDestinoId, "delegacao", assunto,
      `Delegação de tarefa: ${assunto}`,
      { ...contexto, tarefa_id: tarefaId }, "high", tarefaId,
    );
  },

  async responderMensagem(
    comunicacaoId: string,
    respostaTexto: string,
    roboRespostaId: string,
    novoStatus: StatusComunicacao = "respondido",
  ): Promise<boolean> {
    const { error } = await supabase.from("ia_comunicacoes_robos").update({
      resposta_texto: respostaTexto,
      resposta_robo_id: roboRespostaId,
      status: novoStatus,
    }).eq("id", comunicacaoId);

    if (error) return false;

    const { data: original } = await supabase
      .from("ia_comunicacoes_robos").select("origem_robo_id")
      .eq("id", comunicacaoId).single();

    if (original) {
      await supabase.from("ia_comunicacoes_fila_robos").insert({
        robo_id: original.origem_robo_id,
        tipo_evento: "comunicacao_resposta",
        payload: { comunicacao_id: comunicacaoId, resposta: respostaTexto },
      });
    }

    return true;
  },

  async escalarParaDiretorVirtual(
    roboOrigemId: string,
    assunto: string,
    mensagem: string,
    contexto: Record<string, unknown> = {},
  ): Promise<ComunicacaoRobo | null> {
    const { data: diretorConfig } = await supabase
      .from("diretor_virtual_ia").select("id").limit(1).single();

    let destinoId = "";
    if (diretorConfig) {
      const { data: roboDiretor } = await supabase
        .from("automacoes_robos").select("id")
        .ilike("nome", "%diretor%").limit(1).maybeSingle();
      if (roboDiretor) destinoId = roboDiretor.id;
    }

    if (!destinoId) {
      const { data: anyRobo } = await supabase
        .from("automacoes_robos").select("id").limit(1).single();
      if (anyRobo) destinoId = anyRobo.id;
    }

    if (!destinoId) return null;

    const comunicacao = await this.enviarMensagem(
      roboOrigemId, destinoId, "escalonamento", assunto, mensagem,
      { ...contexto, escalonamento_automatico: true }, "critical",
    );

    if (comunicacao) {
      await diretorVirtualService.registrarDecisao({
        origem: "comunicacao_robos",
        robo_id: roboOrigemId,
        tipo: "risco",
        descricao: `[Escalonamento] Robô ${roboOrigemId.substring(0, 8)} escalou: ${assunto}`,
        impacto: "high",
        acao: "escalar",
        detalhes: { comunicacao_id: comunicacao.id, assunto, mensagem, contexto },
      });
    }

    return comunicacao;
  },

  async processarFilaComunicacao(): Promise<{ processados: number; erros: number }> {
    const resultado = { processados: 0, erros: 0 };

    const { data: pendentes } = await supabase
      .from("ia_comunicacoes_fila_robos")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);

    if (!pendentes || pendentes.length === 0) return resultado;

    for (const item of pendentes as FilaComunicacao[]) {
      try {
        const payload = item.payload as Record<string, unknown>;
        const comunicacaoId = payload.comunicacao_id as string;

        if (comunicacaoId) {
          await supabase.from("ia_comunicacoes_robos").update({
            status: "enviado",
          }).eq("id", comunicacaoId).eq("status", "pendente");
        }

        await supabase.from("ia_comunicacoes_fila_robos").update({
          status: "processed",
        }).eq("id", item.id);

        resultado.processados++;
      } catch {
        await supabase.from("ia_comunicacoes_fila_robos").update({
          status: "failed",
        }).eq("id", item.id);
        resultado.erros++;
      }
    }

    return resultado;
  },

  async listarMensagens(limite = 50): Promise<ComunicacaoRobo[]> {
    const { data } = await supabase
      .from("ia_comunicacoes_robos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (!data) return [];
    return carregarNomesRobos(data as ComunicacaoRobo[]);
  },

  async listarMensagensPorRobo(roboId: string, limite = 20): Promise<ComunicacaoRobo[]> {
    const { data } = await supabase
      .from("ia_comunicacoes_robos")
      .select("*")
      .or(`origem_robo_id.eq.${roboId},destino_robo_id.eq.${roboId}`)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (!data) return [];
    return carregarNomesRobos(data as ComunicacaoRobo[]);
  },

  async listarFilaPendente(): Promise<FilaComunicacao[]> {
    const { data } = await supabase
      .from("ia_comunicacoes_fila_robos")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);
    return (data || []) as FilaComunicacao[];
  },

  async obterEstatisticas(): Promise<{
    total: number;
    pendentes: number;
    enviados: number;
    respondidos: number;
    concluidos: number;
    erros: number;
    solicitacoes: number;
    delegacoes: number;
    escalonamentos: number;
  }> {
    const { data: todas } = await supabase
      .from("ia_comunicacoes_robos")
      .select("status, tipo");
    const msgs = (todas || []) as { status: string; tipo: string }[];

    return {
      total: msgs.length,
      pendentes: msgs.filter((m) => m.status === "pendente" || m.status === "enviado").length,
      enviados: msgs.filter((m) => m.status === "enviado").length,
      respondidos: msgs.filter((m) => m.status === "respondido").length,
      concluidos: msgs.filter((m) => m.status === "concluido").length,
      erros: msgs.filter((m) => m.status === "erro").length,
      solicitacoes: msgs.filter((m) => m.tipo === "solicitacao").length,
      delegacoes: msgs.filter((m) => m.tipo === "delegacao").length,
      escalonamentos: msgs.filter((m) => m.tipo === "escalonamento").length,
    };
  },
};

export default comunicacaoEntreRobosService;
