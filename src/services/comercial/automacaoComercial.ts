/**
 * automacaoComercial.ts
 * Prepara funções para automação comercial
 * NENHUM disparo automático — todas requerem confirmação
 */

import { gerarMensagemComercial } from "@/services/integracoes/iaService";
import { enviarMensagem as enviarWhatsApp } from "@/services/integracoes/whatsappService";
import { triggerN8nWorkflowCotacao } from "@/services/integracoes/n8nService";
import type { ClienteForm } from "@/lib/dbMappers";

export interface DadosAutomacao {
  cliente: ClienteForm;
  origem: string;
  destino: string;
  tipoVeiculo?: string;
  valorEstimado?: number;
  telefone?: string;
  email?: string;
}

export interface MensagemGerada {
  sucesso: boolean;
  mensagem?: string;
  erro?: string;
}

// ============================================================
// 1. GERAR MENSAGEM DE SEGUIMENTO (Follow-up)
// ============================================================
export async function gerarFollowUp(
  dados: DadosAutomacao,
  tipo: 'D+1' | 'D+3' | 'D+7'
): Promise<MensagemGerada> {
  try {
    let prompt = '';
    
    switch (tipo) {
      case 'D+1':
        prompt = `Gere uma mensagem de follow-up D+1 para ${dados.cliente.razaoSocial || 'cliente'}. 
        Cotação: ${dados.origem} → ${dados.destino}. 
        Seja cordial e pergunte se conseguiu analisar a proposta. Máximo 150 caracteres.`;
        break;
      case 'D+3':
        prompt = `Gere uma mensagem de reforço D+3 para ${dados.cliente.razaoSocial || 'cliente'}. 
        Reenvie informações sobre a cotação. Seja persuasivo mas não insistente. Máximo 150 caracteres.`;
        break;
      case 'D+7':
        prompt = `Gere uma mensagem de encerramento D+7 para ${dados.cliente.razaoSocial || 'cliente'}. 
        Informe que estamos encerrando a cotação por falta de retorno. 
        Deixe portas abertas para futuro. Máximo 150 caracteres.`;
        break;
    }

    const mensagem = await gerarMensagemComercial({
      nome: dados.cliente.razaoSocial || 'Cliente',
      empresa: dados.cliente.razaoSocial,
      origem: dados.origem,
      destino: dados.destino,
      tipoVeiculo: dados.tipoVeiculo,
      valorEstimado: dados.valorEstimado,
    });

    return { sucesso: true, mensagem };
  } catch (e: unknown) {
    const erro = e instanceof Error ? e.message : 'Erro ao gerar mensagem';
    return { sucesso: false, erro };
  }
}

// ============================================================
// 2. GERAR RESPOSTA INICIAL PARA CLIENTE
// ============================================================
export async function gerarRespostaInicial(
  dados: DadosAutomacao
): Promise<MensagemGerada> {
  try {
    const mensagem = await gerarMensagemComercial({
      nome: dados.cliente.razaoSocial || 'Cliente',
      empresa: dados.cliente.razaoSocial,
      origem: dados.origem,
      destino: dados.destino,
      tipoVeiculo: dados.tipoVeiculo,
      valorEstimado: dados.valorEstimado,
    });

    return { sucesso: true, mensagem };
  } catch (e: unknown) {
    const erro = e instanceof Error ? e.message : 'Erro ao gerar mensagem inicial';
    return { sucesso: false, erro };
  }
}

// ============================================================
// 3. GERAR LEMBRETE DE PROPOSTA
// ============================================================
export async function gerarLembreteProposta(
  dados: DadosAutomacao
): Promise<MensagemGerada> {
  try {
    const prompt = `Gere um lembrete amigável para ${dados.cliente.razaoSocial || 'cliente'}. 
    A proposta de frete para ${dados.origem} → ${dados.destino} está pendente. 
    Seja cordial e incentive a resposta. Máximo 150 caracteres.`;

    const mensagem = await gerarMensagemComercial({
      nome: dados.cliente.razaoSocial || 'Cliente',
      empresa: dados.cliente.razaoSocial,
      origem: dados.origem,
      destino: dados.destino,
    });

    return { sucesso: true, mensagem };
  } catch (e: unknown) {
    const erro = e instanceof Error ? e.message : 'Erro ao gerar lembrete';
    return { sucesso: false, erro };
  }
}

