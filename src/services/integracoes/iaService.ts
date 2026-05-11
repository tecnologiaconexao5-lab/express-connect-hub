/**
 * iaService.ts (versão corrigida e blindada)
 * Serviço de IA para o TMS Conexão Express
 * Suporta: Groq (principal) e Gemini (alternativa)
 * Nenhuma chave API é exposta no console em produção.
 */

export interface IAResult {
  ok: boolean;
  data?: string;
  error?: string;
  provider?: string;
  latencyMs?: number;
}

// ============================================================
// Helpers internos
// ============================================================

function maskKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// ============================================================
// 1. TESTAR GROQ
// Endpoint: https://api.groq.com/openai/v1/chat/completions
// ============================================================
export async function testarGroq(apiKey: string): Promise<IAResult> {
  if (!apiKey?.trim()) return { ok: false, error: 'API Key Groq não informada' };

  const t0 = Date.now();
  console.log(`[IA/Groq] Testando conexão com chave ${maskKey(apiKey)}`);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      const msg = err?.error?.message || `HTTP ${res.status}`;
      console.warn(`[IA/Groq] Falhou: ${msg}`);
      return { ok: false, error: msg, provider: 'groq', latencyMs };
    }

    const data = await res.json();
    const resposta = data?.choices?.[0]?.message?.content || 'OK';
    console.log(`[IA/Groq] OK em ${latencyMs}ms`);
    return { ok: true, data: resposta, provider: 'groq', latencyMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro de conexão';
    console.error('[IA/Groq] Exception:', msg);
    return { ok: false, error: msg, provider: 'groq' };
  }
}

// ============================================================
// 2. TESTAR GEMINI
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
// ============================================================
export async function testarGemini(apiKey: string): Promise<IAResult> {
  if (!apiKey?.trim()) return { ok: false, error: 'API Key Gemini não informada' };

  const t0 = Date.now();
  console.log(`[IA/Gemini] Testando conexão com chave ${maskKey(apiKey)}`);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      const msg = err?.error?.message || `HTTP ${res.status}`;
      console.warn(`[IA/Gemini] Falhou: ${msg}`);
      return { ok: false, error: msg, provider: 'gemini', latencyMs };
    }

    const data = await res.json();
    const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'OK';
    console.log(`[IA/Gemini] OK em ${latencyMs}ms`);
    return { ok: true, data: resposta, provider: 'gemini', latencyMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro de conexão';
    console.error('[IA/Gemini] Exception:', msg);
    return { ok: false, error: msg, provider: 'gemini' };
  }
}

// ============================================================
// 3. GERAR RESPOSTA VIA IA
// provider: 'groq' | 'gemini'
// ============================================================
export interface GerarRespostaParams {
  provider: 'groq' | 'gemini';
  apiKey: string;
  prompt: string;
  contexto?: string;
  maxTokens?: number;
}

export async function gerarRespostaIA(params: GerarRespostaParams): Promise<IAResult> {
  const { provider, apiKey, prompt, contexto, maxTokens = 500 } = params;

  if (!apiKey?.trim()) {
    return { ok: false, error: `API Key ${provider} não informada`, provider };
  }

  const systemMsg = contexto
    ? `Você é o assistente da Conexão Express TMS. Contexto: ${contexto}`
    : 'Você é o assistente da Conexão Express TMS. Seja conciso e profissional.';

  if (provider === 'groq') {
    return gerarRespostaGroq(apiKey, systemMsg, prompt, maxTokens);
  } else {
    return gerarRespostaGemini(apiKey, systemMsg, prompt, maxTokens);
  }
}

async function gerarRespostaGroq(
  apiKey: string,
  system: string,
  userPrompt: string,
  maxTokens: number
): Promise<IAResult> {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      return { ok: false, error: err?.error?.message || `HTTP ${res.status}`, provider: 'groq', latencyMs };
    }

    const data = await res.json();
    const resposta = data?.choices?.[0]?.message?.content || '';
    return { ok: true, data: resposta, provider: 'groq', latencyMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro de conexão';
    return { ok: false, error: msg, provider: 'groq' };
  }
}

