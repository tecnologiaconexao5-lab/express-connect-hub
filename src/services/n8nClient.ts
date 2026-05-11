/**
 * Cliente de Integração N8N (Seguro - Sem Tokens no Frontend)
 * Responsável por padronizar todas as chamadas de webhooks públicos.
 */

export interface N8NResponse {
  ok: boolean;
  status?: number;
  data?: any;
  error?: string;
}

/**
 * Função utilitária para fetch seguro com timeout.
 */
async function fetchSeguro(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<N8NResponse> {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return { ok: false, error: "URL inválida ou ausente." };
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(id);

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, data, error: `Erro HTTP ${res.status}` };
    }

    return { ok: true, status: res.status, data };
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === "AbortError") {
      return { ok: false, error: "Tempo limite da requisição (Timeout)." };
    }
    return { ok: false, error: `Falha na rede ou CORS: ${err.message}` };
  }
}

/**
 * Ping básico para checar se a instância N8N está online.
 */
export async function pingN8N(baseUrl: string): Promise<N8NResponse> {
  // Tenta um GET simples na raiz ou endpoint health se aplicável
  return fetchSeguro(baseUrl, { method: "GET" }, 5000);
}

/**
 * Teste genérico para verificar um webhook qualquer.
 */
export async function testarWebhook(url: string): Promise<N8NResponse> {
  // Primeiro tentamos um POST de ping
  let result = await fetchSeguro(url, {
    method: "POST",
    body: JSON.stringify({ action: "ping", source: "tms-frontend-test" }),
  }, 8000);

  // Fallback para GET se o webhook recusar POST ou der erro de método
  if (!result.ok && (result.status === 405 || result.status === 404)) {
    result = await fetchSeguro(url, { method: "GET" }, 8000);
  }

  return result;
}

/**
 * Fluxo: WhatsApp Recrutamento
 * Dispara envio de mensagem no fluxo de recrutamento.
 */
export async function enviarMensagemWhatsAppRecrutamento(url: string, payload: { telefone: string; mensagem: string; nome?: string; origem: string }): Promise<N8NResponse> {
  return fetchSeguro(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Fluxo: Envio de E-mail via Zoho
 * Dispara e-mail transacional via Zoho Mail.
 */
export async function enviarEmailZohoViaN8N(url: string, payload: { to: string; subject: string; body: string; templateId?: string }): Promise<N8NResponse> {
  return fetchSeguro(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Fluxo: Automação Comercial CRM
 * Dispara gatilho de novo lead ou mudança de funil.
 */
export async function dispararAutomacaoComercial(url: string, payload: { leadId: string; acao: string; dadosAdicionais?: any }): Promise<N8NResponse> {
  return fetchSeguro(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
