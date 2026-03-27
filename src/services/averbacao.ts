// src/services/averbacao.ts
import { supabase } from "@/lib/supabase";

export interface AverbacaoResponse {
  success: boolean;
  nAverbacao?: string;
  premioCalculado?: number;
  erro?: string;
}

// Log Integraçao Seguradora
async function logIntegration(name: string, endpoint: string, method: string, status: number, req: any, res: any, latency: number, osId?: string, errorMsg?: string) {
  try {
    await supabase.from("integration_logs").insert([{
      integration_name: name,
      endpoint: endpoint,
      method: method,
      status_code: status,
      request_payload: req,
      response_payload: res,
      latency_ms: latency,
      os_id: osId,
      error_message: errorMsg
    }]);
  } catch (e) {
    console.error("Failed to log averbação API", e);
  }
}

export async function averbarCarga(osId: string, valorNf: number, origem: string, destino: string, tipoCarga: string, veiculo: string, prestador: string): Promise<AverbacaoResponse> {
  const start = Date.now();
  
  await new Promise(r => setTimeout(r, 600)); // Latência webservice ATMS
  
  const payload = { osId, valorNf, origem, destino, tipoCarga, veiculo, prestador };
  
  // Risco excedido limite / Falha Susep simulada
  if (Math.random() > 0.95 || valorNf > 2000000) {
    const errorMsg = "Limite Máximo de Indenização (LMI) excedido para esta Rota.";
    await logIntegration("SEGURO_ATMS", "https://ws.portoseguro.com.br/averbacoes", "POST", 400, payload, { error: errorMsg }, Date.now() - start, osId, errorMsg);
    return { success: false, erro: errorMsg };
  }

  // Premio estimado 0.03% do valor (ad valorem)
  const premioCalculado = (valorNf * 0.0003).toFixed(2);
  const nAverbacao = "AV-" + Math.floor(Math.random() * 100000000).toString();
  
  const result = { nAverbacao, premioCalculado: parseFloat(premioCalculado) };

  await logIntegration("SEGURO_ATMS", "https://ws.portoseguro.com.br/averbacoes", "POST", 200, payload, result, Date.now() - start, osId);

  // Se houvesse ambiente DB real: atualizaria a OS para "Averbado ✅" e salvaria na tabela averbacoes.
  return { success: true, ...result };
}
