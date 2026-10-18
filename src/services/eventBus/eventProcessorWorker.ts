import { supabase } from "@/lib/supabase";
import type { EventoOficial } from "@/types/events";

type WorkerEstado = "parado" | "rodando" | "erro";

interface WorkerStatus {
  estado: WorkerEstado;
  ultimoCiclo: string | null;
  processados: number;
  erros: number;
}

let workerInterval: ReturnType<typeof setInterval> | null = null;
let estado: WorkerEstado = "parado";
let ultimoCiclo: string | null = null;
let processados = 0;
let erros = 0;
let processandoAgora = false;
let errosConsecutivos = 0;
const listeners: Array<(status: WorkerStatus) => void> = [];

let ultimoScanDocumentos: string | null = null;
const SCAN_DOCUMENTOS_INTERVALO_MS = 5 * 60 * 1000;

function notificar() {
  const status: WorkerStatus = { estado, ultimoCiclo, processados, erros };
  for (const fn of listeners) fn(status);
}

export const eventProcessorWorker = {
  iniciar(intervaloMs = 10000) {
    if (workerInterval) return;
    estado = "rodando";
    errosConsecutivos = 0;
    workerInterval = setInterval(cicloProcessamento, intervaloMs);
    notificar();
    cicloProcessamento();
  },

  parar() {
    if (workerInterval) {
      clearInterval(workerInterval);
      workerInterval = null;
    }
    estado = "parado";
    notificar();
  },

  getStatus(): WorkerStatus {
    return { estado, ultimoCiclo, processados, erros };
  },

  forcarCiclo() {
    if (!processandoAgora) cicloProcessamento();
  },

  forcarScanDocumentos() {
    ultimoScanDocumentos = null;
    if (!processandoAgora) cicloProcessamento();
  },
};

