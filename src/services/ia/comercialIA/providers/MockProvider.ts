import type { HunterProvider, ProviderResultado, ProspectBruto } from "./HunterProvider";
import type { EstrategiaHunter } from "../types";

export const mockProvider: HunterProvider = {
  id: "mock",
  nome: "Mock (Simulado)",
  tipo: "mock",
  ativo: false,
  confianca: "simulada",
  requer_chave_api: false,
  requer_acao_manual: false,

  async buscarProspects(config, estrategia): Promise<ProviderResultado> {
    const segmentos = config.segmentos.length > 0
      ? config.segmentos.slice(0, 2)
      : (estrategia.segmentos_alvo || []).slice(0, 2);
    const estados = config.estados.length > 0
      ? config.estados.slice(0, 2)
      : ["SP", "RJ"];

    const empresasMock: Record<string, string[]> = {
      "Farmacias": ["FarmaTotal Distribuidora", "Drogalider Farmaceutica", "PharmaMaster Logistica"],
      "Laboratorios": ["LabAnalyse Brasil", "Diagnostika Plus", "BioHealth Analises"],
      "E-commerce": ["LojaClick Express", "DigitalStore Brasil", "EComPro Distribuicao"],
      "Industrias": ["IndustriaMetal Tech", "AutoPecas Nacional", "Maquinas Ferreira"],
    };

    const prospects: ProspectBruto[] = [];
    for (const seg of segmentos) {
      const empresas = empresasMock[seg] || ["EmpresaExemplo Logistica"];
      for (const emp of empresas.slice(0, 2)) {
        const estado = estados[Math.floor(Math.random() * estados.length)];
        const cidade = estado === "SP" ? "Sao Paulo" : estado === "RJ" ? "Rio de Janeiro" : "Belo Horizonte";
        prospects.push({
          empresa: emp,
          cidade,
          estado,
          segmento: seg,
          fonte_nome: "Mock (Simulado)",
          fonte_url: undefined,
          provider_origem: "mock",
          data_coleta: new Date().toISOString(),
          termo_busca: seg,
          confianca_origem: "simulada",
          observacao_origem: "DADO SIMULADO — apenas para homologacao. Nao e um lead real.",
        });
      }
    }

    return {
      origem: "mock",
      status: "simulado",
      prospects: prospects.slice(0, config.limite),
      custo_estimado: 0,
      aviso: "Provedor MOCK ativo — dados simulados, nao reais",
    };
  },

  validarConfiguracao() { return { valido: true }; },
  estimarCusto() { return 0; },
  limites() { return { por_ciclo: 10, por_dia: 50 }; },
  descricao() { return "Provedor de homologacao. Retorna dados simulados para testes. Nao usar em producao."; },
};
