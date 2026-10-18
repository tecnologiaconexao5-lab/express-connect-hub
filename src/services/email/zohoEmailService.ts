import { toast } from "sonner";

// ⚠️ LEGADO: Este arquivo será substituído pelo ZohoMailProvider (via Conectores IA)
// Mantido para compatibilidade com serviços existentes (propostaService, followUpService, etc.)

// Novas vars OAuth2 (oficial)
const ZOHO_CLIENT_ID = import.meta.env.VITE_ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = import.meta.env.VITE_ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = import.meta.env.VITE_ZOHO_REFRESH_TOKEN;
const ZOHO_ACCOUNT_ID = import.meta.env.VITE_ZOHO_ACCOUNT_ID;
const ZOHO_DATA_CENTER = import.meta.env.VITE_ZOHO_DATA_CENTER || "mail.zoho.com";
const ZOHO_EMAIL_FROM = import.meta.env.VITE_ZOHO_EMAIL_FROM;

// Deprecated: antigas vars API Key (mantidas para fallback, serão removidas)
const ZOHO_API_URL_DEPRECATED = import.meta.env.VITE_ZOHO_EMAIL_API_URL;
const ZOHO_API_KEY_DEPRECATED = import.meta.env.VITE_ZOHO_EMAIL_API_KEY;

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

// Cache do access_token (em memória, não persiste, não loga)
let cachedAccessToken: string | null = null;
let cachedExpiresAt: number = 0;

const obterAccessToken = async (): Promise<string> => {
  if (cachedAccessToken && Date.now() < cachedExpiresAt) {
    return cachedAccessToken;
  }

  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error("Zoho Mail OAuth2 não configurado. Configure VITE_ZOHO_CLIENT_ID, VITE_ZOHO_CLIENT_SECRET e VITE_ZOHO_REFRESH_TOKEN no .env");
  }

  const params = new URLSearchParams();
  params.set("refresh_token", ZOHO_REFRESH_TOKEN);
  params.set("grant_type", "refresh_token");
  params.set("client_id", ZOHO_CLIENT_ID);
  params.set("client_secret", ZOHO_CLIENT_SECRET);

  const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Erro desconhecido");
    throw new Error(`Zoho OAuth2 token error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Zoho OAuth2: access_token não retornado");
  }

  const expiresIn = (data.expires_in as number) || 3600;
  cachedAccessToken = data.access_token as string;
  cachedExpiresAt = Date.now() + (expiresIn - 60) * 1000;

  return cachedAccessToken;
};

const isConfigured = (): boolean => {
  // Prioriza OAuth2
  if (ZOHO_CLIENT_ID && ZOHO_CLIENT_SECRET && ZOHO_REFRESH_TOKEN && ZOHO_ACCOUNT_ID) return true;
  // Fallback para API Key deprecated
  if (ZOHO_API_URL_DEPRECATED && ZOHO_API_KEY_DEPRECATED && ZOHO_EMAIL_FROM) return true;
  return false;
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
    // Tenta OAuth2 primeiro
    if (ZOHO_CLIENT_ID && ZOHO_CLIENT_SECRET && ZOHO_REFRESH_TOKEN && ZOHO_ACCOUNT_ID) {
      const accessToken = await obterAccessToken();
      const endpoint = `https://${ZOHO_DATA_CENTER}/api/accounts/${ZOHO_ACCOUNT_ID}/messages`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
        body: JSON.stringify({
          fromAddress: payload.from || ZOHO_EMAIL_FROM,
          toAddress: payload.to,
          subject: payload.subject,
          content: payload.body,
          mailFormat: payload.html ? "html" : "plain",
          ccAddress: payload.cc || undefined,
          bccAddress: payload.bcc || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, messageId: data?.data?.messageId || data?.messageId };
      }

      if (response.status === 401) {
        cachedAccessToken = null;
        cachedExpiresAt = 0;
      }

      const error = await response.text();
      return { success: false, error };
    }

    // Fallback: API Key deprecated
    if (ZOHO_API_URL_DEPRECATED && ZOHO_API_KEY_DEPRECATED) {
      const response = await fetch(`${ZOHO_API_URL_DEPRECATED}/api/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ZohoMail ${ZOHO_API_KEY_DEPRECATED}`,
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
      return { success: false, error };
    }

    return { success: false, reason: "Nenhum método de autenticação configurado" };
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
    oauth2: ZOHO_CLIENT_ID && ZOHO_CLIENT_SECRET && ZOHO_REFRESH_TOKEN ? "configurado" : "não configurado",
    accountId: ZOHO_ACCOUNT_ID || "não configurado",
    dataCenter: ZOHO_DATA_CENTER,
    fromEmail: ZOHO_EMAIL_FROM || "não configurado",
    n8nWebhook: N8N_WEBHOOK_EMAIL ? "configurado" : "não configurado",
    apiKeyLegacy: ZOHO_API_KEY_DEPRECATED ? "configurado (deprecated)" : "não configurado",
  };
};

export const isZohoConfigured = isConfigured;