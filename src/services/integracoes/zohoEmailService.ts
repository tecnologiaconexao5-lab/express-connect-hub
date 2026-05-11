/**
 * Serviço de Integração Zoho Mail
 * Responsável pelo envio de emails transacionais e comerciais.
 */

export const zohoEmailService = {
  /**
   * Envia uma proposta comercial por email.
   */
  enviarPropostaEmail: async (emailDestino: string, nomeCliente: string, dadosProposta: any) => {
    console.log(`[ZOHO MOCK] Enviando proposta para ${emailDestino}...`);
    console.log(`[ZOHO MOCK] Olá ${nomeCliente}, sua proposta no valor de R$ ${dadosProposta.valor} foi gerada.`);
    // Mock simulando delay de rede
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, message: "Proposta enviada com sucesso" };
  },

  /**
   * Envia confirmação de criação de OS.
   */
  enviarConfirmacaoOS: async (emailDestino: string, numeroOS: string) => {
    console.log(`[ZOHO MOCK] Enviando confirmação de OS para ${emailDestino}...`);
    console.log(`[ZOHO MOCK] A Ordem de Serviço ${numeroOS} foi criada e já está em processamento.`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: "Confirmação enviada" };
  },

  /**
   * Envia cobrança ou nota fiscal.
   */
  enviarCobranca: async (emailDestino: string, valor: number, linkBoleto: string) => {
    console.log(`[ZOHO MOCK] Enviando cobrança para ${emailDestino}...`);
    console.log(`[ZOHO MOCK] Valor: R$ ${valor} | Link: ${linkBoleto}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, message: "Cobrança enviada" };
  }
};
