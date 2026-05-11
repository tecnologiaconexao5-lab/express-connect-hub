/**
 * Serviço centralizado para automação WhatsApp via n8n
 * Padroniza todos os envios de webhook para o formato definido
 * Não bloqueia o salvamento de OS ou Orçamento em caso de falha
 */

export type TipoWebhook = "nova_os" | "orcamento" | "followup" | "status_update";

export interface WebhookPayload {
  tipo: TipoWebhook;
  cliente: {
    nome: string;
    telefone: string;
  };
  prestador?: {
    nome: string;
    telefone: string;
  };
  dados: {
    numero: string;
    valor: string;
    origem: string;
    destino: string;
    data: string;
    status: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LogAutomacao {
  tipo: TipoWebhook;
  payload: WebhookPayload;
  sucesso: boolean;
  erro?: string;
  resposta?: string;
  timestamp: string;
}

const WEBHOOK_N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_WHATSAPP_URL || import.meta.env.VITE_N8N_WEBHOOK_OS || "";

const getTelefoneFormatado = (telefone?: string): string => {
  if (!telefone) return "";
  return telefone.replace(/\D/g, "");
};

/**
 * Envia webhook padronizado para o n8n
 * Não lança erro - falha silenciosamente para não travar o sistema
 */
export const enviarWebhookN8n = async (payload: WebhookPayload): Promise<boolean> => {
  if (!WEBHOOK_N8N_URL) {
    console.warn("[WEBHOOK N8N] URL não configurada no .env (VITE_N8N_WEBHOOK_WHATSAPP_URL)");
    return false;
  }

  console.log("[WEBHOOK N8N] Payload enviado:", JSON.stringify(payload, null, 2));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(WEBHOOK_N8N_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const erro = `HTTP ${response.status}: ${response.statusText}`;
      console.warn(`[WEBHOOK N8N] Erro: ${erro}`);
      registrarLogAutomacao({
        tipo: payload.tipo,
        payload,
        sucesso: false,
        erro,
        timestamp: new Date().toISOString(),
      });
      return false;
    }

    console.log("[WEBHOOK N8N] Sucesso:", response.status);
    registrarLogAutomacao({
      tipo: payload.tipo,
      payload,
      sucesso: true,
      resposta: `HTTP ${response.status}`,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (e: unknown) {
    const erro = e instanceof Error ? e.message : "Erro desconhecido";
    console.warn(`[WEBHOOK N8N] Erro: ${erro}`);
    registrarLogAutomacao({
      tipo: payload.tipo,
      payload,
      sucesso: false,
      erro,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
};

/**
 * Envia webhook para Nova OS
 */
export const enviarNovaOS = async (os: {
  numero?: string;
  cliente?: string;
  clienteTelefone?: string;
  prestador?: string;
  prestadorTelefone?: string;
  valor?: number | string;
  origem?: string;
  destino?: string;
  data?: string;
  status?: string;
}): Promise<boolean> => {
  const payload: WebhookPayload = {
    tipo: "nova_os",
    cliente: {
      nome: os.cliente || "—",
      telefone: getTelefoneFormatado(os.clienteTelefone),
    },
    dados: {
      numero: os.numero || "—",
      valor: typeof os.valor === "number" ? os.valor.toFixed(2) : (os.valor || "0.00"),
      origem: os.origem || "—",
      destino: os.destino || "—",
      data: os.data || new Date().toISOString(),
      status: os.status || "rascunho",
    },
  };

  if (os.prestador) {
    payload.prestador = {
      nome: os.prestador,
      telefone: getTelefoneFormatado(os.prestadorTelefone),
    };
  }

  return enviarWebhookN8n(payload);
};

/**
 * Envia webhook para Orçamento
 */
export const enviarOrcamento = async (orcamento: {
  numero?: string;
  cliente?: string;
  clienteTelefone?: string;
  valor?: number | string;
  origem?: string;
  destino?: string;
  data?: string;
  status?: string;
}): Promise<boolean> => {
  const payload: WebhookPayload = {
    tipo: "orcamento",
    cliente: {
      nome: orcamento.cliente || "—",
      telefone: getTelefoneFormatado(orcamento.clienteTelefone),
    },
    dados: {
      numero: orcamento.numero || "—",
      valor: typeof orcamento.valor === "number" ? orcamento.valor.toFixed(2) : (orcamento.valor || "0.00"),
      origem: orcamento.origem || "—",
      destino: orcamento.destino || "—",
      data: orcamento.data || new Date().toISOString(),
      status: orcamento.status || "rascunho",
    },
  };

  return enviarWebhookN8n(payload);
};

/**
 * Envia webhook para atualização de status
 */
export const enviarStatusUpdate = async (os: {
  numero?: string;
  cliente?: string;
  clienteTelefone?: string;
  statusAnterior?: string;
  statusNovo?: string;
  origem?: string;
  destino?: string;
}): Promise<boolean> => {
  const payload: WebhookPayload = {
    tipo: "status_update",
    cliente: {
      nome: os.cliente || "—",
      telefone: getTelefoneFormatado(os.clienteTelefone),
    },
    dados: {
      numero: os.numero || "—",
      valor: "0.00",
      origem: os.origem || "—",
      destino: os.destino || "—",
      data: new Date().toISOString(),
      status: os.statusNovo || "—",
    },
    metadata: {
      statusAnterior: os.statusAnterior,
      statusNovo: os.statusNovo,
    },
  };

  return enviarWebhookN8n(payload);
};

/**
 * Envia webhook para follow-up
 */
export const enviarFollowup = async (dados: {
  cliente?: string;
  clienteTelefone?: string;
  assunto?: string;
  mensagem?: string;
}): Promise<boolean> => {
  const payload: WebhookPayload = {
    tipo: "followup",
    cliente: {
      nome: dados.cliente || "—",
      telefone: getTelefoneFormatado(dados.clienteTelefone),
    },
    dados: {
      numero: "—",
      valor: "0.00",
      origem: dados.assunto || "—",
      destino: dados.mensagem || "—",
      data: new Date().toISOString(),
      status: "followup",
    },
  };

  return enviarWebhookN8n(payload);
};

/**
 * Registra log de automação (local e prepara para envio futuro para Supabase)
 */
export const registrarLogAutomacao = (log: LogAutomacao): void => {
  try {
    const logs = JSON.parse(localStorage.getItem("automacao_logs") || "[]");
    logs.unshift(log);
    // Manter apenas os últimos 100 logs
    if (logs.length > 100) logs.length = 100;
    localStorage.setItem("automacao_logs", JSON.stringify(logs));
  } catch {
    // Silencioso - não deve quebrar o sistema
  }
};

/**
 * Busca logs de automação armazenados
 */
export const buscarLogsAutomacao = (): LogAutomacao[] => {
  try {
    return JSON.parse(localStorage.getItem("automacao_logs") || "[]");
  } catch {
    return [];
  }
};
