/**
 * evolutionApiService.ts (versão blindada)
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

// ============================================================
// HELPERS
// ============================================================
function makeHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'apikey': apiKey,
  };
}

function getEvolutionConfig(): { url?: string; apiKey?: string; instance?: string; error?: string } {
  const url = import.meta.env.VITE_EVOLUTION_API_URL || import.meta.env.VITE_EVOLUTION_SERVER_URL;
  const apiKey = import.meta.env.VITE_EVOLUTION_API_KEY;
  const instance = import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || import.meta.env.VITE_EVOLUTION_INSTANCE;

  if (!url) return { error: 'VITE_EVOLUTION_API_URL não configurada' };
  if (!apiKey) return { error: 'VITE_EVOLUTION_API_KEY não configurada' };
  if (!instance) return { error: 'VITE_EVOLUTION_INSTANCE_NAME não configurada' };

  return { url, apiKey, instance };
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
      signal: AbortSignal.timeout(10000),
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
// 1. VALIDAR CONFIGURAÇÃO
// ============================================================
export function validateEvolutionConfig(): { ok: boolean; error?: string } {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };
  return { ok: true };
}

// ============================================================
// 2. TESTAR CONEXÃO (fetchInstances)
// ============================================================
export async function checkEvolutionStatus(): Promise<EvolutionResult> {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };

  const url = `${config.url!.replace(/\/$/, '')}/instance/fetchInstances`;
  return safeFetch(url, {
    method: 'GET',
    headers: makeHeaders(config.apiKey!),
  }, 'CheckStatus');
}

// ============================================================
// 3. STATUS DA INSTÂNCIA
// ============================================================
export async function getInstanceStatus(): Promise<EvolutionResult> {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };

  const url = `${config.url!.replace(/\/$/, '')}/instance/connectionState/${encodeURIComponent(config.instance!)}`;
  return safeFetch(url, {
    method: 'GET',
    headers: makeHeaders(config.apiKey!),
  }, 'GetInstanceStatus');
}

// ============================================================
// 4. ENVIAR MENSAGEM DE TEXTO
// ============================================================
export async function sendWhatsAppMessage(
  numero: string,
  mensagem: string
): Promise<EvolutionResult> {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };

  // Normaliza telefone: apenas dígitos
  const telLimpo = numero.replace(/\D/g, '');

  const url = `${config.url!.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(config.instance!)}`;
  return safeFetch(url, {
    method: 'POST',
    headers: makeHeaders(config.apiKey!),
    body: JSON.stringify({
      number: telLimpo,
      text: mensagem,
    }),
  }, `SendMessage[${config.instance}→${telLimpo}]`);
}

// ============================================================
// 5. CRIAR INSTÂNCIA
// ============================================================
export async function criarInstancia(
  nome?: string
): Promise<EvolutionResult> {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };

  const instanceName = nome || config.instance!;
  const url = `${config.url!.replace(/\/$/, '')}/instance/create`;
  return safeFetch(url, {
    method: 'POST',
    headers: makeHeaders(config.apiKey!),
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  }, `CriarInstancia[${instanceName}]`);
}

// ============================================================
// 6. CONECTAR INSTÂNCIA (gerar QR Code)
// ============================================================
export async function conectarInstancia(
  nome?: string
): Promise<EvolutionResult> {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };

  const instanceName = nome || config.instance!;
  const url = `${config.url!.replace(/\/$/, '')}/instance/connect/${encodeURIComponent(instanceName)}`;
  return safeFetch(url, {
    method: 'GET',
    headers: makeHeaders(config.apiKey!),
  }, `ConectarInstancia[${instanceName}]`);
}

// ============================================================
// 7. BUSCAR QR CODE
// ============================================================
export async function buscarQrCode(
  nome?: string
): Promise<EvolutionResult<{ qrcode?: { base64?: string; code?: string } }>> {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };

  const instanceName = nome || config.instance!;
  const url = `${config.url!.replace(/\/$/, '')}/instance/fetchInstances`;
  const result = await safeFetch<unknown[]>(url, {
    method: 'GET',
    headers: makeHeaders(config.apiKey!),
  }, `BuscarQrCode[${instanceName}]`);

  if (!result.ok || !Array.isArray(result.data)) return result as EvolutionResult<never>;

  const instancia = result.data.find(
    (i): i is { instance: { instanceName: string }; qrcode?: unknown } =>
      typeof i === 'object' && i !== null &&
      'instance' in i &&
      typeof (i as { instance?: { instanceName?: unknown } }).instance?.instanceName === 'string' &&
      (i as { instance: { instanceName: string } }).instance.instanceName === instanceName
  );

  if (!instancia) {
    return { ok: false, error: `Instância "${instanceName}" não encontrada` };
  }

  return {
    ok: true,
    data: { qrcode: instancia.qrcode as { base64?: string; code?: string } | undefined },
  };
}

// ============================================================
// 8. CONFIGURAR WEBHOOK
// ============================================================
export async function configurarWebhook(
  webhookUrl: string,
  nome?: string
): Promise<EvolutionResult> {
  const config = getEvolutionConfig();
  if (config.error) return { ok: false, error: config.error };

  const instanceName = nome || config.instance!;
  const url = `${config.url!.replace(/\/$/, '')}/webhook/set/${encodeURIComponent(instanceName)}`;
  return safeFetch(url, {
    method: 'POST',
    headers: makeHeaders(config.apiKey!),
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
  }, `ConfigurarWebhook[${instanceName}]`);
}
