import type { LeadOrigem, LeadUrgencia, LeadTemperatura, LeadEstagio } from "@/components/comercial/crm/crmTypes";

export type HunterModo = "manual" | "assistido" | "automatico";
export type HunterStatusResultado =
  | "encontrado" | "duplicado" | "descartado" | "lead_criado" | "abordado" | "confianca_baixa"
  | "respondeu" | "ignorou" | "recusou" | "virou_cliente" | "orcamento" | "fechou";

export interface EstrategiaHunter {
  segmentos_alvo: string[];
  segmentos_proibidos: string[];
  palavras_chave_prospeccao: string[];
  palavras_excluir: string[];
  concorrentes: string[];
  scoring: {
    pesos: Record<string, number>;
    thresholds: {
      em_chamas: number;
      quente: number;
      morno: number;
    };
    probabilidade_ranges: {
      em_chamas: { min: number; max: number };
      quente: { min: number; max: number };
      morno: { min: number; max: number };
      frio: { min: number; max: number };
    };
  };
  lead_quente: {
    score_minimo: number;
    criterios_extra: string[];
  };
  descarte: {
    score_minimo_auto: number;
    concorrente_automatico: boolean;
    motivos_auto: string[];
  };
  anti_duplicidade: {
    ativo: boolean;
    criterios: string[];
    check_resultados_anteriores: boolean;
    check_crm_leads: boolean;
  };
  canais: {
    whatsapp: boolean;
    email: boolean;
    linkedin: boolean;
    instagram: boolean;
    ligacao: boolean;
    ordem_prioridade: string[];
  };
  tom_voz: {
    estilo: string;
    formalidade: string;
    comprimento_maximo: number;
    regras: string[];
  };
  followup: {
    dias: number[];
    max_followups: number;
    tempo_recontato_dias: number;
    arquivar_apos_dias: number;
    mensagem_personalizada: boolean;
  };
  limites: {
    leads_por_dia: number;
    prospeccoes_por_ciclo: number;
    orcamento_diario: number;
    orcamento_mensal: number;
    max_tokens_por_ciclo: number;
  };
  ia: {
    provider: string;
    model: string;
    temperature: number;
    max_tokens: number;
    fallback_provider: string;
    fallback_model: string;
  };
  abordagem: {
    empresa_nome: string;
    assunto_email_padrao: string;
    comprimento_max_whatsapp: number;
    duracao_script_ligacao_seg: number;
    incluir_assinatura: boolean;
    assinatura: string;
  };
  orcamento: {
    diario: number;
    mensal: number;
    alerta_atingir: number;
  };
  providers: {
    ordem: string[];
    manual: { ativo: boolean };
    mock: { ativo: boolean };
    web_search: { ativo: boolean; provider?: string; api_key_secret?: string };
    google_maps: { ativo: boolean; api_key_secret?: string };
    catalogos: { ativo: boolean; fontes: string[] };
    social_assistido: { ativo: boolean; redes: string[] };
  };
}

export interface IaConfigHunter {
  provider: string;
  model: string;
  temperature_prospeccao: number;
  temperature_enriquecimento: number;
  temperature_validacao: number;
  temperature_abordagem: number;
  max_tokens_prospeccao: number;
  max_tokens_enriquecimento: number;
  max_tokens_validacao: number;
  max_tokens_abordagem: number;
  fallback_provider: string;
  fallback_model: string;
}

export interface HunterConfig {
  id: string;
  robo_id: string;
  ativo: boolean;
  modo: HunterModo;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  segmentos: string[];
  estados: string[];
  regioes: string[];
  score_minimo: number;
  max_leads_por_dia: number;
  max_prospeccoes_por_ciclo: number;
  fontes: string[];
  followup_dias: number[];
  max_followups: number;
  arquivar_apos_dias: number;
  gerar_whatsapp: boolean;
  gerar_email: boolean;
  gerar_linkedin: boolean;
  gerar_instagram: boolean;
  gerar_script_ligacao: boolean;
  estrategia: EstrategiaHunter;
  ia_config: IaConfigHunter;
  created_at: string;
  updated_at: string;
}

export interface HunterExecucao {
  id: string;
  robo_id: string;
  config_id?: string;
  status: string;
  inicio: string;
  fim?: string;
  resumo?: string;
  empresas_encontradas: number;
  leads_criados: number;
  leads_descartados: number;
  duplicatas_evitadas: number;
  tokens_entrada: number;
  tokens_saida: number;
  custo_estimado: number;
  erro?: string;
  created_at: string;
}

export interface HunterResultado {
  id: string;
  execucao_id?: string;
  robo_id: string;
  empresa: string;
  cidade?: string;
  estado?: string;
  segmento?: string;
  site?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  responsavel_nome?: string;
  responsavel_cargo?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  endereco?: string;
  cnpj?: string;
  necessidade_provavel?: string;
  volume_estimado?: string;
  urgencia: string;
  temperatura: string;
  probabilidade: number;
  score_ia: number;
  fonte?: string;
  fonte_url?: string;
  resumo_ia?: string;
  status: HunterStatusResultado;
  lead_id?: string;
  motivo_descarte?: string;
  dados_enriquecidos: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HunterAprendizado {
  id: string;
  robo_id: string;
  resultado_id?: string;
  lead_id?: string;
  tipo: string;
  descricao?: string;
  dados: Record<string, unknown>;
  score_antes?: number;
  score_depois?: number;
  feedback?: string;
  acao_corretiva?: string;
  created_at: string;
}

export interface ProspectDados {
  empresa: string;
  cidade: string;
  estado: string;
  segmento: string;
  site?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  responsavel_nome?: string;
  responsavel_cargo?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  endereco?: string;
  cnpj?: string;
  necessidade_provavel: string;
  volume_estimado: string;
  urgencia: LeadUrgencia;
  temperatura: LeadTemperatura;
  probabilidade: number;
  resumo_ia: string;
  fonte: string;

