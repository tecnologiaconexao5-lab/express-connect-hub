import { toast } from "sonner";

const ZOHO_API_URL = import.meta.env.VITE_ZOHO_EMAIL_API_URL;
const ZOHO_API_KEY = import.meta.env.VITE_ZOHO_EMAIL_API_KEY;
const ZOHO_EMAIL_FROM = import.meta.env.VITE_ZOHO_EMAIL_FROM;
const N8N_WEBHOOK_EMAIL = import.meta.env.VITE_N8N_WEBHOOK_EMAIL_URL;

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  from?: string;
  cc?: string;
  bcc?: string;
  attachments?: string[];
  html?: boolean;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  reason?: string;
}

export interface EmailEvent {
  setor: "comercial" | "operacional" | "financeiro" | "fiscal" | "cliente";
  canal: "email";
  provedor: "zoho";
  evento: string;
  destinatario: string;
  assunto: string;
  dados: Record<string, unknown>;
  origem: "tms_conexao_express";
}

const isConfigured = (): boolean => {
  return !!(ZOHO_API_URL && ZOHO_API_KEY && ZOHO_EMAIL_FROM);
};

const buildN8NPayload = (evento: EmailEvent): Record<string, unknown> => {
  return {
    setor: evento.setor,
    canal: evento.canal,
    provedor: evento.provedor,
    evento: evento.evento,
    destinatario: evento.destinatario,
    assunto: evento.assunto,
    dados: evento.dados,
    origem: evento.origem,
    timestamp: new Date().toISOString(),
  };
};

export const sendToN8N = async (evento: EmailEvent): Promise<EmailResponse> => {
  if (!N8N_WEBHOOK_EMAIL) {
    console.warn("[ZohoEmail] Webhook n8n não configurado. Pulando.");
    return { success: false, reason: "Webhook n8n não configurado" };
  }

  try {
    const payload = buildN8NPayload(evento);
    const response = await fetch(N8N_WEBHOOK_EMAIL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log("[ZohoEmail] Evento enviado para n8n:", evento.evento);
      return { success: true };
    }

    return { success: false, reason: `n8n retornou ${response.status}` };
  } catch (error) {
    console.error("[ZohoEmail] Erro ao enviar para n8n:", error);
    return { success: false, reason: "Erro de conexão com n8n" };
  }
};

const sendEmail = async (payload: EmailPayload): Promise<EmailResponse> => {
  if (!isConfigured()) {
    console.warn("[ZohoEmail] Zoho não configurado. Variáveis ausentes.");
    return { success: false, reason: "Zoho não configurado" };
  }

  try {
    const response = await fetch(`${ZOHO_API_URL}/api/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-api-key ${ZOHO_API_KEY}`,
      },
      body: JSON.stringify({
        from: payload.from || ZOHO_EMAIL_FROM,
        to: payload.to,
        subject: payload.subject,
        html: payload.html ? payload.body : undefined,
        text: !payload.html ? payload.body : undefined,
        cc: payload.cc,
        bcc: payload.bcc,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, messageId: data.messageId };
    }

    const error = await response.text();
    return { success: false, error: error };
  } catch (err) {
    console.error("[ZohoEmail] Erro ao enviar email:", err);
    return { success: false, error: String(err) };
  }
};

export const enviarEmailCliente = async (
  to: string,
  nomeCliente: string,
  tipo: "boas_vindas" | "atualizacao" | "cobranca" | "geral",
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const templates: Record<string, { subject: string; body: string }> = {
    boas_vindas: {
      subject: "Bem-vindo ao TMS Conexão Express",
      body: `Olá ${nomeCliente}, seja bem-vindo! Seu cadastro foi realizado com sucesso.`,
    },
    atualizacao: {
      subject: "Atualização do seu pedido",
      body: `Olá ${nomeCliente}, temos uma atualização sobre seu pedido: ${dados.mensagem || ""}`,
    },
    cobranca: {
      subject: "Aviso de cobrança",
      body: `Olá ${nomeCliente}, segue aviso de cobrança. Valor: R$ ${dados.valor}`,
    },
    geral: {
      subject: dados.assunto as string || "Mensagem do TMS",
      body: dados.mensagem as string || "Mensagem automática.",
    },
  };

  const template = templates[tipo];
  if (!template) {
    return { success: false, reason: "Tipo de email inválido" };
  }

  const evento: EmailEvent = {
    setor: "cliente",
    canal: "email",
    provedor: "zoho",
    evento: `cliente_email_${tipo}`,
    destinatario: to,
    assunto: template.subject,
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: template.subject,
    body: template.body,
    html: true,
  });
};

export const enviarEmailOperacional = async (
  to: string,
  tipo: "os_criada" | "os_atualizada" | "ocorrencia" | "entrega",
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const templates: Record<string, { subject: string; body: string }> = {
    os_criada: {
      subject: `OS ${dados.numero_os} criada`,
      body: `Ordem de Serviço ${dados.numero_os} criada para ${dados.cliente}.`,
    },
    os_atualizada: {
      subject: `OS ${dados.numero_os} atualizada`,
      body: `Ordem de Serviço ${dados.numero_os} teve seu status alterado para ${dados.status}.`,
    },
    ocorrencia: {
      subject: `Ocorrência na OS ${dados.numero_os}`,
      body: `Ocorrência registrada: ${dados.descricao}.`,
    },
    entrega: {
      subject: `Entrega concluída - OS ${dados.numero_os}`,
      body: `A entrega da OS ${dados.numero_os} foi finalizada.`,
    },
  };

  const template = templates[tipo];
  if (!template) return { success: false, reason: "Tipo inválido" };

  const evento: EmailEvent = {
    setor: "operacional",
    canal: "email",
    provedor: "zoho",
    evento: `operacional_${tipo}`,
    destinatario: to,
    assunto: template.subject,
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: template.subject,
    body: template.body,
    html: true,
  });
};

