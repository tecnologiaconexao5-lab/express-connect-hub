import { gerarMensagemComercial, gerarResumoOperacional, sugerirValorFrete } from "../integracoes/iaService";
import { zohoEmailService } from "../integracoes/zohoEmailService";
import { enviarMensagem as WhatsAppEnviar, notificarOSCriada } from "../integracoes/whatsappService";
import { triggerN8nWorkflowCotacao } from "../integracoes/n8nService";
import { registrarLog } from "../integracoes/integrationLogger";
import type { SupabaseClient } from "@supabase/supabase-js";

// Helper para obter o cliente Supabase (frontend ou Node.js)
async function getSupabaseClient(sb?: SupabaseClient): Promise<SupabaseClient> {
  if (sb) return sb;
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export const propostaService = {
  gerarPropostaAutomatica: async (
    lead: any,
    origem: string,
    destino: string,
    tipoVeiculo: string,
    sb?: SupabaseClient
  ) => {
    const startTime = Date.now();
    console.log(`[PROPOSTA AUTOMÁTICA] Gerando para Lead ${lead.nome}`);

    try {
      const estimativa = await sugerirValorFrete(origem, destino, tipoVeiculo);

      const propostaCriada = {
        id: "PROP-" + Math.floor(Math.random() * 10000),
        valorSugerido: estimativa.valorSugerido,
        veiculo: tipoVeiculo,
        rota: `${origem} -> ${destino}`
      };

      if (lead.email) {
        await zohoEmailService.enviarPropostaEmail(lead.email, lead.nome, {
          valor: estimativa.valorSugerido
        });
      }

      if (lead.telefone) {
        const msg = `Olá ${lead.nome}! Sua cotação de ${origem} para ${destino} ficou em R$ ${estimativa.valorSugerido.toFixed(2)}. Posso aprovar para gerar a OS?`;
        await WhatsAppEnviar(lead.telefone, msg);
      }

      await triggerN8nWorkflowCotacao({
        id: lead.id,
        cliente: lead.nome,
        origem,
        destino,
        tipoVeiculo,
        valorEstimado: estimativa.valorSugerido
      });

      await registrarLog({
        tipo: 'n8n',
        acao: 'trigger_cotacao',
        status: 'sucesso',
        mensagem: `Cotação gerada para lead ${lead.nome}`,
        payload: { lead: lead.nome, origem, destino, tipoVeiculo },
        duracaoMs: Date.now() - startTime
      });

      return propostaCriada;
    } catch (e: any) {
      await registrarLog({
        tipo: 'n8n',
        acao: 'trigger_cotacao',
        status: 'erro',
        mensagem: e.message || 'Erro ao gerar proposta',
        payload: { lead: lead.nome, origem, destino },
        erro: e,
        duracaoMs: Date.now() - startTime
      });
      throw e;
    }
  },

  converterEmOS: async (propostaId: string, lead: any, sb?: SupabaseClient) => {
    console.log(`[CONVERSÃO] Gerando OS a partir da Proposta ${propostaId}`);
    
    const client = await getSupabaseClient(sb);
    
    // Inserção real em ordens_servico
    const novaOsNumero = "OS-" + Math.floor(Math.random() * 90000 + 10000);
    const { data: osData, error: osError } = await client.from("ordens_servico").insert([{
      numero: novaOsNumero,
      status: "em_analise",
      valor_cliente: 0 // Será atualizado futuramente
    }]).select("id").single();

    if (osError) {
      console.error("Erro ao criar OS", osError);
      throw osError;
    }

    const novaOSId = osData.id;

    // Atualização real no CRM Leads
    const { error: leadError } = await client.from("crm_leads").update({
      status: "fechado",
      convertido_os_id: novaOSId
    }).eq("id", lead.id);

    if (leadError) {
      console.error("Erro ao atualizar lead", leadError);
      throw leadError;
    }

    if (lead.telefone) {
      await notificarOSCriada(lead.telefone, novaOsNumero);
    }

    if (lead.email) {
      await zohoEmailService.enviarConfirmacaoOS(lead.email, novaOsNumero);
    }

    return { success: true, numeroOS: novaOsNumero, osId: novaOSId };
  }
};
