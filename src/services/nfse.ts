// src/services/nfse.ts
import { supabase } from "@/lib/supabase";

export interface NfseResponse {
  success: boolean;
  numero_nfse?: string;
  link_pdf?: string;
  erro?: string;
  codigo_erro?: number;
}

// Logging Fiscal ISS
async function logIntegration(name: string, endpoint: string, method: string, status: number, req: any, res: any, latency: number, entityId?: string, errorMsg?: string) {
  try {
    await supabase.from("integration_logs").insert([{
      integration_name: name,
      endpoint: endpoint,
      method: method,
      status_code: status,
      request_payload: req,
      response_payload: res,
      latency_ms: latency,
      os_id: entityId, // Can store invoice_id here instead
      error_message: errorMsg
    }]);
  } catch (e) {
    console.error("Failed to log NFSe API call", e);
  }
}

export async function emitirNFSe(faturaBase: any, tomadorCNPJ: string, valorServico: number, codMuinicipio: string): Promise<NfseResponse> {
  const start = Date.now();
  
  await new Promise(r => setTimeout(r, 1200)); // Webservice da Prefeitura
  
  const payload = { rps: `RPS-2026-${Math.floor(Math.random()*999)}`, tomadorCNPJ, valorServico, codMuinicipio };

  if (Math.random() > 0.90) {
    const errorMsg = "E160 - Erro na autenticação do Webservice Municipal (Senha / Certificado).";
    await logIntegration("WS_PREFEITURA_NFSE", `https://api.prefeitura.gov.br/${codMuinicipio}/nfse`, "POST", 401, payload, { error: errorMsg }, Date.now() - start, faturaBase.id, errorMsg);
    
    return { success: false, erro: errorMsg, codigo_erro: 160 };
  }

  // Success 
  const numeroNF = "NF-" + Math.floor(Math.random() * 100000);
  const result = {
    numero_nfse: numeroNF,
    link_pdf: `https://nfe.prefeitura.gov.br/nfse?doc=${numeroNF}`
  };

  await logIntegration("WS_PREFEITURA_NFSE", `https://api.prefeitura.gov.br/${codMuinicipio}/nfse`, "POST", 200, payload, result, Date.now() - start, faturaBase.id);

  return { success: true, ...result };
}
