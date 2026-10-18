import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { proxyIaClient } from "@/services/ia/proxyIaClient";
import type { AbordagemGerada, EstrategiaHunter, IaConfigHunter } from "./types";

export const comercialFollowUpService = {
  async gerarAbordagem(
    dados: {
      empresa: string;
      responsavel_nome?: string;
      segmento: string;
      cidade: string;
      estado: string;
      necessidade_provavel?: string;
    },
    canaisConfig: { gerar_whatsapp: boolean; gerar_email: boolean; gerar_script_ligacao: boolean },
    estrategia?: EstrategiaHunter,
    iaConfig?: IaConfigHunter
  ): Promise<AbordagemGerada> {
    const resultado: AbordagemGerada = {};
    const tomVoz = estrategia?.tom_voz;
    const empresaNome = estrategia?.abordagem?.empresa_nome || "Conexao Express Transportes";
    const maxWhatsapp = estrategia?.abordagem?.comprimento_max_whatsapp || 300;
    const duracaoScript = estrategia?.abordagem?.duracao_script_ligacao_seg || 30;
    const regrasTom = tomVoz?.regras || [];
    const provider = iaConfig?.provider || "groq";
    const model = iaConfig?.model || "llama-3.1-8b-instant";
    const temperature = iaConfig?.temperature_abordagem ?? 0.7;
    const maxTokens = iaConfig?.max_tokens_abordagem ?? 1500;

    const prompt = `Voce e um SDR digital da ${empresaNome}. 
Voce precisa gerar mensagens de abordagem personalizadas para ${dados.responsavel_nome || "o responsavel"} da empresa ${dados.empresa} (segmento: ${dados.segmento}, ${dados.cidade}/${dados.estado}).

Necessidade provavel: ${dados.necessidade_provavel || "Solucoes logisticas"}

${regrasTom.map(r => `- ${r}`).join("\n")}

Retorne APENAS UM JSON:
{
  "whatsapp": "Mensagem curta para WhatsApp (ate ${maxWhatsapp} caracteres)",
  "email": "Email formal completo com assunto e corpo",
  "script_ligacao": "Roteiro de ${duracaoScript} segundos para ligacao"
}`;

    const resultadoIa = await proxyIaClient.executar({
      provider, model, prompt, temperature, max_tokens: maxTokens,
    });

    if (resultadoIa.sucesso) {
      try {
        const jsonMatch = resultadoIa.resposta.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (canaisConfig.gerar_whatsapp) resultado.whatsapp = parsed.whatsapp;
          if (canaisConfig.gerar_email) resultado.email = parsed.email;
          if (canaisConfig.gerar_script_ligacao) resultado.script_ligacao = parsed.script_ligacao;
        }
      } catch {
        // fallback
      }
    }

    return resultado;
  },

  async executarFollowup(
    leadId: string,
    leadEmpresa: string,
    leadContato: string,
    dias: number,
    estrategia?: EstrategiaHunter,
    iaConfig?: IaConfigHunter
  ): Promise<boolean> {
    const maxTokens = iaConfig?.max_tokens_abordagem ?? 500;
    const provider = iaConfig?.provider || "groq";
    const model = iaConfig?.model || "llama-3.1-8b-instant";
    const temperature = iaConfig?.temperature_abordagem ?? 0.7;

    let mensagem: string;

    if (estrategia?.followup?.mensagem_personalizada !== false) {
      const prompt = `Gere uma mensagem de follow-up para ${leadContato} da empresa ${leadEmpresa}.
Este e o follow-up de D+${dias}. A mensagem deve ser educada, nao insistente, oferecendo valor.
Maximo 200 caracteres. Retorne APENAS o texto da mensagem, sem formatacao.`;

      const resultado = await proxyIaClient.executar({
        provider, model, prompt, temperature, max_tokens: 500,
      });
      mensagem = resultado.sucesso ? resultado.resposta : `Follow-up D+${dias}: Gostaria de saber se ja teve oportunidade de analisar nossa proposta.`;
    } else {
      mensagem = `Follow-up D+${dias}: Gostaria de saber se ja teve oportunidade de analisar nossa proposta.`;
    }

    const { error } = await supabase.from("crm_followups").insert([{
      lead_id: leadId,
      canal: estrategia?.canais?.ordem_prioridade?.[0] || "whatsapp",
      tipo: "followup",
      assunto: `Follow-up D+${dias}`,
      mensagem,
      status: "pendente",
      agendado_para: new Date(Date.now() + dias * 86400000).toISOString(),
    }]);

    if (error) {
      console.error("[FollowUp] Erro ao agendar:", error);
      return false;
    }

    await centralIaService.registrarLog({
      tipo: "info", modulo: "Comercial IA", acao: "followup",
      descricao: `Follow-up D+${dias} agendado para ${leadEmpresa}`,
    });

    return true;
  },
};
