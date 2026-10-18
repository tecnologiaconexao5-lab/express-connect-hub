import type { HunterProvider, ProviderResultado, ProspectBruto } from "./HunterProvider";
import type { EstrategiaHunter } from "../types";

let filaManual: ProspectBruto[] = [];

export const manualProvider: HunterProvider = {
  id: "manual",
  nome: "Insercao Manual / Importacao",
  tipo: "manual",
  ativo: true,
  confianca: "alta",
  requer_chave_api: false,
  requer_acao_manual: true,

  async buscarProspects(config, estrategia): Promise<ProviderResultado> {
    const pendentes = [...filaManual];
    filaManual = [];
    return {
      origem: "manual",
      status: pendentes.length > 0 ? "sucesso" : "sucesso",
      prospects: pendentes.slice(0, config.limite),
      custo_estimado: 0,
      aviso: pendentes.length === 0 ? "Nenhum prospect manual na fila. Use a UI para adicionar." : undefined,
    };
  },

  adicionarProspect(dados: Omit<ProspectBruto, "data_coleta" | "provider_origem" | "confianca_origem" | "fonte_nome">) {
    filaManual.push({
      ...dados,
      data_coleta: new Date().toISOString(),
      provider_origem: "manual",
      confianca_origem: "alta",
      fonte_nome: dados.fonte_nome || "Insercao Manual",
    });
  },

  adicionarLote(lista: Omit<ProspectBruto, "data_coleta" | "provider_origem" | "confianca_origem" | "fonte_nome">[]) {
    for (const item of lista) {
      this.adicionarProspect(item);
    }
  },

  listarFila() { return [...filaManual]; },
  limparFila() { filaManual = []; },
  tamanhoFila() { return filaManual.length; },

  validarConfiguracao() { return { valido: true }; },
  estimarCusto() { return 0; },
  limites() { return { por_ciclo: 50, por_dia: 200 }; },
  descricao() { return "Permite inserir ou importar prospects manualmente via UI. Ideal para planilhas, listas compradas e indicacoes."; },
};
