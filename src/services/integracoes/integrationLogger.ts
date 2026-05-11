/**
 * integrationLogger.ts
 * Serviço para registro de logs de integrações (local e Supabase)
 * Não salva dados sensíveis (API keys, tokens, senhas)
 */

export type IntegrationType = 'supabase' | 'mapbox' | 'evolution' | 'n8n' | 'groq' | 'gemini' | 'whatsapp' | 'zoho' | 'other';

export interface IntegrationLogEntry {
  id?: string;
  tipo_integracao: IntegrationType;
  acao: string;
  status: 'sucesso' | 'erro' | 'aviso' | 'teste';
  mensagem: string;
  payload_resumido?: Record<string, unknown>;
  erro_detalhes?: string;
  data_hora?: string;
  duracao_ms?: number;
}

// Chaves que nunca devem ser logadas
const SENSITIVE_KEYS = [
  'apikey', 'api_key', 'api-key', 'token', 'secret', 'password', 'senha',
  'authorization', 'auth', 'key', 'chave', 'client_secret', 'VITE_GROQ_API_KEY',
  'VITE_GEMINI_API_KEY', 'VITE_EVOLUTION_API_KEY', 'VITE_MAPBOX_ACCESS_TOKEN',
  'VITE_MAPBOX_TOKEN', 'ZOHO_CLIENT_SECRET'
];

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(payload)) {
    const keyLower = key.toLowerCase();
    
    // Pular chaves sensíveis
    if (SENSITIVE_KEYS.some(sk => keyLower.includes(sk))) {
      sanitized[key] = '***REDACTED***';
      continue;
    }
    
    // Truncar strings longas
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.substring(0, 200) + '...[truncado]';
      continue;
    }
    
    // Não logar objetos aninhados profundos
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = '[objeto]';
      continue;
    }
    
    sanitized[key] = value;
  }
  
  return sanitized;
}

function getLocalLogs(): IntegrationLogEntry[] {
  try {
    const logs = localStorage.getItem('integration_logs');
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
}

function saveLocalLogs(logs: IntegrationLogEntry[]): void {
  try {
    // Manter apenas os últimos 100 logs
    const toSave = logs.slice(-100);
    localStorage.setItem('integration_logs', JSON.stringify(toSave));
  } catch {}
}

export async function registrarLog(params: {
  tipo: IntegrationType;
  acao: string;
  status: 'sucesso' | 'erro' | 'aviso' | 'teste';
  mensagem: string;
  payload?: Record<string, unknown>;
  erro?: unknown;
  duracaoMs?: number;
}): Promise<void> {
  const entry: IntegrationLogEntry = {
    tipo_integracao: params.tipo,
    acao: params.acao,
    status: params.status,
    mensagem: params.mensagem,
    data_hora: new Date().toISOString(),
    duracao_ms: params.duracaoMs,
  };

  // Sanitizar payload
  if (params.payload) {
    entry.payload_resumido = sanitizePayload(params.payload);
  }

  // Extrair mensagem de erro
  if (params.erro) {
    if (params.erro instanceof Error) {
      entry.erro_detalhes = params.erro.message;
    } else if (typeof params.erro === 'string') {
      entry.erro_detalhes = params.erro;
    } else if (typeof params.erro === 'object' && params.erro !== null) {
      entry.erro_detalhes = JSON.stringify(params.erro).substring(0, 500);
    }
  }

  // Salvar localmente
  const localLogs = getLocalLogs();
  localLogs.push(entry);
  saveLocalLogs(localLogs);

  // Tentar salvar no Supabase (fire-and-forget)
  try {
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('integration_logs').insert([{
      tipo_integracao: entry.tipo_integracao,
      acao: entry.acao,
      status: entry.status,
      mensagem: entry.mensagem,
      payload_resumido: entry.payload_resumido,
      erro_detalhes: entry.erro_detalhes,
      duracao_ms: entry.duracao_ms,
    }]);
  } catch {
    // Falha silenciosa — log local já foi salvo
  }
}

export async function buscarLogsLocais(): Promise<IntegrationLogEntry[]> {
  return getLocalLogs().reverse(); // Mais recentes primeiro
}

export async function buscarLogsSupabase(): Promise<IntegrationLogEntry[]> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase
      .from('integration_logs')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(100);
    
    if (error) {
      console.warn('[Logs] Erro ao buscar no Supabase:', error.message);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.warn('[Logs] Falha ao acessar Supabase:', e);
    return [];
  }
}

export async function limparLogsLocais(): Promise<void> {
  localStorage.removeItem('integration_logs');
}
