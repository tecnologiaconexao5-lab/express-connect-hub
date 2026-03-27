// src/services/ciot.ts
import { supabase } from "@/lib/supabase";

export interface CiotResponse {
  success: boolean;
  nCiot?: string;
  dataEmissao?: string;
  erro?: string;
}

// Helper para Log
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
    console.error("Failed to log integration", e);
  }
}

export async function gerarCiot(dadosViagem: any, prestador: any, dadosEmpresa: any): Promise<CiotResponse> {
  const start = Date.now();
  
  // Simulando latencia da ANTT / EFX
  await new Promise(r => setTimeout(r, 900));
  
  const payload = { ...dadosViagem, prestador_rntrc: prestador.rntrc, emissor_cnpj: dadosEmpresa.cnpj };
  
  if (Math.random() > 0.95) {
    const errorMsg = "Bloqueio ANTT: RNTRC do prestador suspenso.";
    await logIntegration("ANTT_CIOT", "https://api.efrete.com.br/ciot", "POST", 403, payload, { error: errorMsg }, Date.now() - start, dadosViagem.osId, errorMsg);
    return { success: false, erro: errorMsg };
  }

  const ciotNumber = Math.random().toString().slice(2, 14); // Gerar string random nciot
  
  const result = {
    nCiot: ciotNumber,
    dataEmissao: new Date().toISOString()
  };

  await logIntegration("ANTT_CIOT", "https://api.efrete.com.br/ciot", "POST", 200, payload, result, Date.now() - start, dadosViagem.osId);

  return { success: true, ...result };
}