// ============================================================
// 4. GERAR MENSAGEM PARA PRESTADOR
// ============================================================
export async function gerarMensagemPrestador(
  nomePrestador: string,
  dadosOS: {
    numero: string;
    origem: string;
    destino: string;
    dataProgramada?: string;
    valor?: number;
  }
): Promise<MensagemGerada> {
  try {
    const prompt = `Gere uma mensagem para o prestador ${nomePrestador}. 
    Nova OS ${dadosOS.numero}: ${dadosOS.origem} → ${dadosOS.destino}. 
    Data: ${dadosOS.dataProgramada || 'a combinar'}. Valor: R$ ${dadosOS.valor?.toFixed(2) || 'N/A'}. 
    Seja direto e profissional. Máximo 150 caracteres.`;

    // Aqui poderia usar gerarMensagemPrestador do iaService
    const mensagem = `Olá ${nomePrestador}! Nova OS disponível: ${dadosOS.numero}. Rota: ${dadosOS.origem} → ${dadosOS.destino}. Acesse o app para aceitar.`;

    return { sucesso: true, mensagem };
  } catch (e: unknown) {
    const erro = e instanceof Error ? e.message : 'Erro ao gerar mensagem para prestador';
    return { sucesso: false, erro };
  }
}

// ============================================================
// 5. GERAR AVISO DE OS AGENDADA
// ============================================================
export async function gerarAvisoOSAgendada(
  dados: {
    numero: string;
    cliente: string;
    dataProgramada: string;
    prestador?: string;
  }
): Promise<MensagemGerada> {
  try {
    const mensagem = `OS ${dados.numero} agendada para ${dados.dataProgramada}. 
    Cliente: ${dados.cliente}. ${dados.prestador ? `Prestador: ${dados.prestador}.` : ''} 
    Prepare-se para a operação.`;

    return { sucesso: true, mensagem };
  } catch (e: unknown) {
    const erro = e instanceof Error ? e.message : 'Erro ao gerar aviso de OS';
    return { sucesso: false, erro };
  }
}

// ============================================================
// 6. TESTAR PAYLOAD (sem enviar)
// ============================================================
export function testarPayload(dados: DadosAutomacao): Record<string, unknown> {
  return {
    evento: 'teste_payload',
    timestamp: new Date().toISOString(),
    cliente: {
      id: dados.cliente.id,
      nome: dados.cliente.razaoSocial,
      telefone: dados.telefone || dados.cliente.telefone,
      email: dados.email || dados.cliente.email,
    },
    cotacao: {
      origem: dados.origem,
      destino: dados.destino,
      tipoVeiculo: dados.tipoVeiculo,
      valorEstimado: dados.valorEstimado,
    },
    canais: {
      whatsapp: !!(dados.telefone || dados.cliente.whatsapp),
      email: !!(dados.email || dados.cliente.email),
    },
  };
}

// ============================================================
// 7. DISPARAR VIA N8N (apenas com confirmação explícita)
// ============================================================
export async function dispararAutomacaoN8N(
  dados: DadosAutomacao,
  confirmado: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!confirmado) {
    return { ok: false, error: 'Disparo requer confirmação explícita' };
  }

  const payload = testarPayload(dados);
  const result = await triggerN8nWorkflowCotacao({
    cliente: dados.cliente.razaoSocial || 'N/A',
    origem: dados.origem,
    destino: dados.destino,
    tipoVeiculo: dados.tipoVeiculo,
    valorEstimado: dados.valorEstimado,
  });

  return { ok: result.ok, error: result.error };
}

// ============================================================
// 8. ENVIAR WHATSAPP (apenas com confirmação explícita)
// ============================================================
export async function enviarWhatsAppConfirmado(
  numero: string,
  mensagem: string,
  confirmado: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!confirmado) {
    return { ok: false, error: 'Envio requer confirmação explícita' };
  }

  const result = await enviarWhatsApp(numero, mensagem);
  return { ok: result.ok, error: result.error };
}
