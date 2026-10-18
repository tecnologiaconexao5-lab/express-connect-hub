import type { HunterProvider, ProviderResultado, ProspectBruto } from "./HunterProvider";
import type { EstrategiaHunter } from "../types";

export const socialAssistidoProvider: HunterProvider = {
  id: "social_assistido",
  nome: "Redes Sociais (Assistido)",
  tipo: "social_assistido",
  ativo: true,
  confianca: "media",
  requer_chave_api: false,
  requer_acao_manual: true,

  async buscarProspects(config, estrategia): Promise<ProviderResultado> {
    const providersConfig = estrategia?.providers?.social_assistido;
    const redes = providersConfig?.redes || ["linkedin", "instagram", "facebook"];

    // Nao faz scraping automatico de redes sociais (viola termos de uso)
    // Retorna sugestoes de busca manual para o usuario
    const prospects: ProspectBruto[] = redes.map(rede => ({
      empresa: `[Buscar no ${rede}]`,
      cidade: config.estados[0] || "SP",
      estado: config.estados[0] || "SP",
      segmento: config.segmentos[0] || "Indefinido",
      site: rede === "linkedin" ? "https://www.linkedin.com" :
            rede === "instagram" ? "https://www.instagram.com" :
            "https://www.facebook.com",
      fonte_nome: rede.charAt(0).toUpperCase() + rede.slice(1),
      provider_origem: "social_assistido",
      data_coleta: new Date().toISOString(),
      termo_busca: config.segmentos.join(", "),
      confianca_origem: "media",
      observacao_origem: `Provider assistido para ${rede}. Nao automatiza scraping. Faca a busca manualmente pelo termo "${config.segmentos[0] || ""} ${config.estados[0] || ""}" e insira os prospects via provedor Manual.`,
    }));

    return {
      origem: "social_assistido",
      status: "sucesso",
      prospects,
      custo_estimado: 0,
      aviso: "SocialAssistido nao faz scraping de redes sociais. Retorna orientacoes para busca manual dentro dos termos de uso.",
    };
  },

  validarConfiguracao() { return { valido: true }; },
  estimarCusto() { return 0; },
  limites() { return { por_ciclo: 10, por_dia: 50 }; },
  descricao() { return "Provider assistido para LinkedIn, Instagram e Facebook. Nao automatiza login ou scraping — apenas orienta o usuario a buscar manualmente."; },
};
