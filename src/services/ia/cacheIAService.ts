// Cache Inteligente para Respostas IA
// Evita chamadas repetidas para prompts idênticos em curto período
// Respeita tenant_id — não cacheia dados sensíveis por padrão

export interface CacheEntry {
  resposta: string;
  timestamp: number;
  tenant_id: string;
  tipo_tarefa: string;
  provider: string;
  model: string;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_CACHE_SIZE = 500;

// Tarefas que NÃO devem ser cacheadas (sensíveis ou únicas)
const TIPOS_SENSIVEIS = new Set([
  "auditoria",
  "decisao_critica",
  "diagnostico_operacional",
  "analise_financeira",
  "analise_documentos",
]);

// Gera chave única para o cache
function gerarChave(
  prompt: string,
  contexto: string,
  tenant_id: string,
  tipo_tarefa: string,
): string {
  const base = `${tipo_tarefa}|${tenant_id}|${prompt.trim()}|${contexto.trim()}`;
  // Hash simples (evita chaves muito longas)
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${tipo_tarefa}_${Math.abs(hash).toString(36)}`;
}

export const cacheIAService = {
  // Obtém resposta do cache se disponível
  obter(
    prompt: string,
    contexto: string,
    tenant_id: string,
    tipo_tarefa: string,
  ): string | null {
    // Não cachear tarefas sensíveis
    if (TIPOS_SENSIVEIS.has(tipo_tarefa)) return null;

    const chave = gerarChave(prompt, contexto, tenant_id, tipo_tarefa);
    const entry = cache.get(chave);

    if (!entry) return null;

    // Verificar TTL
    if (Date.now() - entry.timestamp > DEFAULT_TTL_MS) {
      cache.delete(chave);
      return null;
    }

    return entry.resposta;
  },

  // Armazena resposta no cache
  armazenar(
    prompt: string,
    contexto: string,
    tenant_id: string,
    tipo_tarefa: string,
    resposta: string,
    provider: string,
    model: string,
  ): void {
    // Não cachear tarefas sensíveis
    if (TIPOS_SENSIVEIS.has(tipo_tarefa)) return;

    // Limpar cache se exceder tamanho máximo
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldest = cache.entries().next().value;
      if (oldest) cache.delete(oldest[0]);
    }

    const chave = gerarChave(prompt, contexto, tenant_id, tipo_tarefa);
    cache.set(chave, {
      resposta,
      timestamp: Date.now(),
      tenant_id,
      tipo_tarefa,
      provider,
      model,
    });
  },

  // Limpar cache de um tenant específico
  limparPorTenant(tenant_id: string): void {
    for (const [chave, entry] of cache.entries()) {
      if (entry.tenant_id === tenant_id) {
        cache.delete(chave);
      }
    }
  },

  // Limpar cache inteiro
  limparTudo(): void {
    cache.clear();
  },

  // Estatísticas do cache
  estatisticas(): { tamanho: number; entradas: { tipo: string; count: number }[] } {
    const tipos = new Map<string, number>();
    for (const entry of cache.values()) {
      tipos.set(entry.tipo_tarefa, (tipos.get(entry.tipo_tarefa) || 0) + 1);
    }
    return {
      tamanho: cache.size,
      entradas: Array.from(tipos.entries()).map(([tipo, count]) => ({ tipo, count })),
    };
  },
};

export default cacheIAService;
