import type { HunterProvider, ProviderResultado, ProspectBruto } from "./HunterProvider";
import type { EstrategiaHunter } from "../types";

export const googleMapsProvider: HunterProvider = {
  id: "google_maps",
  nome: "Google Maps / Places API",
  tipo: "google_maps",
  ativo: false,
  confianca: "alta",
  requer_chave_api: true,
  requer_acao_manual: false,

  async buscarProspects(config, estrategia): Promise<ProviderResultado> {
    const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY ||
                   import.meta.env?.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return {
        origem: "google_maps",
        status: "sem_chave",
        prospects: [],
        custo_estimado: 0,
        erro: "Chave Google Maps/Places API nao configurada. Defina VITE_GOOGLE_MAPS_API_KEY no .env.",
      };
    }

    // Estrutura preparada para chamada real futura via Google Places API
    // Exemplo: GET https://maps.googleapis.com/maps/api/place/textsearch/json
    //   ?query=${termo}+em+${cidade}
    //   &key=${apiKey}
    //
    // A implementacao real requer:
    //   - Google Places API ativada no projeto GCP
    //   - Faturamento configurado
    //   - Chave de API com restricao de HTTP referrer

    return {
      origem: "google_maps",
      status: "nao_configurado",
      prospects: [],
      custo_estimado: 0,
      aviso: "Provedor Google Maps estruturalmente pronto, mas aguardando chave de API com Places API ativada.",
    };
  },

  validarConfiguracao(providerConfig: Record<string, any>) {
    const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey && providerConfig?.api_key_secret) {
      return { valido: true, mensagem: "Chave referenciada como secret." };
    }
    if (apiKey) return { valido: true };
    return { valido: false, mensagem: "Chave Google Maps API nao configurada." };
  },

  estimarCusto(prospectsCount: number) {
    // Places API: $0.032/request (SKU: Basic Search), ~20 results/request
    return Math.ceil(prospectsCount / 20) * 0.032;
  },

  limites() { return { por_ciclo: 50, por_dia: 200 }; },
  descricao() { return "Busca empresas no Google Maps por segmento e regiao. Requer Google Places API key. Nao faz scraping."; },
};