async function gerarRespostaGemini(
  apiKey: string,
  system: string,
  userPrompt: string,
  _maxTokens: number
): Promise<IAResult> {
  const t0 = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const fullPrompt = `${system}\n\nUsuário: ${userPrompt}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: _maxTokens, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
      return { ok: false, error: err?.error?.message || `HTTP ${res.status}`, provider: 'gemini', latencyMs };
    }

    const data = await res.json();
    const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { ok: true, data: resposta, provider: 'gemini', latencyMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro de conexão';
    return { ok: false, error: msg, provider: 'gemini' };
  }
}

// ============================================================
// 4. FUNÇÕES DE NEGÓCIO (COM FALLBACK)
// ============================================================

export async function gerarMensagemComercial(dadosCliente: {
  nome: string;
  empresa?: string;
  origem?: string;
  destino?: string;
  tipoVeiculo?: string;
  valorEstimado?: number;
}): Promise<string> {
  const prompt = `Gere uma mensagem comercial para ${dadosCliente.nome} da empresa ${dadosCliente.empresa || 'N/A'}. 
  Rota: ${dadosCliente.origem || 'N/A'} → ${dadosCliente.destino || 'N/A'}. 
  Veículo: ${dadosCliente.tipoVeiculo || 'N/A'}. 
  Valor estimado: R$ ${dadosCliente.valorEstimado?.toFixed(2) || 'N/A'}.
  Seja profissional e acolhedor. Máximo 200 caracteres.`;

  const apiKey = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  const provider = import.meta.env.VITE_AI_PROVIDER || 'groq';

  if (!apiKey) {
    return `Olá ${dadosCliente.nome}! Obrigado pelo interesse na Conexão Express. Em breve retornaremos com sua cotação.`;
  }

  const result = await gerarRespostaIA({
    provider: provider as 'groq' | 'gemini',
    apiKey,
    prompt,
    maxTokens: 200,
  });

  return result.ok ? result.data || '' : `Olá ${dadosCliente.nome}! Sua cotação para ${dadosCliente.origem} → ${dadosCliente.destino} está pronta.`;
}

export async function gerarMensagemPrestador(dadosPrestador: {
  nome: string;
  tipoOperacao?: string;
  dataProgramada?: string;
  valor?: number;
}): Promise<string> {
  const prompt = `Gere uma mensagem para o prestador ${dadosPrestador.nome}.
  Operação: ${dadosPrestador.tipoOperacao || 'entrega'}.
  Data: ${dadosPrestador.dataProgramada || 'a combinar'}.
  Valor: R$ ${dadosPrestador.valor?.toFixed(2) || 'N/A'}.
  Seja direto e motivate. Máximo 150 caracteres.`;

  const apiKey = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  const provider = import.meta.env.VITE_AI_PROVIDER || 'groq';

  if (!apiKey) {
    return `Olá ${dadosPrestador.nome}! Você tem uma nova ordem de serviço agendada. Acesse o app para mais detalhes.`;
  }

  const result = await gerarRespostaIA({
    provider: provider as 'groq' | 'gemini',
    apiKey,
    prompt,
    maxTokens: 150,
  });

  return result.ok ? result.data || '' : `Olá ${dadosPrestador.nome}! Nova OS disponível. Acesse o app para aceitar.`;
}

export async function gerarResumoOperacional(dadosOS: {
  numero: string;
  cliente: string;
  origem: string;
  destino: string;
  status: string;
  prestador?: string;
}): Promise<string> {
  const prompt = `Resuma a OS ${dadosOS.numero} para o cliente ${dadosOS.cliente}.
  Rota: ${dadosOS.origem} → ${dadosOS.destino}.
  Status: ${dadosOS.status}.
  Prestador: ${dadosOS.prestador || 'Não atribuído'}.
  Seja informativo e conciso. Máximo 200 caracteres.`;

  const apiKey = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  const provider = import.meta.env.VITE_AI_PROVIDER || 'groq';

  if (!apiKey) {
    return `OS ${dadosOS.numero}: ${dadosOS.status}. Cliente: ${dadosOS.cliente}. Rota: ${dadosOS.origem} → ${dadosOS.destino}.`;
  }

  const result = await gerarRespostaIA({
    provider: provider as 'groq' | 'gemini',
    apiKey,
    prompt,
    maxTokens: 200,
  });

  return result.ok ? result.data || '' : `OS ${dadosOS.numero}: ${dadosOS.status}. Rota: ${dadosOS.origem} → ${dadosOS.destino}.`;
}

// ============================================================
// 5. LOG IA NO SUPABASE (fire-and-forget, não bloqueia)
// ============================================================
export async function registrarLogIA(params: {
  provider: string;
  origem?: string;
  telefone?: string;
  prompt?: string;
  resposta?: string;
  rawPayload?: unknown;
}): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('ia_logs').insert([{
      provider: params.provider,
      origem: params.origem,
      telefone: params.telefone,
      prompt: params.prompt,
      resposta: params.resposta,
      raw_payload: params.rawPayload,
    }]);
  } catch (e) {
    console.warn('[IA] Falha ao registrar log:', e);
  }
}

// ============================================================
// 6. VALIDAÇÃO DE CONFIGURAÇÃO
// ============================================================
export function validateAIConfig(): { ok: boolean; provider?: string; error?: string } {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const provider = import.meta.env.VITE_AI_PROVIDER || 'groq';

  if (provider === 'groq' && !groqKey) {
    return { ok: false, provider: 'groq', error: 'Groq selecionado mas VITE_GROQ_API_KEY não configurada' };
  }
  if (provider === 'gemini' && !geminiKey) {
    return { ok: false, provider: 'gemini', error: 'Gemini selecionado mas VITE_GEMINI_API_KEY não configurada' };
  }
  if (provider !== 'groq' && provider !== 'gemini') {
    return { ok: false, error: `Provider inválido: ${provider}. Use 'groq' ou 'gemini'` };
  }
  return { ok: true, provider };
}

// ============================================================
  // COMPATIBILIDADE: export iaService (objeto legado)
  // Mantém compatibilidade com imports antigos
  // ============================================================
  export const iaService = {
    sugerirValorFrete,
    interpretarMensagemCliente: async (mensagem: string) => {
      const isCotacao = mensagem.toLowerCase().includes('frete') || mensagem.toLowerCase().includes('cotação');
      return {
        intencao: isCotacao ? 'solicitacao_cotacao' : 'duvida_geral',
        entidadesExtraidas: { origem: null, destino: null, urgencia: 'normal' },
        sentimento: 'neutro',
      };
    },

    gerarResposta: async (_contexto: unknown) => {
      return 'Olá! Recebemos sua solicitação. Um especialista irá analisá-la em breve.';
    },
  };

  // ============================================================
  // FUNÇÃO EXPORTÁVEL: Sugerir valor de frete
  // ============================================================
  export async function sugerirValorFrete(origem: string, destino: string, tipoVeiculo: string): Promise<{ valorSugerido: number; confiancaIA: number; motivo: string }> {
    const prompt = `Calcule o valor estimado de frete para transporte de cargas.
    Rota: ${origem} → ${destino}
    Tipo de veículo: ${tipoVeiculo}
    Considere: distância, tipo de carga, pedagios, combustível e margem.
    Retorne apenas o valor numérico (sem R$) e uma justificativa breve.`;

    const apiKey = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    const provider = import.meta.env.VITE_AI_PROVIDER || 'groq';

    if (!apiKey) {
      let base = 500;
      if (tipoVeiculo === 'VUC' || tipoVeiculo === '3/4') base = 1200;
      if (tipoVeiculo === 'CARRETA') base = 3500;
      return { valorSugerido: base * 1.35, confiancaIA: 0.5, motivo: 'Cálculo automático via fallback' };
    }

    try {
      const result = await gerarRespostaIA({
        provider: provider as 'groq' | 'gemini',
        apiKey,
        prompt,
        maxTokens: 100,
      });

      if (result.ok && result.data) {
        const match = result.data.match(/(\d+(?:\.\d+)?)/);
        const valor = match ? parseFloat(match[1]) : 0;
        return { valorSugerido: valor || 500, confiancaIA: 0.85, motivo: 'Estimativa via IA' };
      }
    } catch (e) {
      console.warn('[IA] Erro ao sugerir valor:', e);
    }

    let base = 500;
    if (tipoVeiculo === 'VUC' || tipoVeiculo === '3/4') base = 1200;
    if (tipoVeiculo === 'CARRETA') base = 3500;
    return { valorSugerido: base * 1.35, confiancaIA: 0.5, motivo: 'Cálculo automático via fallback' };
  }
