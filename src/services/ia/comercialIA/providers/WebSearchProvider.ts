import type { HunterProvider, ProviderResultado, ProspectBruto } from "./HunterProvider";
import type { EstrategiaHunter } from "../types";

export const webSearchProvider: HunterProvider = {
  id: "web_search",
  nome: "Busca na Web (SerpAPI / Google CSE)",
  tipo: "web_search",
  ativo: false,
  confianca: "media",
  requer_chave_api: true,
  requer_acao_manual: false,

  async buscarProspects(config, estrategia): Promise<ProviderResultado> {
    const apiKey = import.meta.env?.VITE_SERPAPI_KEY || import.meta.env?.VITE_GOOGLE_CSE_KEY;
    if (!apiKey) {
      return {
        origem: "web_search",
        status: "sem_chave",
        prospects: [],
        custo_estimado: 0,
        erro: "Chave de API nao configurada. Defina VITE_SERPAPI_KEY ou VITE_GOOGLE_CSE_KEY no .env.",
      };
    }

    // Estrutura preparada para chamada real futura
    // Exemplo com SerpAPI:
    // const url = `https://serpapi.com/search.json?q=${termo}&location=${cidade}&api_key=${apiKey}`;
    //
    // A implementacao real depende da API estar configurada.
    // Por seguranca, nao incluir chave no codigo fonte.

    return {
      origem: "web_search",
      status: "nao_configurado",
      prospects: [],
      custo_estimado: 0,
      aviso: "Provedor WebSearch estruturalmente pronto, mas aguardando configuracao de API key no ambiente.",
    };
  },

  validarConfiguracao(providerConfig: Record<string, any>) {
    const apiKey = import.meta.env?.VITE_SERPAPI_KEY || import.meta.env?.VITE_GOOGLE_CSE_KEY;
    if (!apiKey && providerConfig?.api_key_secret) {
      return { valido: true, mensagem: "Chave referenciada como secret, aguardando resolucao no backend." };
    }
    if (apiKey) return { valido: true };
    return { valido: false, mensagem: "Nenhuma chave SerpAPI ou Google CSE configurada." };
  },

  estimarCusto(prospectsCount: number) {
    // SerpAPI ~$0.01/query, cada query pode retornar ate 10 resultados
    return Math.ceil(prospectsCount / 10) * 0.01;
  },

  limites() { return { por_ciclo: 30, por_dia: 100 }; },
  descricao() { return "Busca empresas na web usando SerpAPI ou Google Custom Search. Requer chave de API configurada no ambiente."; },
};
