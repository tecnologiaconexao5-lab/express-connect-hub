import { supabase } from "@/lib/supabase";

export interface RegraAutomacao {
  id: string;
  nome: string;
  descricao: string;
  modulo: string;
  evento_trigger: string;
  canal: string;
  ativa: boolean;
  prioridade: string;
  condicoes: any;
  acoes: any;
}

export const buscarRegrasAtivas = async (evento?: string): Promise<RegraAutomacao[]> => {
  try {
    let query = supabase.from("automacoes_regras").select("*").eq("ativa", true);
    if (evento) {
      query = query.eq("evento_trigger", evento);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as RegraAutomacao[];
  } catch (err) {
    console.error("Erro ao buscar regras ativas:", err);
    return [];
  }
};

export const registrarExecucao = async (regraId: string, modulo: string, evento: string, payload: any, status: string, resultado?: any, erroStr?: string) => {
  try {
    const { data, error } = await supabase.from("automacoes_execucoes").insert([{
      regra_id: regraId,
      status,
      modulo,
      evento,
      payload,
      resultado,
      erro: erroStr,
      iniciado_em: new Date().toISOString(),
      finalizado_em: status !== 'processando' ? new Date().toISOString() : null
    }]).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Erro ao registrar execução:", err);
  }
};

export const registrarErro = async (execucaoId: string, erroStr: string) => {
  try {
    await supabase.from("automacoes_execucoes").update({
      status: 'erro',
      erro: erroStr,
      finalizado_em: new Date().toISOString()
    }).eq("id", execucaoId);
  } catch (err) {
    console.error("Erro ao registrar erro:", err);
  }
};

export const adicionarNaFila = async (
  regraId: string | null,
  tipo: string,
  canal: string,
  destino: string,
  mensagem: string,
  assunto?: string,
  payload?: any
) => {
  try {
    const { error } = await supabase.from("automacoes_fila").insert([{
      regra_id: regraId,
      tipo,
      canal,
      destino,
      assunto,
      mensagem,
      payload: payload || {},
      status: 'pendente'
    }]);
    if (error) throw error;
  } catch (err) {
    console.error("Erro ao adicionar na fila:", err);
  }
};

export const processarFila = async () => {
  try {
    const { data: fila, error } = await supabase.from("automacoes_fila")
      .select("*")
      .eq("status", "pendente")
      .lte("agendado_para", new Date().toISOString())
      .limit(10);
    
    if (error) throw error;

    for (const item of fila || []) {
      await supabase.from("automacoes_fila").update({ status: 'processando' }).eq("id", item.id);
      
      try {
        // Mock processing based on canal
        console.log(`Processando fila [${item.canal}] para ${item.destino}...`);
        
        // Simulação de envio com sucesso
        await supabase.from("automacoes_fila").update({ 
          status: 'enviado',
          processado_em: new Date().toISOString()
        }).eq("id", item.id);

      } catch (err: any) {
        await supabase.from("automacoes_fila").update({ 
          status: item.tentativas >= item.max_tentativas - 1 ? 'erro' : 'pendente',
          tentativas: item.tentativas + 1,
          erro: err.message
        }).eq("id", item.id);
      }
    }
  } catch (err) {
    console.error("Erro ao processar fila:", err);
  }
};

export const criarLogIntegracao = async (origem: string, evento: string, payload: any, status: string, erro?: string) => {
  try {
    await supabase.from("webhooks_recebidos").insert([{
      origem,
      evento,
      payload,
      status,
      erro,
      processado: status === 'sucesso'
    }]);
  } catch (err) {
    console.error("Erro ao criar log webhook:", err);
  }
};

export const executarRegra = async (regra: RegraAutomacao, payload: any) => {
  let execucao;
  try {
    execucao = await registrarExecucao(regra.id, regra.modulo, regra.evento_trigger, payload, 'processando');
    
    // Motor lógico baseado em condicoes e acoes JSONB
    console.log(`Executando regra: ${regra.nome} para o canal ${regra.canal}`);

    if (regra.canal === 'whatsapp' || regra.canal === 'email') {
      await adicionarNaFila(regra.id, 'notificacao', regra.canal, payload.destino || 'desconhecido', payload.mensagem || 'Mensagem gerada', payload.assunto, payload);
    }

    if (execucao) {
      await supabase.from("automacoes_execucoes").update({
        status: 'concluido',
        resultado: { success: true, via: regra.canal },
        finalizado_em: new Date().toISOString()
      }).eq("id", execucao.id);
    }
  } catch (err: any) {
    if (execucao) {
      await registrarErro(execucao.id, err.message);
    }
  }
};

export default {
  buscarRegrasAtivas,
  registrarExecucao,
  registrarErro,
  adicionarNaFila,
  processarFila,
  criarLogIntegracao,
  executarRegra
};