export function onEventProcessorStatusChange(fn: (status: WorkerStatus) => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

async function cicloProcessamento() {
  if (processandoAgora) return;
  processandoAgora = true;

  try {
    const { data: eventos } = await supabase
      .from("eventos_oficiais")
      .select("*")
      .is("processed_at", null)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(20);

    if (eventos && eventos.length > 0) {
      for (const evento of eventos as EventoOficial[]) {
        try {
          await processarEvento(evento);
          processados++;
        } catch (err) {
          erros++;
          console.error(`[EventProcessor] Erro processando evento ${evento.id}:`, err);
        }
      }
    }

    await executarScanDocumentos();

    errosConsecutivos = 0;
  } catch (err) {
    errosConsecutivos++;
    erros++;
    if (errosConsecutivos >= 5) {
      estado = "erro";
    }
    console.error("[EventProcessor] Erro no ciclo:", err);
  } finally {
    ultimoCiclo = new Date().toISOString();
    processandoAgora = false;
    notificar();
  }
}

async function processarEvento(evento: EventoOficial): Promise<void> {
  const { event_type, entity_id, payload, id } = evento;

  switch (event_type) {
    case "os.ordem_servico.criada": {
      // Ações pós-criação de OS:
      // 1. Notificar operador (via escalonamentos_humanos já feito no trigger SQL)
      // 2. Se tiver prestador definido, verificar se precisa criar escala
      break;
    }

    case "os.ordem_servico.finalizada": {
      // Ações pós-finalização:
      // 1. Financeiro já propagado pelo trigger M80
      // 2. Verificar se precisa gerar nota fiscal
      break;
    }

    case "os.ordem_servico.cancelada": {
      // Ações pós-cancelamento:
      // 1. Verificar se precisa estornar financeiro
      break;
    }

    case "escala.alocacao.aceita": {
      // Ações após aceite do motorista:
      // 1. Notificar cliente (via portal_notificacoes já feito no trigger SQL)
      // 2. Atualizar status da OS vinculada
      if (payload?.os_id) {
        await supabase
          .from("ordens_servico")
          .update({ status: "em_andamento" })
          .eq("id", payload.os_id);
      }
      break;
    }

    case "escala.alocacao.concluida": {
      // Ações após conclusão:
      // 1. Financeiro já propagado pelo trigger M66
      // 2. Atualizar dashboard
      break;
    }

    case "escala.alocacao.recusada": {
      // Se prestador recusou, notificar operador e buscar novo prestador
      if (payload?.os_id) {
        await supabase
          .from("ordens_servico")
          .update({ status: "pendente" })
          .eq("id", payload.os_id);
      }
      break;
    }

    case "entrega.comprovante.pod_enviado": {
      // Ações após POD:
      // 1. Notificar cliente (já feito no trigger SQL)
      break;
    }

    case "portal.pedido.criado": {
      // Ações após pedido no portal:
      // 1. Notificar operador (já feito no trigger SQL)
      break;
    }

    case "portal.ocorrencia.aberta": {
      // Sincroniza alocação vinculada (se houver os_id no payload)
      const osId = payload?.os_id || entity_id;
      if (osId) {
        await supabase
          .from("alocacoes_escala")
          .update({
            status: "ocorrencia",
            ocorrencias_descricao: payload?.descricao || "",
            updated_at: new Date().toISOString(),
          })
          .eq("ordem_servico_id", osId)
          .not("status", "in", '("concluida","cancelada")');
      }
      break;
    }

    case "recrutamento.candidato.criado": {
      const automacaoId = payload?.automacao_id;
      const nomeCandidato = payload?.nome || "Sem nome";

      await supabase.from("automacoes_logs").insert({
        acao: "novo_candidato_detectado",
        entrada: {
          candidato_id: entity_id,
          nome: nomeCandidato,
          stage: payload?.stage,
          score: payload?.score,
          telefone: payload?.telefone,
          cidade: payload?.cidade,
        },
        saida: { evento_id: id, status: "processado" },
        status: "sucesso",
      });

      if (automacaoId) {
        const { data: auto } = await supabase
          .from("recrutamento_automacoes")
          .select("total_execucoes")
          .eq("id", automacaoId)
          .maybeSingle();

        if (auto) {
          await supabase
            .from("recrutamento_automacoes")
            .update({
              ultima_execucao: new Date().toISOString(),
              total_execucoes: (auto.total_execucoes || 0) + 1,
            })
            .eq("id", automacaoId);
        }
      }
      break;
    }

    case "recrutamento.score.limiar_cruzado": {
      const automacaoIdScore = payload?.automacao_id;
      const scoreAnterior = payload?.score_anterior;
      const scoreNovo = payload?.score_novo;
      const limiar = payload?.limiar_configurado;

      await supabase.from("automacoes_logs").insert({
        acao: "score_limiar_detectado",
        entrada: {
          candidato_id: entity_id,
          nome: payload?.nome,
          score_anterior: scoreAnterior,
          score_novo: scoreNovo,
          limiar_configurado: limiar,
          classificacao: payload?.classificacao,
        },
        saida: { evento_id: id, status: "processado" },
        status: "sucesso",
      });

      if (automacaoIdScore) {
        const { data: autoScore } = await supabase
          .from("recrutamento_automacoes")
          .select("total_execucoes")
          .eq("id", automacaoIdScore)
          .maybeSingle();

        if (autoScore) {
          await supabase
            .from("recrutamento_automacoes")
            .update({
              ultima_execucao: new Date().toISOString(),
              total_execucoes: (autoScore.total_execucoes || 0) + 1,
            })
            .eq("id", automacaoIdScore);
        }
      }
      break;
    }

    case "recrutamento.documento.vencimento_proximo": {
      const automacaoIdDoc = payload?.automacao_id;
      const jaVencido = payload?.ja_vencido;
      const diasParaVencer = payload?.dias_para_vencer;

      await supabase.from("automacoes_logs").insert({
        acao: "documento_vencimento_alerta",
        entrada: {
          candidato_id: entity_id,
          nome_candidato: payload?.nome_candidato,
          tipo_documento: payload?.tipo_documento,
          validade: payload?.validade,
          dias_para_vencer: diasParaVencer,
          ja_vencido: jaVencido,
        },
        saida: {
          evento_id: id,
          status: "processado",
          prioridade: jaVencido ? "critica" : "alta",
        },
        status: jaVencido ? "aviso" : "sucesso",
      });

      if (automacaoIdDoc) {
        const { data: autoDoc } = await supabase
          .from("recrutamento_automacoes")
          .select("total_execucoes")
          .eq("id", automacaoIdDoc)
          .maybeSingle();

        if (autoDoc) {
          await supabase
            .from("recrutamento_automacoes")
            .update({
              ultima_execucao: new Date().toISOString(),
              total_execucoes: (autoDoc.total_execucoes || 0) + 1,
            })
            .eq("id", automacaoIdDoc);
        }
      }
      break;
    }

    default:
      break;
  }

  // Marca como processado
  await supabase
    .from("eventos_oficiais")
    .update({
      processed_at: new Date().toISOString(),
      metadata: {
        ...((evento.metadata as Record<string, any>) || {}),
        processed_by: "eventProcessorWorker",
        processed_at: new Date().toISOString(),
      },
    })
    .eq("id", id);
}

async function executarScanDocumentos(): Promise<void> {
  const agora = Date.now();
  if (
    ultimoScanDocumentos &&
    agora - new Date(ultimoScanDocumentos).getTime() < SCAN_DOCUMENTOS_INTERVALO_MS
  ) {
    return;
  }

  try {
    const { data: automacao } = await supabase
      .from("recrutamento_automacoes")
      .select("id")
      .eq("tipo", "validade_documento")
      .eq("status", "ativa")
      .limit(1)
      .maybeSingle();

    if (!automacao) return;

    const { data: candidatos } = await supabase
      .from("recrutamento_candidatos")
      .select("id, nome, documentos")
      .not("documentos", "is", null);

    if (!candidatos || candidatos.length === 0) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let scanExecutadas = 0;

    for (const candidato of candidatos) {
      const docs = Array.isArray(candidato.documentos) ? candidato.documentos : [];
      for (const doc of docs) {
        if (!doc.dataValidade) continue;

        let validade: Date;
        try {
          validade = new Date(doc.dataValidade);
          validade.setHours(0, 0, 0, 0);
        } catch {
          continue;
        }

        const diasParaVencer = Math.ceil(
          (validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diasParaVencer > 30 || diasParaVencer < -365) continue;

        const jaVencido = diasParaVencer < 0;

        const { data: existente } = await supabase
          .from("eventos_oficiais")
          .select("id")
          .eq("event_type", "recrutamento.documento.vencimento_proximo")
          .eq("entity_id", candidato.id)
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          )
          .limit(1)
          .maybeSingle();

        if (existente) continue;

        await supabase.from("eventos_oficiais").insert({
          event_type: "recrutamento.documento.vencimento_proximo",
          entity_type: "recrutamento_candidatos",
          entity_id: candidato.id,
          source: "scheduler",
          visibility: "internal",
          payload: {
            candidato_id: candidato.id,
            nome_candidato: candidato.nome,
            tipo_documento: doc.nome,
            validade: doc.dataValidade,
            dias_para_vencer: diasParaVencer,
            status_documento: doc.status,
            ja_vencido: jaVencido,
            automacao_id: automacao.id,
            fonte: "scan_periodico",
          },
        });

        scanExecutadas++;
      }
    }

    ultimoScanDocumentos = new Date().toISOString();
  } catch (err) {
    console.error("[EventProcessor] Erro no scan de documentos:", err);
  }
}
