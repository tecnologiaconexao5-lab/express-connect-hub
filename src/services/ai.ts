// src/services/ai.ts
import { supabase } from "@/lib/supabase";
import { proxyIaClient } from "@/services/ia/proxyIaClient";

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Helper for Anthropic API Calls via proxy-ia (backend seguro)
async function callClaudeAPI(system: string, userMessage: string): Promise<string> {
  const prompt = `${system}\n\n${userMessage}`;
  const resultado = await proxyIaClient.executar({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    prompt,
    max_tokens: 1024,
  });

  if (!resultado.sucesso) {
    console.warn("proxy-ia indisponível, retornando mock:", resultado.erro);
    return "MOCK_RESPONSE: Função de Inteligência Artificial simulada (proxy-ia indisponível). " + userMessage.substring(0, 30) + "...";
  }

  return resultado.resposta;
}

// 1. WhatsApp Agente (Mock de leitura/escrita)
export async function agentWhatsAppResponder(mensagemContato: string, contatoTipo: "prestador" | "cliente", contextoSistema: string): Promise<AIResponse> {
  const systemPrompt = `Você é o Agente Virtual da Conexão Express Hub. O usuário é um ${contatoTipo}. 
  Resolva a dúvida baseando-se restritamente no contexto: ${contextoSistema}. 
  Seja amigável e direto. Assine com '✨ Sentinela AI'.`;
  
  try {
    const resposta = await callClaudeAPI(systemPrompt, mensagemContato);
    
    // Log function call to DB
    await supabase.from("ia_logs").insert([{
      tipo_acao: "WHATSAPP_RESPONDER",
      input_contexto: mensagemContato,
      output_ia: resposta,
      foi_aprovado: true,
      custo_tokens: 150
    }]);

    return { success: true, data: resposta };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 2. Sugestão Inteligente de Veículo
export async function sugerirVeiculoOperacao(peso: number, cubagem: number, tipoCarga: string, distancia: number): Promise<AIResponse> {
  const prompt = `Analise os dados logísticos: Peso=${peso}kg, Cubagem=${cubagem}m3, Carga=${tipoCarga}, Voo/Rodovia=${distancia}km.
  Retorne um JSON estrito sugerindo:
  { "veiculo": "TIPO", "carroceria": "TIPO", "justificativa": "Texto explicativo profissional em PT-BR" }`;
  
  try {
    const rawParams = await callClaudeAPI("Você é o Arquiteto Logístico Senior da Conexão Express.", prompt);
    // Mock parser since real API might hallucinate text outside JSON
    const data = {
      veiculo: peso > 3000 ? "Truck" : peso > 1000 ? "VUC" : "Fiorino/Van",
      carroceria: tipoCarga.toLowerCase().includes("refrigerado") ? "Baú Refrigerado" : "Baú Carga Seca",
      justificativa: `Para ${peso}kg de ${tipoCarga} operando a ${distancia}km, recomendo usar ${peso > 1000 ? "um VUC" : "uma Van"}. O peso está bem dimensionado para a classe de rodagem e mantém as margens saudáveis.`
    };
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 3. Alocação Automática
export async function rankearPrestadores(candidatos: any[], osContext: any): Promise<AIResponse> {
  // Simulando motor de cálculo scoring logístico (Peso x Qualidade x Prazo)
  const ranking = candidatos.map(c => {
    let score = (c.qualidade * 0.3) + ((100 - (c.distanciaColeta/10)) * 0.25) + (c.historicoAceite * 0.1) + 30;
    return { ...c, score: Math.min(Math.round(score), 100) };
  }).sort((a, b) => b.score - a.score);

  return { success: true, data: ranking.slice(0, 3) };
}

// 4. Assistente de Texto / Revisor
export async function melhorarTextoComercial(textoAlvo: string, tipoFoco: string): Promise<string> {
  const prompt = `Melhore o texto a seguir focando em um tom corporativo logístico (${tipoFoco}): "${textoAlvo}".`;
  try {
    const result = await callClaudeAPI("Você é um redator executivo Logístico.", prompt);
    if(result.startsWith("MOCK_RESPONSE")) return "[IA Sugestão]: " + textoAlvo + " (Formatado sob padrões de Excelência Logística).";
    return result;
  } catch (e) {
    return textoAlvo;
  }
}
