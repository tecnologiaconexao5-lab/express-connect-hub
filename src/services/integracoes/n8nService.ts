/**
 * n8nService.ts
 * Serviço para integração com n8n
 * Todas as funções retornam { ok, data?, error? }
 * Nenhuma chave é exposta no console em produção.
 */

export interface N8NResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// ============================================================
// 1. VALIDAR CONFIGURAÇÃO
// ============================================================
export function validateN8nConfig(): { ok: boolean; error?: string } {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  const apiUrl = import.meta.env.VITE_N8N_API_URL;

  if (!webhookUrl && !apiUrl) {
    return { ok: false, error: 'Nenhuma URL do n8n configurada. Defina VITE_N8N_WEBHOOK_URL ou VITE_N8N_API_URL no .env' };
  }

  if (webhookUrl && typeof webhookUrl === 'string' && !webhookUrl.startsWith('http')) {
    return { ok: false, error: 'VITE_N8N_WEBHOOK_URL inválida. Deve começar com http:// ou https://' };
  }

  if (apiUrl && typeof apiUrl === 'string' && !apiUrl.startsWith('http')) {
    return { ok: false, error: 'VITE_N8N_API_URL inválida. Deve começar com http:// ou https://' };
  }

  return { ok: true };
}

// ============================================================
// 2. TESTAR CONEXÃO
// ============================================================
export async function testN8nConnection(): Promise<N8NResult> {
  const config = validateN8nConfig();
  if (!config.ok) {
    return { ok: false, error: config.error };
  }

  const apiUrl = import.meta.env.VITE_N8N_API_URL;
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

  const urlToTest = apiUrl || webhookUrl;
  
  try {
    console.log(`[N8N] Testando conexão: ${urlToTest}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(urlToTest, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => `HTTP ${res.status}`);
      console.warn(`[N8N] Falhou: ${errorText}`);
      return { ok: false, error: `HTTP ${res.status}`, status: res.status };
    }

    console.log(`[N8N] Conexão OK`);
    return { ok: true, status: res.status };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro de conexão';
    console.error('[N8N] Exception:', msg);
    return { ok: false, error: msg };
  }
}

// ============================================================
// 3. DISPARAR WORKFLOW
// ============================================================
export async function triggerN8nWorkflow(
  payload: Record<string, unknown>
): Promise<N8NResult> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return { ok: false, error: 'VITE_N8N_WEBHOOK_URL não configurada' };
  }

  try {
    console.log(`[N8N] Disparando workflow: ${webhookUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        source: 'tms-frontend',
        ...payload,
      }),
    });

    clearTimeout(timeoutId);

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.warn(`[N8N] Workflow falhou: HTTP ${res.status}`);
      return { ok: false, error: `HTTP ${res.status}`, status: res.status, data };
    }

    console.log(`[N8N] Workflow disparado com sucesso`);
    return { ok: true, data, status: res.status };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro de conexão';
    console.error('[N8N] Exception:', msg);
    return { ok: false, error: msg };
  }
}

// ============================================================
// 4. DISPARAR WORKFLOW DE ORDEM DE SERVIÇO
// ============================================================
export async function triggerN8nWorkflowOS(osData: {
  osId: string;
  numero: string;
  cliente: string;
  prestador?: string;
  origem?: string;
  destino?: string;
  km?: number;
  tipoVeiculo?: string;
  valorCliente?: number;
  valorPrestador?: number;
  status: string;
}): Promise<N8NResult> {
  const specificWebhook = import.meta.env.VITE_N8N_WEBHOOK_OS;
  
  // Se houver um webhook específico para OS, usa ele diretamente via triggerN8nWorkflow
  // Caso contrário, usa o genérico VITE_N8N_WEBHOOK_URL
  if (specificWebhook) {
    try {
      console.log(`[N8N] Usando webhook específico para OS: ${specificWebhook}`);
      const res = await fetch(specificWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoEvento: 'OS_CRIADA',
          timestamp: new Date().toISOString(),
          ...osData
        }),
      });
      return { ok: res.ok, status: res.status };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  return triggerN8nWorkflow({
    evento: 'ordem_servico',
    os: osData,
  });
}

// ============================================================
// 5. DISPARAR WORKFLOW DE COTAÇÃO/ORÇAMENTO
// ============================================================
export async function triggerN8nWorkflowCotacao(cotacaoData: {
  id?: string;
  cliente: string;
  origem: string;
  destino: string;
  tipoVeiculo?: string;
  valorEstimado?: number;
}): Promise<N8NResult> {
  return triggerN8nWorkflow({
    evento: 'cotacao',
    cotacao: cotacaoData,
  });
}

// ============================================================
// 6. DISPARAR WORKFLOW DE RECADASTRAMENTO
// ============================================================
export async function triggerN8nWorkflowRecadastramento(prestadorData: {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
}): Promise<N8NResult> {
  return triggerN8nWorkflow({
    evento: 'recadastramento',
    prestador: prestadorData,
  });
}
