// src/services/sefaz.ts
import { supabase } from "@/lib/supabase";

export interface SefazResponse {
  success: boolean;
  protocolo?: string;
  chaveAcesso?: string;
  xml?: string;
  erro?: string;
  codigo_erro?: number;
}

// Log Integration Calls
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

// Simulate Network Delay and Sefaz Response
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function emitirCTe(osData: any): Promise<SefazResponse> {
  const start = Date.now();
  await sleep(1500); // Sefaz latency simulation
  
  const payload = { ...osData, cfop: osData.interestadual ? '6351' : '5351' };
  
  // Simulating 10% chance of Sefaz error
  if (Math.random() > 0.9) {
    const errorMsg = "Rejeição: Valor do ICMS diferido não informado na prestação";
    await logIntegration("SEFAZ_CTE", "https://api.sefaz.gov.br/cte", "POST", 400, payload, { error: errorMsg }, Date.now() - start, osData.id, errorMsg);
    return { success: false, erro: errorMsg, codigo_erro: 504 };
  }

  const result = {
    protocolo: "135260001248882",
    chaveAcesso: "35260312345678000199570010000000011234567890",
    xml: "<cteProc><CTe><infCte>...</infCte></CTe></cteProc>"
  };

  await logIntegration("SEFAZ_CTE", "https://api.sefaz.gov.br/cte", "POST", 200, payload, result, Date.now() - start, osData.id);

  return { success: true, ...result };
}

export async function emitirMDFe(cteList: string[], motorista: any, veiculo: any): Promise<SefazResponse> {
  const start = Date.now();
  await sleep(800);
  
  const payload = { cteList, motorista, veiculo };
  const result = {
    protocolo: "935260001249911",
    chaveAcesso: "35260387654321000199580010000000011987654321",
    xml: "<mdfeProc><MDFe>...</MDFe></mdfeProc>"
  };

  await logIntegration("SEFAZ_MDFE", "https://api.sefaz.gov.br/mdfe", "POST", 200, payload, result, Date.now() - start);

  return { success: true, ...result };
}

export async function encerrarMDFe(chaveAcesso: string): Promise<SefazResponse> {
  const start = Date.now();
  await sleep(400);
  
  await logIntegration("SEFAZ_MDFE_ENCERRAR", `https://api.sefaz.gov.br/mdfe/${chaveAcesso}/encerrar`, "POST", 200, { chaveAcesso }, { status: "Encerrado MOC" }, Date.now() - start);

  return { success: true, protocolo: "935260001300001" };
}
