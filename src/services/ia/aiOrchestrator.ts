import { supabase } from "@/lib/supabase";

export const registrarIaLog = async (
  provider: string,
  modulo: string,
  entrada: string,
  saida: string,
  intencao: string,
  confianca: number,
  precisaHumano: boolean,
  tokensEstimados: number,
  custoEstimado: number,
  metadata?: any
) => {
  try {
    await supabase.from("ia_logs").insert([{
      provider,
      modulo,
      entrada,
      saida,
      intencao,
      confianca,
      precisa_humano: precisaHumano,
      tokens_estimados: tokensEstimados,
      custo_estimado: custoEstimado,
      metadata: metadata || {}
    }]);
  } catch (err) {
    console.error("Erro ao registrar log IA:", err);
  }
};

export const classificarMensagem = async (mensagem: string): Promise<{ intencao: string, confianca: number, precisaHumano: boolean }> => {
  // Simulando orquestração LLM (Groq / Gemini)
  let intencao = "duvida_geral";
  let confianca = 0.85;
  let precisaHumano = false;

  const texto = mensagem.toLowerCase();
  
  if (texto.includes("falar com atendente") || texto.includes("urgente") || texto.includes("problema")) {
    intencao = "escalonamento_humano";
    confianca = 0.95;
    precisaHumano = true;
  } else if (texto.includes("rastreio") || texto.includes("onde está") || texto.includes("status")) {
    intencao = "rastreamento_pedido";
  } else if (texto.includes("orçamento") || texto.includes("cotação") || texto.includes("preço")) {
    intencao = "orcamento";
  }

  await registrarIaLog("groq", "atendimento", mensagem, `Intenção: ${intencao}`, intencao, confianca, precisaHumano, 50, 0.001);

  return { intencao, confianca, precisaHumano };
};

export const sugerirResposta = async (mensagem: string, intencao: string): Promise<string> => {
  // Simulando resposta baseada em intenção
  let resposta = "Olá! Como posso ajudar você hoje com as suas entregas pela Conexão Express?";

  if (intencao === "rastreamento_pedido") {
    resposta = "Para verificar o status da sua entrega, por favor me informe o número do CPF, CNPJ ou o número da Ordem de Serviço.";
  } else if (intencao === "orcamento") {
    resposta = "Legal! Para fazermos uma cotação, preciso saber o CEP de origem, CEP de destino, peso e medidas da mercadoria. Você tem essas informações fáceis?";
  } else if (intencao === "escalonamento_humano") {
    resposta = "Entendo. Estou transferindo você agora mesmo para um de nossos analistas de atendimento. Aguarde um instante.";
  }

  await registrarIaLog("groq", "atendimento", `Gerar resposta para: ${intencao}`, resposta, intencao, 0.9, false, 120, 0.002);

  return resposta;
};

export const resumirConversa = async (historico: string): Promise<string> => {
  const resumo = "Resumo gerado por IA: O cliente entrou em contato para saber o status da OS-1045. Foi informado que está em rota de entrega hoje.";
  await registrarIaLog("gemini", "resumo", historico, resumo, "resumo", 0.9, false, 300, 0.005);
  return resumo;
};

export const detectarUrgencia = async (mensagem: string): Promise<boolean> => {
  const isUrgente = mensagem.toLowerCase().includes("urgente") || mensagem.toLowerCase().includes("atraso") || mensagem.toLowerCase().includes("procon");
  await registrarIaLog("groq", "analise_sentimento", mensagem, `Urgente: ${isUrgente}`, "analise", 0.9, isUrgente, 40, 0.001);
  return isUrgente;
};

export default {
  registrarIaLog,
  classificarMensagem,
  sugerirResposta,
  resumirConversa,
  detectarUrgencia
};