export const enviarEmailComercial = async (
  to: string,
  tipo: "orcamento" | "proposta" | "followup" | "revisao",
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const templates: Record<string, { subject: string; body: string }> = {
    orcamento: {
      subject: `Orçamento ${dados.numero} - TMS Conexão Express`,
      body: `Segue orçamento solicitado. Valor: R$ ${dados.valor}`,
    },
    proposta: {
      subject: `Proposta comercial ${dados.numero}`,
      body: `Segue proposta comercial para análise.`,
    },
    followup: {
      subject: "Follow-up - TMS Conexão Express",
      body: `Olá! Gostaria de saber o feedback sobre ${dados.proposta}.`,
    },
    revisao: {
      subject: "Proposta revisada",
      body: "Sua proposta foi revisada. Segue em anexo.",
    },
  };

  const template = templates[tipo];
  if (!template) return { success: false, reason: "Tipo inválido" };

  const evento: EmailEvent = {
    setor: "comercial",
    canal: "email",
    provedor: "zoho",
    evento: `comercial_${tipo}`,
    destinatario: to,
    assunto: template.subject,
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: template.subject,
    body: template.body,
    html: true,
  });
};

export const enviarEmailFinanceiro = async (
  to: string,
  tipo: "boleto" | "recibo" | "cobranca" | "pagamento_prestador",
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const templates: Record<string, { subject: string; body: string }> = {
    boleto: {
      subject: `Boleto - ${dados.documento}`,
      body: `Segue boleto para pagamento. Vencimento: ${dados.vencimento}.`,
    },
    recibo: {
      subject: `Recibo ${dados.numero}`,
      body: `Recibo emitido. Valor: R$ ${dados.valor}.`,
    },
    cobranca: {
      subject: "Aviso de cobrança",
      body: `Valor pendente: R$ ${dados.valor}. Vencimento: ${dados.vencimento}.`,
    },
    pagamento_prestador: {
      subject: "Pagamento processado",
      body: `Seu pagamento de R$ ${dados.valor} foi processado.`,
    },
  };

  const template = templates[tipo];
  if (!template) return { success: false, reason: "Tipo inválido" };

  const evento: EmailEvent = {
    setor: "financeiro",
    canal: "email",
    provedor: "zoho",
    evento: `financeiro_${tipo}`,
    destinatario: to,
    assunto: template.subject,
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: template.subject,
    body: template.body,
    html: true,
  });
};

export const enviarEmailComprovanteEntrega = async (
  to: string,
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const evento: EmailEvent = {
    setor: "cliente",
    canal: "email",
    provedor: "zoho",
    evento: "comprovante_disponivel",
    destinatario: to,
    assunto: "Comprovante de entrega disponível",
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: "Comprovante de entrega disponível",
    body: `Seu comprovante de entrega está disponível. OS: ${dados.numero_os}`,
    html: true,
  });
};

export const enviarEmailOrcamento = async (
  to: string,
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const evento: EmailEvent = {
    setor: "comercial",
    canal: "email",
    provedor: "zoho",
    evento: "orcamento_enviado",
    destinatario: to,
    assunto: "Orçamento TMS Conexão Express",
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: "Orçamento TMS Conexão Express",
    body: `Segue orçamento ${dados.numero}. Valor: R$ ${dados.valor}`,
    html: true,
  });
};

export const enviarEmailOSCriada = async (
  to: string,
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const evento: EmailEvent = {
    setor: "operacional",
    canal: "email",
    provedor: "zoho",
    evento: "os_criada",
    destinatario: to,
    assunto: `OS ${dados.numero_os} criada`,
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: `OS ${dados.numero_os} criada`,
    body: `Ordem de serviço ${dados.numero_os} foi criada. Cliente: ${dados.cliente}`,
    html: true,
  });
};

export const enviarEmailPesquisaSatisfacao = async (
  to: string,
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const evento: EmailEvent = {
    setor: "cliente",
    canal: "email",
    provedor: "zoho",
    evento: "pesquisa_satisfacao",
    destinatario: to,
    subject: "Pesquisa de satisfação",
    dados,
    origem: "tms_conexao_express",
  };

  sendToN8N(evento);

  return sendEmail({
    to,
    subject: "Pesquisa de satisfação - TMS Conexão Express",
    body: "Sua opinião é importante! Responda nossa pesquisa.",
    html: true,
  });
};

export const processarEmailXMLRecebido = async (
  xmlContent: string,
  dados: Record<string, unknown>
): Promise<EmailResponse> => {
  const evento: EmailEvent = {
    setor: "fiscal",
    canal: "email",
    provedor: "zoho",
    evento: "xml_recebido",
    destinatario: "fiscal@conexaoexpress.com.br",
    subject: "XML fiscal recebido",
    dados: { ...dados, xml_preview: xmlContent.substring(0, 500) },
    origem: "tms_conexao_express",
  };

  await sendToN8N(evento);

  return { success: true };
};

export const getZohoStatus = () => {
  return {
    configured: isConfigured(),
    apiUrl: ZOHO_API_URL ? "configurado" : "não configurado",
    apiKey: ZOHO_API_KEY ? "configurado" : "não configurado",
    fromEmail: ZOHO_EMAIL_FROM || "não configurado",
    n8nWebhook: N8N_WEBHOOK_EMAIL ? "configurado" : "não configurado",
  };
};

export const isZohoConfigured = isConfigured;