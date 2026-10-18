// Cliente para chamar a Edge Function proxy-ia (backend seguro)
// As chaves de API ficam APENAS no servidor (Supabase Secrets)
// Se a Edge Function não estiver disponível, cai em modo simulado

function getEnv(key: string): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key] as string;
    }
  } catch { /* fallback */ }
  try { return (process as any).env[key] || ""; } catch { return ""; }
}

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");
const PROXY_IA_URL = `${SUPABASE_URL}/functions/v1/proxy-ia`;
const DEFAULT_TIMEOUT = 30000;

export interface ProxyIaParams {
  provider: string;
  model: string;
  prompt: string;
  context?: string;
  temperature?: number;
  max_tokens?: number;
  tenant_id?: string;
  tipo_tarefa?: string;
  images?: { type: string; data: string }[];
}

export interface ProxyIaResult {
  sucesso: boolean;
  resposta: string;
  provider: string;
  model: string;
  tokens_entrada: number;
  tokens_saida: number;
  erro?: string;
}

async function chamarProxyIa(params: ProxyIaParams): Promise<ProxyIaResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Auth: usar anon key para autenticar no Supabase API Gateway
    // As chaves reais de IA ficam no backend (Supabase Secrets)
    if (SUPABASE_ANON_KEY) {
      headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const response = await fetch(PROXY_IA_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return {
        sucesso: false,
        resposta: "",
        provider: params.provider,
        model: params.model,
        tokens_entrada: 0,
        tokens_saida: 0,
        erro: `Proxy IA retornou HTTP ${response.status}: ${errorBody.substring(0, 200)}`,
      };
    }

    return await response.json();
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : "Erro de conexão";
    return {
      sucesso: false,
      resposta: "",
      provider: params.provider,
      model: params.model,
      tokens_entrada: 0,
      tokens_saida: 0,
      erro: `Proxy IA indisponível: ${errMsg}`,
    };
  }
}

export const proxyIaClient = {
  async executar(params: ProxyIaParams): Promise<ProxyIaResult> {
    return chamarProxyIa(params);
  },

  async testarConexao(provider: string): Promise<{ success: boolean; message: string }> {
    const resultado = await chamarProxyIa({
      provider,
      model: provider === "gemini" ? "gemini-2.0-flash" : "llama-3.1-8b-instant",
      prompt: "Ping",
      max_tokens: 10,
    });

    if (resultado.sucesso) {
      return { success: true, message: "Conexão com proxy-ia bem sucedida!" };
    }
    return { success: false, message: resultado.erro || "Falha na conexão com proxy-ia" };
  },
};

export default proxyIaClient;