  provider_origem?: string;
  fonte_url?: string;
  fonte_nome?: string;
  data_coleta?: string;
  termo_busca?: string;
  confianca_origem?: "alta" | "media" | "baixa" | "simulada";
  observacao_origem?: string;
}

export interface AbordagemGerada {
  whatsapp?: string;
  email?: string;
  linkedin?: string;
  instagram?: string;
  script_ligacao?: string;
}

export interface ScoreIA {
  score: number;
  probabilidade: number;
  temperatura: LeadTemperatura;
  urgencia: LeadUrgencia;
  justificativa: string;
}

export const ESTRATEGIA_PADRAO: EstrategiaHunter = {
  segmentos_alvo: [
    "Farmacias", "Laboratorios", "Distribuidoras", "Industrias",
    "E-commerce", "Autopecas", "Hospitais", "Clinicas",
    "Pet Shops", "Graficas", "Confeccoes", "Cosmeticos",
    "Alimentos", "Bebidas", "Eletronicos", "Materiais Medicos",
    "Materiais Eletricos",
  ],
  segmentos_proibidos: ["Transportadoras", "Operadores Logisticos", "Motoboys"],
  palavras_chave_prospeccao: ["logistica", "transporte", "frete", "distribuicao", "entregas", "cargas"],
  palavras_excluir: ["concorrente", "transportadora"],
  concorrentes: [
    "transportadora", "operador logistico", "empresa de frete",
    "empresa de mudanca", "motoboy", "logistica", "transportes",
    "transportador", "carreteiro", "entregas",
  ],
  scoring: {
    pesos: {
      segmento_prioritario: 20,
      possui_frota_propria: 5,
      entregas_frequentes: 15,
      em_expansao: 10,
      novas_unidades: 10,
      contratando_motoristas: 8,
      reclamando_entregas: 12,
      crescendo: 8,
      porte_grande: 15,
      porte_medio: 10,
      porte_pequeno: 3,
      volume_alto: 10,
      necessidade_logistica: 10,
    },
    thresholds: { em_chamas: 80, quente: 60, morno: 40 },
    probabilidade_ranges: {
      em_chamas: { min: 75, max: 90 },
      quente: { min: 55, max: 75 },
      morno: { min: 30, max: 50 },
      frio: { min: 10, max: 25 },
    },
  },
  lead_quente: { score_minimo: 80, criterios_extra: ["Alto volume estimado", "Segmento prioritário", "Em expansão", "Necessidade logística urgente"] },
  descarte: { score_minimo_auto: 20, concorrente_automatico: true, motivos_auto: ["Score abaixo do mínimo", "Concorrente direto", "Fora do perfil comercial", "Segmento proibido", "Palavra-chave bloqueada"] },
  anti_duplicidade: { ativo: true, criterios: ["empresa", "cnpj", "email", "telefone", "dominio"], check_resultados_anteriores: true, check_crm_leads: true },
  canais: { whatsapp: true, email: true, linkedin: false, instagram: false, ligacao: true, ordem_prioridade: ["whatsapp", "email", "ligacao", "linkedin", "instagram"] },
  tom_voz: {
    estilo: "consultivo",
    formalidade: "semiformal",
    comprimento_maximo: 300,
    regras: [
      "Seja natural e profissional",
      "Nunca pareca spam ou generico",
      "Use linguagem corporativa brasileira",
      "Seja objetiva e mostre valor",
      "Maximo 3 paragrafos por mensagem",
    ],
  },
  followup: { dias: [2, 5, 10, 20], max_followups: 4, tempo_recontato_dias: 30, arquivar_apos_dias: 30, mensagem_personalizada: true },
  limites: { leads_por_dia: 10, prospeccoes_por_ciclo: 20, orcamento_diario: 10, orcamento_mensal: 200, max_tokens_por_ciclo: 50000 },
  ia: { provider: "groq", model: "llama-3.1-8b-instant", temperature: 0.7, max_tokens: 2000, fallback_provider: "groq", fallback_model: "llama-3.1-8b-instant" },
  abordagem: {
    empresa_nome: "Conexao Express Transportes",
    assunto_email_padrao: "Apresentacao Conexao Express",
    comprimento_max_whatsapp: 300,
    duracao_script_ligacao_seg: 30,
    incluir_assinatura: true,
    assinatura: "Atenciosamente, Equipe Comercial - Conexao Express",
  },
  orcamento: { diario: 10, mensal: 200, alerta_atingir: 80 },
  providers: {
    ordem: ["manual", "mock", "catalogo", "social_assistido", "web_search", "google_maps"],
    manual: { ativo: true },
    mock: { ativo: false },
    web_search: { ativo: false, provider: "serpapi", api_key_secret: "SERPAPI_KEY" },
    google_maps: { ativo: false, api_key_secret: "GOOGLE_MAPS_API_KEY" },
    catalogos: { ativo: true, fontes: [] },
    social_assistido: { ativo: true, redes: ["linkedin", "instagram", "facebook"] },
  },
};

export const IA_CONFIG_PADRAO: IaConfigHunter = {
  provider: "groq",
  model: "llama-3.1-8b-instant",
  temperature_prospeccao: 0.7,
  temperature_enriquecimento: 0.5,
  temperature_validacao: 0.3,
  temperature_abordagem: 0.7,
  max_tokens_prospeccao: 2000,
  max_tokens_enriquecimento: 1500,
  max_tokens_validacao: 500,
  max_tokens_abordagem: 1500,
  fallback_provider: "groq",
  fallback_model: "llama-3.1-8b-instant",
};
