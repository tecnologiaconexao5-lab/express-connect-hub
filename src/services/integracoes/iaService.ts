import { aiProviderManager } from "../ia/aiProviderManager";

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

export async function testarGroq(apiKey: string): Promise<IAResult> {
  const t0 = Date.now();
  try {
    const res = await aiProviderManager.testGroq(apiKey, "llama3-8b-8192");
    return { ok: true, latencyMs: Date.now() - t0, data: res };
  } catch (e: any) {
    return { ok: false, error: e.message, latencyMs: Date.now() - t0 };
  }
}

export async function testarGemini(apiKey: string): Promise<IAResult> {
  const t0 = Date.now();
  try {
    const res = await aiProviderManager.testGemini(apiKey, "gemini-1.5-pro");
    return { ok: true, latencyMs: Date.now() - t0, data: res };
  } catch (e: any) {
    return { ok: false, error: e.message, latencyMs: Date.now() - t0 };
  }
}

export async function sugerirValorFrete(distanciaKm: number, pesoKg: number): Promise<number> {
  const prompt = `Sugira um valor de frete BRL para ${distanciaKm}km e ${pesoKg}kg. Retorne apenas o número (ex: 150.50).`;
  const res = await gerarRespostaIA({ prompt, contexto: "Logística" });
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
  const prompt = `Faça um resumo operacional em 1 frase para esta OS: ${JSON.stringify(osData)}`;
  const res = await gerarRespostaIA({ prompt, contexto: "Operacional TMS" });
  return res.data || "";
}

export async function registrarLogIA(provider: string, prompt: string, resposta: string, tokens: number = 0, success: boolean = true) {
  return await aiProviderManager.registrarLogIA(provider, "default", "generate", prompt, resposta, tokens, success);
}
