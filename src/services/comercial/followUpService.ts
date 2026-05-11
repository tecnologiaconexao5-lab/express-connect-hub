/**
 * Serviço de Follow-up Comercial
 */
import { enviarMensagem, notificarOSCriada } from "../integracoes/whatsappService";
import { zohoEmailService } from "../integracoes/zohoEmailService";
import { triggerN8nWorkflow } from "../integracoes/n8nService";
import { registrarLog } from "../integracoes/integrationLogger";

export const followUpService = {
  agendarFollowUp: async (leadId: string, tipo: "D+1" | "D+3" | "D+7") => {
    const startTime = Date.now();
    console.log(`[FOLLOW-UP] Agendando lembrete ${tipo} para o lead ${leadId}`);

    try {
      await triggerN8nWorkflow({
        evento: 'followup_agendado',
        lead_id: leadId,
        tipo: tipo,
        agendado_para: new Date().toISOString()
      });

      await registrarLog({
        tipo: 'n8n',
        acao: 'agendar_followup',
        status: 'sucesso',
        mensagem: `Follow-up ${tipo} agendado para lead ${leadId}`,
        payload: { leadId, tipo },
        duracaoMs: Date.now() - startTime
      });

      return { success: true, agendadoPara: new Date() };
    } catch (e: any) {
      await registrarLog({
        tipo: 'n8n',
        acao: 'agendar_followup',
        status: 'erro',
        mensagem: e.message || 'Erro ao agendar follow-up',
        payload: { leadId, tipo },
        erro: e,
        duracaoMs: Date.now() - startTime
      });
      return { success: false, error: e.message };
    }
  },

  executarFollowUpAutomatico: async (lead: any, diasPassados: number) => {
    const startTime = Date.now();
    console.log(`[FOLLOW-UP] Executando follow-up ${diasPassados} dias para ${lead.nome}`);

    try {
      if (diasPassados === 1) {
        await enviarMensagem(
          lead.telefone,
          `Olá ${lead.nome}, conseguiu analisar a proposta enviada ontem? Qualquer dúvida estou à disposição!`
        );

        await triggerN8nWorkflow({
          evento: 'followup_executado',
          lead_id: lead.id,
          tipo: 'D+1',
          telefone: lead.telefone
        });

        await registrarLog({
          tipo: 'whatsapp',
          acao: 'followup_d1',
          status: 'sucesso',
          mensagem: `Follow-up D+1 enviado para ${lead.nome}`,
          payload: { leadId: lead.id, telefone: lead.telefone },
          duracaoMs: Date.now() - startTime
        });
        return "Enviado lembrete D+1 (WhatsApp)";
      }

      if (diasPassados === 3) {
        await zohoEmailService.enviarPropostaEmail(
          lead.email,
          lead.nome,
          { valor: lead.valor_potencial, obs: "Reforço D+3" }
        );

        await triggerN8nWorkflow({
          evento: 'followup_executado',
          lead_id: lead.id,
          tipo: 'D+3',
          email: lead.email
        });

        await registrarLog({
          tipo: 'n8n',
          acao: 'followup_d3',
          status: 'sucesso',
          mensagem: `Follow-up D+3 enviado para ${lead.nome}`,
          payload: { leadId: lead.id, email: lead.email },
          duracaoMs: Date.now() - startTime
        });
        return "Enviado reforço D+3 (Email)";
      }

if (diasPassados === 7) {
        await enviarMensagem(
          lead.telefone,
          `Oi ${lead.nome}. Como não tuvimos retorno, estamos encerrando essa cotação. Pode nos chamar quando precisar! 👋`
        );

        await triggerN8nWorkflow({
          evento: 'followup_executado',
          lead_id: lead.id,
          tipo: 'D+7',
          telefone: lead.telefone
        });

        await registrarLog({
          tipo: 'whatsapp',
          acao: 'followup_d7',
          status: 'sucesso',
          mensagem: `Follow-up D+7 enviado para ${lead.nome}`,
          payload: { leadId: lead.id, telefone: lead.telefone },
          duracaoMs: Date.now() - startTime
        });
        return "Enviado fechamento D+7 (WhatsApp)";
      }

      return "Nenhuma ação automática aplicável hoje.";
    } catch (e: any) {
      await registrarLog({
        tipo: 'n8n',
        acao: 'followup_executar',
        status: 'erro',
        mensagem: e.message || 'Erro ao executar follow-up',
        payload: { leadId: lead.id, diasPassados },
        erro: e,
        duracaoMs: Date.now() - startTime
      });
      return "Erro ao executar follow-up: " + e.message;
    }
  }
};
