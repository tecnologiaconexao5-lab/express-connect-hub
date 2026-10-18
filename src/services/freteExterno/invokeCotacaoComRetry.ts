// ============================================================
// FIX-CRITICO-FINANCEIRO-E-COTACOES (W7)
// Invoke da Edge Function cotacao-frete com AbortSignal.timeout(8s)
// e 1 retry com backoff — evita travar o fluxo de cotação quando a
// Frenet/Edge demora ou falha. Suportado por @supabase/supabase-js
// >= 2.34 (FunctionInvokeOptions.signal).
// ============================================================
import { supabase } from "@/lib/supabase";

const TIMEOUT_MS = 8000;
const RETRY_BACKOFF_MS = 800;

export interface CotacaoFreteResposta {
  provedor: string;
  valor: number;
  prazo: number;
  /** FIX W8: true quando o preço é estimativa simulada (não cotação real) */
  isSimulation?: boolean;
}

export async function invokeCotacaoComRetry<T = CotacaoFreteResposta>(
  body: Record<string, unknown>,
  timeoutMs: number = TIMEOUT_MS
): Promise<T> {
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa <= 1; tentativa++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { data, error } = await supabase.functions.invoke("cotacao-frete", {
        body,
        signal: controller.signal,
      });

      if (error) {
        // AbortError vira error.message vazio em algumas versões — detecta timeout
        if (controller.signal.aborted) {
          throw new DOMException(`timeout ${timeoutMs}ms`, "TimeoutError");
        }
        throw new Error(error.message || "erro desconhecido");
      }
      if (!data) throw new Error("resposta vazia do servidor.");
      if (typeof data === "object" && "error" in data && data.error) {
        throw new Error(String(data.error));
      }
      return data as T;
    } catch (err) {
      ultimoErro = err;
      const motivo =
        (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) ||
        controller.signal.aborted
          ? `timeout ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : "erro";
      console.warn(`[frete] cotacao-frete tentativa ${tentativa + 1} falhou (${motivo})`);
      if (tentativa < 1) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    } finally {
      clearTimeout(timer);
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error("Falha ao cotar frete (timeout/rede após retry)");
}
