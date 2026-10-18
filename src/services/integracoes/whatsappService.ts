/**
 * whatsappService.ts (BLOQUEADO — F25B)
 * Envio direto bloqueado. Toda mensagem deve passar pelo gateway seguro.
 * Usar comunicacaoGatewayService.solicitarEnvioControlado() ou
 * whatsappHomologService para homologação controlada.
 */

import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";

export interface WhatsAppResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// BLOQUEIO DE ENVIO DIRETO (F25B)
// ============================================================
async function bloquearEnvioDireto(
  numero: string,
  mensagem: string,
  origem: string
): Promise<WhatsAppResult> {
  const telefoneMascarado = numero.replace(/(\d{2})\d{4,}(\d{2})/, "$1****$2");

  // Criar tarefa de bloqueio
  const tarefa = await centralIaService.criarTarefa({
    setor: "Central IA",
    tipo_tarefa: "bloqueio_envio_direto",
    titulo: `Envio direto bloqueado - ${origem}`,
    descricao: `Tentativa de envio direto bloqueada pelo gateway F25B. Telefone: ${telefoneMascarado}`,
    prioridade: "normal",
    status: "aguardando_aprovacao",
    payload: {
      origem,
      telefone_mascarado: telefoneMascarado,
      mensagem_resumida: mensagem.slice(0, 100),
    },
  });

  // Criar aprovação humana
  if (tarefa) {
    await centralIaService.criarAprovacao({
      tarefa_id: tarefa.id,
      tipo_aprovacao: "mensagem_cliente",
      conteudo_original: { telefone: telefoneMascarado, mensagem, origem },
      conteudo_sugerido: { telefone: telefoneMascarado, mensagem, origem },
    });
  }

  // Registrar mensagem como bloqueada
  await supabase.from("comunicacoes_mensagens").insert({
    tarefa_id: tarefa?.id || null,
    origem_tipo: "whatsapp_service",
    origem_id: origem,
    destinatario_tipo: "setor",
    canal: "whatsapp",
    assunto: "Envio direto bloqueado",
    conteudo: mensagem,
    status: "bloqueado",
    modo_seguro: true,
    provider_message_id: null,
    motivo_bloqueio: "Envio direto bloqueado pelo gateway F25B. Use comunicacaoGatewayService.solicitarEnvioControlado()",
    contexto: { telefone_mascarado: telefoneMascarado, origem },
  });

  // Registrar log
  await centralIaService.registrarLog({
    acao: "envio_direto_bloqueado",
    entrada: { telefone_mascarado: telefoneMascarado, origem, mensagem_resumida: mensagem.slice(0, 100) },
    saida: { tarefa_id: tarefa?.id, status: "bloqueado" },
    status: "aviso",
    erro: "Envio direto bloqueado. A mensagem foi enviada para aprovação na Central IA.",
  });

  return {
    ok: false,
    error: "Envio direto bloqueado. A mensagem foi enviada para aprovação na Central IA.",
  };
}

// ============================================================
// 1. ENVIAR MENSAGEM (BLOQUEADO — não envia direto)
// ============================================================
export async function enviarMensagem(
  numero: string,
  mensagem: string,
  origem?: string
): Promise<WhatsAppResult> {
  return bloquearEnvioDireto(numero, mensagem, origem || "whatsapp_service");
}

// ============================================================
// 2. NOTIFICAÇÕES DE ORDEM DE SERVIÇO (BLOQUEADO)
// ============================================================
export async function notificarOSCriada(
  numero: string,
  numeroOS: string
): Promise<WhatsAppResult> {
  const msg = `Olá! Sua Ordem de Serviço *${numeroOS}* foi criada com sucesso pela Conexão Express. Você receberá atualizações por aqui. 🚚`;
  return bloquearEnvioDireto(numero, msg, `notificarOSCriada_${numeroOS}`);
}

export async function notificarEmRota(
  numero: string,
  numeroOS: string
): Promise<WhatsAppResult> {
  const msg = `O motorista já está em rota para a entrega da OS *${numeroOS}*. Prepare-se para receber! 🛣️`;
  return bloquearEnvioDireto(numero, msg, `notificarEmRota_${numeroOS}`);
}

export async function notificarEntregue(
  numero: string,
  numeroOS: string
): Promise<WhatsAppResult> {
  const msg = `A OS *${numeroOS}* foi finalizada com sucesso! Agradecemos por escolher a Conexão Express. ✅`;
  return bloquearEnvioDireto(numero, msg, `notificarEntregue_${numeroOS}`);
}

// ============================================================
// 3. MENSAGENS COMERCIAIS (BLOQUEADO)
// ============================================================
export async function enviarPropostaComercial(
  numero: string,
  nomeCliente: string,
  valor: number,
  origem: string,
  destino: string
): Promise<WhatsAppResult> {
  const msg = `Olá ${nomeCliente}! Sua cotação de ${origem} para ${destino} ficou em *R$ ${valor.toFixed(2)}*. Posso aprovar para gerar a OS?`;
  return bloquearEnvioDireto(numero, msg, "enviarPropostaComercial");
}

// ============================================================
// 4. FOLLOW-UP (BLOQUEADO)
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
  return bloquearEnvioDireto(numero, msg, `enviarFollowUp_${tipo}`);
}

// ============================================================
// 5. VERIFICAR STATUS (mantido — não envia nada)
// ============================================================
export function isWhatsAppConfigured(): boolean {
  return false;
}
