/**
 * whatsappService.ts (versão real)
 * Usa Evolution API via serviço dedicado
 * Retorna erro real se não configurado — não simula envio
 */

import { validateEvolutionConfig, sendWhatsAppMessage as evolutionSend } from "./evolutionApiService";

export interface WhatsAppResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// 1. ENVIAR MENSAGEM (via Evolution API)
// ============================================================
export async function enviarMensagem(
  numero: string,
  mensagem: string
): Promise<WhatsAppResult> {
  const config = validateEvolutionConfig();
  if (!config.ok) {
    return { ok: false, error: config.error };
  }

  const result = await evolutionSend(numero, mensagem);
  
  if (!result.ok) {
    return { ok: false, error: result.error || "Falha no envio via Evolution API" };
  }

  return { ok: true, data: result.data };
}

// ============================================================
// 2. NOTIFICAÇÕES DE ORDEM DE SERVIÇO
// ============================================================
export async function notificarOSCriada(
  numero: string,
  numeroOS: string
): Promise<WhatsAppResult> {
  const msg = `Olá! Sua Ordem de Serviço *${numeroOS}* foi criada com sucesso pela Conexão Express. Você receberá atualizações por aqui. 🚚`;
  return enviarMensagem(numero, msg);
}

export async function notificarEmRota(
  numero: string,
  numeroOS: string
): Promise<WhatsAppResult> {
  const msg = `O motorista já está em rota para a entrega da OS *${numeroOS}*. Prepare-se para receber! 🛣️`;
  return enviarMensagem(numero, msg);
}

export async function notificarEntregue(
  numero: string,
  numeroOS: string
): Promise<WhatsAppResult> {
  const msg = `A OS *${numeroOS}* foi finalizada com sucesso! Agradecemos por escolher a Conexão Express. ✅`;
  return enviarMensagem(numero, msg);
}

// ============================================================
// 3. MENSAGENS COMERCIAIS (usando IA se disponível)
// ============================================================
export async function enviarPropostaComercial(
  numero: string,
  nomeCliente: string,
  valor: number,
  origem: string,
  destino: string
): Promise<WhatsAppResult> {
  const msg = `Olá ${nomeCliente}! Sua cotação de ${origem} para ${destino} ficou em *R$ ${valor.toFixed(2)}*. Posso aprovar para gerar a OS?`;
  return enviarMensagem(numero, msg);
}

// ============================================================
// 4. FOLLOW-UP (preparado, só dispara com confirmação)
// ============================================================
export async function enviarFollowUp(
  numero: string,
  nomeCliente: string,
  tipo: 'D+1' | 'D+3' | 'D+7'
): Promise<WhatsAppResult> {
  let msg = '';
  
  switch (tipo) {
    case 'D+1':
      msg = `Olá ${nomeCliente}, conseguiu analisar a proposta enviada ontem? Qualquer dúvida estou à disposição!`;
      break;
    case 'D+3':
      msg = `Oi ${nomeCliente}. Estamos reenviando nossa proposta comercial para sua análise. Aguardo retorno!`;
      break;
    case 'D+7':
      msg = `Oi ${nomeCliente}. Como não tivemos retorno, estamos encerrando essa cotação. Pode nos chamar quando precisar! 👋`;
      break;
  }
  
  return enviarMensagem(numero, msg);
}

// ============================================================
// 5. VERIFICAR STATUS (sem quebrar tela)
// ============================================================
export function isWhatsAppConfigured(): boolean {
  const config = validateEvolutionConfig();
  return config.ok;
}
