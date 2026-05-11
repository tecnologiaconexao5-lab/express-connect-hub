/**
 * evolutionApiService.ts
 * Serviço para integração com a Evolution API (WhatsApp)
 * Todas as funções retornam { ok, data?, error? }
 * Nenhuma chave é exposta no console em produção.
 */

export interface EvolutionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// Headers padrão para Evolution API
function makeHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'apikey': apiKey,
  };
}

// Wrapper seguro para fetch — nunca trava a tela
async function safeFetch<T = unknown>(
  url: string,
  options: RequestInit,
  label: string
): Promise<EvolutionResult<T>> {
  try {
    console.log(`[EvolutionAPI] ${label} → ${url}`);
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    let data: unknown;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errMsg = typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${response.status}`;
      console.warn(`[EvolutionAPI] ${label} falhou: ${errMsg}`);
      return { ok: false, error: errMsg, status: response.status };
    }

    console.log(`[EvolutionAPI] ${label} OK`);
    return { ok: true, data: data as T, status: response.status };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro de conexão';
    console.error(`[EvolutionAPI] ${label} exception:`, msg);
    return { ok: false, error: msg };
  }
}

// ============================================================
// 1. TESTAR CONEXÃO
// GET /instance/fetchInstances
// ============================================================
export async function testarConexaoEvolution(
  serverUrl: string,
  apiKey: string
): Promise<EvolutionResult> {
  const url = `${serverUrl.replace(/\/$/, '')}/instance/fetchInstances`;
  return safeFetch(url, {
    method: 'GET',
    headers: makeHeaders(apiKey),
  }, 'TestarConexao');
}

// ============================================================
// 2. CRIAR INSTÂNCIA
// POST /instance/create
// ============================================================
export async function criarInstancia(
  nome: string,
  serverUrl: string,
  apiKey: string
): Promise<EvolutionResult> {
  const url = `${serverUrl.replace(/\/$/, '')}/instance/create`;
  return safeFetch(url, {
    method: 'POST',
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      instanceName: nome,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  }, `CriarInstancia[${nome}]`);
}

// ============================================================
// 3. CONECTAR INSTÂNCIA (gerar QR Code)
// GET /instance/connect/{instanceName}
// ============================================================
export async function conectarInstancia(
  nome: string,
  serverUrl: string,
  apiKey: string
): Promise<EvolutionResult> {
  const url = `${serverUrl.replace(/\/$/, '')}/instance/connect/${encodeURIComponent(nome)}`;
  return safeFetch(url, {
    method: 'GET',
    headers: makeHeaders(apiKey),
  }, `ConectarInstancia[${nome}]`);
}

// ============================================================
// 4. STATUS DA INSTÂNCIA
// GET /instance/connectionState/{instanceName}
// ============================================================
export async function statusInstancia(
  nome: string,
  serverUrl: string,
  apiKey: string
): Promise<EvolutionResult> {
  const url = `${serverUrl.replace(/\/$/, '')}/instance/connectionState/${encodeURIComponent(nome)}`;
  return safeFetch(url, {
    method: 'GET',
    headers: makeHeaders(apiKey),
  }, `StatusInstancia[${nome}]`);
}

// ============================================================
// 5. CONFIGURAR WEBHOOK
// POST /webhook/set/{instanceName}
// ============================================================
export async function configurarWebhook(
  nome: string,
  serverUrl: string,
  apiKey: string,
  webhookUrl: string
): Promise<EvolutionResult> {
  const url = `${serverUrl.replace(/\/$/, '')}/webhook/set/${encodeURIComponent(nome)}`;
  return safeFetch(url, {
    method: 'POST',
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
        'QRCODE_UPDATED',
      ],
    }),
  }, `ConfigurarWebhook[${nome}]`);
}

// ============================================================
// 6. ENVIAR MENSAGEM DE TEXTO
// POST /message/sendText/{instanceName}
// ============================================================
export async function enviarMensagemTexto(
  nome: string,
  serverUrl: string,
  apiKey: string,
  telefone: string,
  mensagem: string
): Promise<EvolutionResult> {
  // Normaliza telefone: apenas dígitos
  const telLimpo = telefone.replace(/\D/g, '');

  const url = `${serverUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(nome)}`;
  return safeFetch(url, {
    method: 'POST',
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      number: telLimpo,
      text: mensagem,
    }),
  }, `EnviarMensagem[${nome}→${telLimpo}]`);
}

// ============================================================
// 7. BUSCAR QR CODE (se já gerado)
// GET /instance/fetchInstances com filtro
// ============================================================
export async function buscarQrCode(
  nome: string,
  serverUrl: string,
  apiKey: string
): Promise<EvolutionResult<{ qrcode?: { base64?: string; code?: string } }>> {
  const url = `${serverUrl.replace(/\/$/, '')}/instance/fetchInstances`;
  const result = await safeFetch<unknown[]>(url, {
    method: 'GET',
    headers: makeHeaders(apiKey),
  }, `BuscarQrCode[${nome}]`);

  if (!result.ok || !Array.isArray(result.data)) return result as EvolutionResult<never>;

  const instancia = result.data.find(
    (i): i is { instance: { instanceName: string }; qrcode?: unknown } =>
      typeof i === 'object' && i !== null &&
      'instance' in i &&
      typeof (i as { instance?: { instanceName?: unknown } }).instance?.instanceName === 'string' &&
      (i as { instance: { instanceName: string } }).instance.instanceName === nome
  );

  if (!instancia) {
    return { ok: false, error: `Instância "${nome}" não encontrada` };
  }

  return {
    ok: true,
    data: { qrcode: instancia.qrcode as { base64?: string; code?: string } | undefined },
  };
}
