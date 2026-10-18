import type { EstrategiaHunter, ProspectDados } from "../types";

export interface ProviderResultado {
  origem: string;
  status: "sucesso" | "simulado" | "nao_configurado" | "erro" | "sem_chave";
  prospects: ProspectBruto[];
  custo_estimado: number;
  erro?: string;
  aviso?: string;
}

export interface ProspectBruto {
  empresa: string;
  cidade: string;
  estado: string;
  segmento?: string;
  site?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  endereco?: string;
  cnpj?: string;
  fonte_nome: string;
  fonte_url?: string;
  provider_origem: string;
  data_coleta: string;
  termo_busca?: string;
  confianca_origem: "alta" | "media" | "baixa" | "simulada";
  observacao_origem?: string;
  dados_extras?: Record<string, unknown>;
}

export interface HunterProvider {
  readonly id: string;
  readonly nome: string;
  readonly tipo: "manual" | "mock" | "web_search" | "google_maps" | "catalogo" | "social_assistido";
  readonly ativo: boolean;
  readonly confianca: "alta" | "media" | "baixa" | "simulada";
  readonly requer_chave_api: boolean;
  readonly requer_acao_manual: boolean;

  buscarProspects(
    config: { segmentos: string[]; estados: string[]; palavrasChave: string[]; limite: number },
    estrategia: EstrategiaHunter
  ): Promise<ProviderResultado>;

  validarConfiguracao(providerConfig: Record<string, any>): { valido: boolean; mensagem?: string };
  estimarCusto(prospectsCount: number): number;
  limites(): { por_ciclo: number; por_dia: number };
  descricao(): string;
}
