import type { HunterProvider, ProviderResultado, ProspectBruto } from "./HunterProvider";
import type { EstrategiaHunter } from "../types";

const CATALOGOS_PADRAO = [
  { nome: "Associacao Comercial de SP", url: "https://www.acsp.com.br/associados" },
  { nome: "Federacao das Industrias", url: "https://www.fiesp.com.br/associados" },
  { nome: "Cadastro Industrial", url: "https://www.cadastroindustrial.com.br" },
  { nome: "Portal B2B Brasil", url: "https://www.portalbb.com.br/empresas" },
];

export const siteCatalogProvider: HunterProvider = {
  id: "catalogo",
  nome: "Catalogos e Associacoes",
  tipo: "catalogo",
  ativo: true,
  confianca: "media",
  requer_chave_api: false,
  requer_acao_manual: true,

  async buscarProspects(config, estrategia): Promise<ProviderResultado> {
    const fontesConfig = estrategia?.providers?.catalogos?.fontes;
    const fontes = (fontesConfig && fontesConfig.length > 0)
      ? fontesConfig.map((f: any) => typeof f === "string" ? { nome: f, url: f } : f)
      : CATALOGOS_PADRAO;

    // Estrutura preparada para consulta futura a catalogos publicos
    // Atualmente retorna sugestoes ao usuario para insercao manual
    const prospects: ProspectBruto[] = fontes.map((f: { nome: string; url: string }) => ({
      empresa: `[Consultar em ${f.nome}]`,
      cidade: config.estados[0] || "SP",
      estado: config.estados[0] || "SP",
      segmento: config.segmentos[0] || "Indefinido",
      fonte_nome: f.nome,
      fonte_url: f.url,
      provider_origem: "catalogo",
      data_coleta: new Date().toISOString(),
      termo_busca: config.segmentos.join(", "),
      confianca_origem: "media",
      observacao_origem: `Sugestao de fonte: ${f.nome} (${f.url}). Acesse manualmente e insira os prospects via provedor Manual.`,
    }));

    return {
      origem: "catalogo",
      status: "sucesso",
      prospects,
      custo_estimado: 0,
      aviso: "CatalogProvider retorna sugestoes de fontes para consulta manual. Nao faz scraping automatico de sites de terceiros.",
    };
  },

  validarConfiguracao() { return { valido: true }; },
  estimarCusto() { return 0; },
  limites() { return { por_ciclo: 20, por_dia: 100 }; },
  descricao() { return "Sugere fontes de catalogos empresariais, associacoes e federacoes para prospeccao manual assistida."; },
};
