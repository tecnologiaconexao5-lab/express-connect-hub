import { aiProviderManager } from "../ia/aiProviderManager";
import { proxyIaClient } from "../ia/proxyIaClient";

export interface IAResult {
  ok: boolean;
  data?: string;
  error?: string;
  provider?: string;
  latencyMs?: number;
}

export async function gerarRespostaIA({
  prompt,
  contexto = ""
}: {
  provider?: string;
  apiKey?: string;
  prompt: string;
  contexto?: string;
}): Promise<IAResult> {
  const t0 = Date.now();
  try {
    const data = await aiProviderManager.gerarRespostaComFallback(prompt, contexto);
    return { ok: true, data, latencyMs: Date.now() - t0 };
  } catch (error: any) {
    return { ok: false, error: error.message || "Erro desconhecido na IA", latencyMs: Date.now() - t0 };
  }
}

export async function testarGroq(): Promise<IAResult> {
  const t0 = Date.now();
  try {
    const resultado = await proxyIaClient.executar({
      provider: "groq",
      model: "llama-3.1-8b-instant",
      prompt: "Ping",
      max_tokens: 10,
    });
    if (resultado.sucesso) {
      return { ok: true, latencyMs: Date.now() - t0, data: resultado.resposta };
    }
    return { ok: false, error: resultado.erro || "Falha", latencyMs: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, error: e.message, latencyMs: Date.now() - t0 };
  }
}

export async function testarGemini(): Promise<IAResult> {
  const t0 = Date.now();
  try {
    const resultado = await proxyIaClient.executar({
      provider: "gemini",
      model: "gemini-1.5-pro",
      prompt: "Ping",
      max_tokens: 10,
    });
    if (resultado.sucesso) {
      return { ok: true, latencyMs: Date.now() - t0, data: resultado.resposta };
    }
    return { ok: false, error: resultado.erro || "Falha", latencyMs: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, error: e.message, latencyMs: Date.now() - t0 };
  }
}

export async function sugerirValorFrete(distanciaKm: number, pesoKg: number): Promise<number> {
  const prompt = `Sugira um valor de frete BRL para ${distanciaKm}km e ${pesoKg}kg. Retorne apenas o numero (ex: 150.50).`;
  const res = await gerarRespostaIA({ prompt, contexto: "Logistica" });
  if (res.ok && res.data) {
    const v = parseFloat(res.data.replace(/[^0-9.]/g, ''));
    if (!isNaN(v)) return v;
  }
  return 0;
}

export async function gerarMensagemComercial(cliente: string, valor: number): Promise<string> {
  const prompt = `Gere uma mensagem comercial curta oferecendo frete a ${valor} para o cliente ${cliente}.`;
  const res = await gerarRespostaIA({ prompt, contexto: "Vendas" });
  return res.data || "";
}

export async function gerarResumoOperacional(osData: any): Promise<string> {
  const prompt = `Fac,a um resumo operacional em 1 frase para esta OS: ${JSON.stringify(osData)}`;
  const res = await gerarRespostaIA({ prompt, contexto: "Operacional TMS" });
  return res.data || "";
}

export async function registrarLogIA(provider: string, prompt: string, resposta: string, tokens: number = 0, success: boolean = true) {
  return await aiProviderManager.registrarLogIA(provider, "default", "generate", prompt, resposta, tokens, success);
}
