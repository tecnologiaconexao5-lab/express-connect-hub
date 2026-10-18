import { supabase } from "@/lib/supabase";
import { resolverMidiasPod } from "@/services/comprovantes/podMediaService";
// M104: Eventos publicados automaticamente por SQL triggers no banco
// import { publicarEvento } from "@/services/eventBus/eventBusService";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export interface PODData {
  nome_recebedor: string;
  documento_recebedor?: string;
  observacao?: string;
  foto_entrega_url?: string;
  foto_canhoto_url?: string;
  assinatura_url?: string;
  data_hora_entrega: string;
  latitude?: number;
  longitude?: number;
  status: string;
}

export interface PODResult {
  sucesso: boolean;
  erro?: string;
  data?: PODData;
  alocacao_id?: string;
}

export async function uploadFotoPOD(
  file: File,
  prefix: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${prefix}/${genId()}.${ext}`;
    const { error } = await supabase.storage
      .from("comprovantes-entrega")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });
    if (error) {
      console.error("[POD] Erro upload:", error.message);
      return null;
    }
    const { data: urlData } = supabase.storage
      .from("comprovantes-entrega")
      .getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error("[POD] Exceção upload:", err);
    return null;
  }
}

const STATUS_FINALIZAVEIS = ['aceita', 'em_rota', 'ocorrencia'];

export async function finalizarComPOD(
  alocacaoId: string,
  prestadorId: string,
  podData: PODData,
  kmFinal: number
): Promise<PODResult> {
  try {
    const { data: alocAtual } = await supabase
      .from("alocacoes_escala")
      .select("status")
      .eq("id", alocacaoId)
      .maybeSingle();

    if (!alocAtual) {
      return { sucesso: false, erro: "Alocação não encontrada." };
    }

    if (!STATUS_FINALIZAVEIS.includes(alocAtual.status)) {
      return { sucesso: false, erro: `Alocação em status "${alocAtual.status}" não pode ser finalizada. Permitidos: ${STATUS_FINALIZAVEIS.join(', ')}.` };
    }

    const metadataUpdate: Record<string, any> = {
      pod: podData,
      km_final: kmFinal,
    };

    const { error: updateError } = await supabase
      .from("alocacoes_escala")
      .update({
        status: "concluida",
        finalizada: true,
        data_finalizacao: new Date().toISOString(),
        horario_fim_real: new Date().toISOString(),
        km_realizados: kmFinal,
        comprovante_url: podData.foto_canhoto_url || podData.foto_entrega_url || null,
        metadata: metadataUpdate,
        observacoes: podData.observacao || null,
        updated_by: prestadorId,
      })
      .eq("id", alocacaoId);

    if (updateError) {
      console.error("[POD] Erro finalizar:", updateError.message);
      return { sucesso: false, erro: updateError.message };
    }

    const { data: podExistente } = await supabase
      .from("entregas_protocolo")
      .select("id")
      .eq("alocacao_id", alocacaoId)
      .maybeSingle();

    if (podExistente) {
      const { error: updateError } = await supabase
        .from("entregas_protocolo")
        .update({
          prestador_id: prestadorId,
          nome_recebedor: podData.nome_recebedor,
          documento_recebedor: podData.documento_recebedor || null,
          observacao: podData.observacao || null,
          foto_entrega_url: podData.foto_entrega_url || null,
          foto_canhoto_url: podData.foto_canhoto_url || null,
          assinatura_url: podData.assinatura_url || null,
          data_hora_entrega: podData.data_hora_entrega,
          latitude: podData.latitude || null,
          longitude: podData.longitude || null,
          status: podData.status || "entregue",
        })
        .eq("id", podExistente.id);
      if (updateError) {
        console.warn("[POD] Erro ao atualizar entregas_protocolo:", updateError.message);
      }
    } else {
      // Idempotência: SELECT-check antes de INSERT
      const { data: existente } = await supabase
        .from("entregas_protocolo")
        .select("id")
        .eq("alocacao_id", alocacaoId)
        .maybeSingle();

      if (!existente) {
        const { error: insertError } = await supabase
          .from("entregas_protocolo")
          .insert({
            alocacao_id: alocacaoId,
            prestador_id: prestadorId,
            nome_recebedor: podData.nome_recebedor,
            documento_recebedor: podData.documento_recebedor || null,
            observacao: podData.observacao || null,
            foto_entrega_url: podData.foto_entrega_url || null,
            foto_canhoto_url: podData.foto_canhoto_url || null,
            assinatura_url: podData.assinatura_url || null,
            data_hora_entrega: podData.data_hora_entrega,
            latitude: podData.latitude || null,
            longitude: podData.longitude || null,
            status: podData.status || "entregue",
          });

        if (insertError) {
          // Pode ser duplicata de corrida com trigger — tratar como sucesso
          if (insertError.message?.includes("duplicate") || insertError.message?.includes("violates unique")) {
            console.warn("[POD] Duplicata ignorada (corrida trigger/TMS):", alocacaoId);
          } else {
            console.warn("[POD] Erro ao inserir entregas_protocolo:", insertError.message);
          }
        }
      } else {
        console.warn("[POD] POD ja existe para alocacao:", alocacaoId);
      }
    }

    // M104: Evento escala.alocacao.concluida publicado pelo trigger SQL trg_evento_operacao_finalizada

    return {
      sucesso: true,
      data: podData,
      alocacao_id: alocacaoId,
    };
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    console.error("[POD] Exceção finalizar:", msg);
    return { sucesso: false, erro: msg };
  }
}

export async function buscarPOD(alocacaoId: string): Promise<PODData | null> {
  try {
    const { data, error } = await supabase
      .from("alocacoes_escala")
      .select("metadata, comprovante_url, observacoes, km_realizados")
      .eq("id", alocacaoId)
      .single();

    if (error || !data) {
      console.error("[POD] Erro buscar:", error?.message);
      return null;
    }

    const meta = (data as any).metadata || {};
    const podMeta = meta.pod as PODData | undefined;

    // APP-E2E-11D — resolve mídia privada (driver-evidence) em signed URL.
    // Fonte única: podMediaService. Consumidores (Torre/usePod) recebem POD pronto.
    if (podMeta) return resolverMidiasPod(podMeta);

    const { data: protocolo } = await supabase
      .from("entregas_protocolo")
      .select("*")
      .eq("alocacao_id", alocacaoId)
      .maybeSingle();

    if (protocolo) {
      return resolverMidiasPod({
        nome_recebedor: (protocolo as any).nome_recebedor || "",
        documento_recebedor: (protocolo as any).documento_recebedor || undefined,
        observacao: (protocolo as any).observacao || undefined,
        foto_entrega_url: (protocolo as any).foto_entrega_url || undefined,
        foto_canhoto_url: (protocolo as any).foto_canhoto_url || undefined,
        assinatura_url: (protocolo as any).assinatura_url || undefined,
        data_hora_entrega: (protocolo as any).data_hora_entrega || "",
        status: (protocolo as any).status || "entregue",
      });
    }

    return null;
  } catch (err) {
    console.error("[POD] Exceção buscar:", err);
    return null;
  }
}
