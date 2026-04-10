// ============================================================
// CRM Comercial Avançado — Tipos e Interfaces
// ============================================================

export type LeadEstagio =
  | "lead_novo"
  | "contato_iniciado"
  | "qualificado"
  | "diagnostico"
  | "proposta_enviada"
  | "negociacao"
  | "fechado_ganho"
  | "fechado_perdido";

export type LeadTemperatura = "frio" | "morno" | "quente" | "em_chamas";
export type LeadUrgencia = "baixa" | "media" | "alta" | "critica";
export type LeadOrigem =
  | "indicacao"
  | "inbound"
  | "outbound"
  | "evento"
  | "linkedin"
  | "site"
  | "whatsapp"
  | "email_mkt"
  | "parceiro"
  | "outro";

export type TipoInteracao =
  | "criacao"
  | "ligacao"
  | "email"
  | "whatsapp"
  | "reuniao"
  | "proposta"
  | "atualizacao"
  | "obs"
  | "visita";

export type TipoUsuarioCRM = "sdr" | "closer" | "gestor";
export type MotivoPerda =
  | "preco"
  | "sem_interesse"
  | "concorrente"
  | "demora"
  | "sem_volume"
  | "outro";

export interface TimelineItem {
  id: string;
  data: Date;
  tipo: TipoInteracao;
  descricao: string;
  responsavel: string;
  canal?: "whatsapp" | "email" | "ligacao" | "presencial" | "sistema";
}

export interface Lembrete {
  id: string;
  data: Date;
  tipo: "reuniao" | "ligacao" | "retorno" | "email" | "whatsapp" | "prazo";
  descricao: string;
  responsavel: string;
  status: "pendente" | "realizado" | "cancelado";
  local?: string;
}

export interface Lead {
  id: string;
  // Identificação
  empresa: string;
  nomeContato: string;
  telefone: string;
  whatsapp: string;
  email: string;
  // Classificação
  segmento: string;
  regiao: string;
  origem: LeadOrigem;
  responsavel: string;
  tipoServico: string;
  // Pipeline
  estagio: LeadEstagio;
  urgencia: LeadUrgencia;
  temperatura: LeadTemperatura;
  // Financeiro
  valorEstimadoMensal: number;
  probabilidadeFechamento: number; // 0-100
  // Operacional
  qtdVeiculos?: number;
  tiposVeiculo?: string[];
  regioes?: string[];
  volumeMensal?: number;
  // Histórico
  timeline: TimelineItem[];
  lembretes: Lembrete[];
  // Metadados
  criadoEm: Date;
  atualizadoEm: Date;
  diasNaEtapa: number;
  // Perda
  motivoPerda?: MotivoPerda;
  descricaoPerda?: string;
  // Proposta
  propostaUrl?: string;
  propostaEnviadaEm?: Date;
  propostaVisualizacoes?: number;
}

export interface PropostaModelo {
  id: string;
  nome: string;
  segmento: string;
  versao: string;
  descricao: string;
  pdfUrl?: string;
  linkUrl?: string;
  criadoEm: Date;
}

export interface MetricasCRM {
  totalLeads: number;
  leadsAtivos: number;
  conversaoPercent: number;
  receitaPrevista: number;
  receitaPropavel: number;
  receitaConfirmada: number;
  ticketMedio: number;
  tempoMedioFechamento: number;
}

export const ESTAGIOS_CONFIG: Record<
  LeadEstagio,
  { label: string; cor: string; corBg: string; ordem: number }
> = {
  lead_novo: {
    label: "Lead Novo",
    cor: "text-slate-700",
    corBg: "bg-slate-100 border-slate-300",
    ordem: 0,
  },
  contato_iniciado: {
    label: "Contato Iniciado",
    cor: "text-blue-700",
    corBg: "bg-blue-100 border-blue-300",
    ordem: 1,
  },
  qualificado: {
    label: "Qualificado",
    cor: "text-cyan-700",
    corBg: "bg-cyan-100 border-cyan-300",
    ordem: 2,
  },
  diagnostico: {
    label: "Diagnóstico",
    cor: "text-violet-700",
    corBg: "bg-violet-100 border-violet-300",
    ordem: 3,
  },
  proposta_enviada: {
    label: "Proposta Enviada",
    cor: "text-orange-700",
    corBg: "bg-orange-100 border-orange-300",
    ordem: 4,
  },
  negociacao: {
    label: "Negociação",
    cor: "text-amber-700",
    corBg: "bg-amber-100 border-amber-300",
    ordem: 5,
  },
  fechado_ganho: {
    label: "Fechado Ganho",
    cor: "text-emerald-700",
    corBg: "bg-emerald-100 border-emerald-300",
    ordem: 6,
  },
  fechado_perdido: {
    label: "Fechado Perdido",
    cor: "text-red-700",
    corBg: "bg-red-100 border-red-300",
    ordem: 7,
  },
};

export const TEMPERATURA_CONFIG: Record<
  LeadTemperatura,
  { label: string; emoji: string; cor: string }
> = {
  frio: { label: "Frio", emoji: "🧊", cor: "text-blue-500" },
  morno: { label: "Morno", emoji: "🌤️", cor: "text-yellow-500" },
  quente: { label: "Quente", emoji: "🔥", cor: "text-orange-500" },
  em_chamas: { label: "Em Chamas!", emoji: "🚀", cor: "text-red-500" },
};

export const SEGMENTOS = [
  "Agronegócio",
  "Alimentício",
  "Automotivo",
  "Construção Civil",
  "E-commerce",
  "Farmacêutico",
  "Industrial",
  "Retail / Varejo",
  "Saúde",
  "Têxtil",
  "Transportadora",
  "Outro",
];

export const TIPOS_SERVICO = [
  "Carga Fracionada",
  "Carga Dedicada",
  "Distribuição",
  "Coleta e Entrega",
  "Carga Especial",
  "Carga Refrigerada",
  "Mudança Corporativa",
  "Transporte Interestadual",
  "Last Mile",
];

export const REGIOES_BRASIL = [
  "SP Capital",
  "SP Grande SP",
  "SP Interior",
  "RJ",
  "MG",
  "ES",
  "PR",
  "SC",
  "RS",
  "DF / GO",
  "BA",
  "PE",
  "CE",
  "Norte",
  "Centro-Oeste",
  "Nordeste",
];

export const TIPOS_VEICULOS = [
  "Moto",
  "Utilitário",
  "Van",
  "VUC",
  "Toco",
  "Truck",
  "Carreta",
  "Bitrem",
  "Rodotrem",
];

// Calcula probabilidade de fechamento baseado em atributos do lead
export function calcularProbabilidade(lead: Partial<Lead>): number {
  let score = 0;

  // Temperatura
  if (lead.temperatura === "em_chamas") score += 35;
  else if (lead.temperatura === "quente") score += 25;
  else if (lead.temperatura === "morno") score += 10;
  else score += 0;

  // Urgência
  if (lead.urgencia === "critica") score += 20;
  else if (lead.urgencia === "alta") score += 15;
  else if (lead.urgencia === "media") score += 8;
  else score += 2;

  // Estágio
  const estagioScores: Partial<Record<LeadEstagio, number>> = {
    lead_novo: 5,
    contato_iniciado: 10,
    qualificado: 20,
    diagnostico: 35,
    proposta_enviada: 50,
    negociacao: 70,
    fechado_ganho: 100,
    fechado_perdido: 0,
  };
  score += estagioScores[lead.estagio as LeadEstagio] || 0;

  // Interações
  const interacoes = lead.timeline?.length || 0;
  score += Math.min(interacoes * 3, 15);

  return Math.min(Math.round(score), 100);
}

// Gera sugestão de ação com IA simulada
export function gerarSugestaoIA(lead: Lead): {
  tipo: "alerta" | "sugestao" | "urgente";
  mensagem: string;
  acao: string;
} {
  if (lead.estagio === "fechado_perdido") {
    return {
      tipo: "sugestao",
      mensagem: "Lead marcado como perdido.",
      acao: "Registrar motivo e agendar recontato em 90 dias.",
    };
  }

  if (lead.diasNaEtapa > 10) {
    return {
      tipo: "urgente",
      mensagem: `Lead parado há ${lead.diasNaEtapa} dias! Risco de perda iminente.`,
      acao: "Enviar mensagem de reativação urgente via WhatsApp.",
    };
  }

  if (lead.diasNaEtapa > 5) {
    return {
      tipo: "alerta",
      mensagem: `Lead sem interação há ${lead.diasNaEtapa} dias.`,
      acao: "Sugerimos enviar follow-up por e-mail ou WhatsApp.",
    };
  }

  if (lead.temperatura === "em_chamas" || lead.probabilidadeFechamento > 70) {
    return {
      tipo: "sugestao",
      mensagem: "Lead quente com alta chance de fechamento!",
      acao: "Priorize proposta personalizada e ligue hoje.",
    };
  }

  if (lead.estagio === "proposta_enviada" && !lead.propostaVisualizacoes) {
    return {
      tipo: "alerta",
      mensagem: "Proposta enviada mas ainda não visualizada.",
      acao: "Entre em contato para confirmar recebimento.",
    };
  }

  return {
    tipo: "sugestao",
    mensagem: "Lead em andamento normal.",
    acao: "Mantenha o contato e atualize o status regularmente.",
  };
}

// Templates de mensagens
export const TEMPLATES_MENSAGEM: Record<
  string,
  { titulo: string; texto: string }
> = {
  abordagem: {
    titulo: "Abordagem Inicial",
    texto:
      "Olá {{nome}}, tudo bem? Sou da Conexão Express Transportes. Vi que vocês atuam no segmento de {{segmento}} e acredito que podemos agilizar muito sua logística. Podemos conversar?",
  },
  followup_1: {
    titulo: "Follow-up 1 dia",
    texto:
      "Oi {{nome}}! Passando para saber se você teve chance de ver nossa proposta. Tenho certeza que vai gostar das condições. Posso ligar agora?",
  },
  followup_3: {
    titulo: "Follow-up 3 dias",
    texto:
      "{{nome}}, boa tarde! Queria retomar nossa conversa sobre a otimização logística da {{empresa}}. Temos uma solução que pode reduzir seus custos em até 20%. Podemos agendar uma apresentação rápida?",
  },
  followup_5: {
    titulo: "Follow-up Final",
    texto:
      "Olá {{nome}}! Sei que você está ocupado, mas quero deixar em aberto nosso canal. Nossa proposta tem validade por mais 5 dias. Se precisar de qualquer ajuste, estou à disposição.",
  },
  objecao_preco: {
    titulo: "Contornar Objeção de Preço",
    texto:
      "Entendo sua preocupação, {{nome}}. Mas quando analisamos o custo-benefício total — pontualidade, rastreamento em tempo real e atendimento dedicado — nosso valor se paga rapidamente. Posso mostrar uma simulação?",
  },
  fechamento: {
    titulo: "Fechamento",
    texto:
      "{{nome}}, que ótima notícia! Para finalizarmos, preciso de: CNPJ, endereço completo e contato do setor financeiro. Posso também já agendar a primeira coleta para a próxima semana?",
  },
};

// Dados mock para demonstração
export const LEADS_MOCK: Lead[] = [
  {
    id: "1",
    empresa: "Logística Alpha S.A.",
    nomeContato: "Carlos Mendes",
    telefone: "(11) 99999-1111",
    whatsapp: "(11) 99999-1111",
    email: "carlos@alphalogistica.com.br",
    segmento: "Industrial",
    regiao: "SP Capital",
    origem: "inbound",
    responsavel: "Diego B.",
    tipoServico: "Carga Dedicada",
    estagio: "qualificado",
    urgencia: "alta",
    temperatura: "quente",
    valorEstimadoMensal: 28000,
    probabilidadeFechamento: 68,
    qtdVeiculos: 4,
    tiposVeiculo: ["Truck", "Van"],
    regioes: ["SP Capital", "SP Grande SP"],
    volumeMensal: 85,
    timeline: [
      {
        id: "t1",
        data: new Date(2026, 3, 1),
        tipo: "criacao",
        descricao: "Lead criado via inbound",
        responsavel: "Sistema",
      },
      {
        id: "t2",
        data: new Date(2026, 3, 3),
        tipo: "ligacao",
        descricao: "Primeiro contato realizado. Carlos demonstrou interesse.",
        responsavel: "Diego B.",
      },
      {
        id: "t3",
        data: new Date(2026, 3, 5),
        tipo: "reuniao",
        descricao: "Reunião de diagnóstico agendada para próxima semana",
        responsavel: "Diego B.",
      },
    ],
    lembretes: [
      {
        id: "l1",
        data: new Date(2026, 3, 15),
        tipo: "reuniao",
        descricao: "Reunião de diagnóstico com Carlos",
        responsavel: "Diego B.",
        status: "pendente",
        local: "Google Meet",
      },
    ],
    criadoEm: new Date(2026, 3, 1),
    atualizadoEm: new Date(2026, 3, 5),
    diasNaEtapa: 5,
  },
  {
    id: "2",
    empresa: "Distribuidora Beta LTDA",
    nomeContato: "Ana Costa",
    telefone: "(21) 98888-2222",
    whatsapp: "(21) 98888-2222",
    email: "ana.costa@betadist.com.br",
    segmento: "Alimentício",
    regiao: "RJ",
    origem: "indicacao",
    responsavel: "João S.",
    tipoServico: "Distribuição",
    estagio: "proposta_enviada",
    urgencia: "alta",
    temperatura: "em_chamas",
    valorEstimadoMensal: 75000,
    probabilidadeFechamento: 82,
    qtdVeiculos: 10,
    tiposVeiculo: ["Carreta", "Toco"],
    regioes: ["RJ", "ES", "MG"],
    volumeMensal: 220,
    timeline: [
      {
        id: "t1",
        data: new Date(2026, 2, 20),
        tipo: "criacao",
        descricao: "Lead por indicação",
        responsavel: "Sistema",
      },
      {
        id: "t2",
        data: new Date(2026, 2, 22),
        tipo: "email",
        descricao: "E-mail de apresentação enviado",
        responsavel: "João S.",
      },
      {
        id: "t3",
        data: new Date(2026, 2, 25),
        tipo: "reuniao",
        descricao: "Reunião presencial realizada. Ana muito interessada.",
        responsavel: "João S.",
      },
      {
        id: "t4",
        data: new Date(2026, 3, 2),
        tipo: "proposta",
        descricao: "Proposta enviada via e-mail e WhatsApp",
        responsavel: "João S.",
      },
    ],
    lembretes: [],
    criadoEm: new Date(2026, 2, 20),
    atualizadoEm: new Date(2026, 3, 2),
    diasNaEtapa: 8,
    propostaUrl: "#",
    propostaVisualizacoes: 3,
  },
  {
    id: "3",
    empresa: "Indústria Gamma Mecânica",
    nomeContato: "Roberto Alves",
    telefone: "(31) 97777-3333",
    whatsapp: "(31) 97777-3333",
    email: "roberto@gammamecanica.com.br",
    segmento: "Automotivo",
    regiao: "MG",
    origem: "outbound",
    responsavel: "Diego B.",
    tipoServico: "Transporte Interestadual",
    estagio: "negociacao",
    urgencia: "media",
    temperatura: "quente",
    valorEstimadoMensal: 145000,
    probabilidadeFechamento: 71,
    qtdVeiculos: 18,
    tiposVeiculo: ["Carreta", "Bitrem", "Rodotrem"],
    regioes: ["MG", "SP Interior", "PR", "RS"],
    volumeMensal: 320,
    timeline: [
      {
        id: "t1",
        data: new Date(2026, 2, 10),
        tipo: "criacao",
        descricao: "Lead outbound - prospecção ativa",
        responsavel: "Diego B.",
      },
      {
        id: "t2",
        data: new Date(2026, 2, 12),
        tipo: "ligacao",
        descricao: "Cold call - Roberto receptivo",
        responsavel: "Diego B.",
      },
      {
        id: "t3",
        data: new Date(2026, 2, 18),
        tipo: "visita",
        descricao: "Visita técnica realizada na planta",
        responsavel: "Diego B.",
      },
      {
        id: "t4",
        data: new Date(2026, 3, 1),
        tipo: "proposta",
        descricao: "Proposta detalhada enviada",
        responsavel: "Diego B.",
      },
      {
        id: "t5",
        data: new Date(2026, 3, 7),
        tipo: "reuniao",
        descricao: "Reunião de negociação - pedindo desconto de 8%",
        responsavel: "Diego B.",
      },
    ],
    lembretes: [
      {
        id: "l1",
        data: new Date(2026, 3, 12),
        tipo: "ligacao",
        descricao: "Retorno sobre condições comerciais negociadas",
        responsavel: "Diego B.",
        status: "pendente",
      },
    ],
    criadoEm: new Date(2026, 2, 10),
    atualizadoEm: new Date(2026, 3, 7),
    diasNaEtapa: 3,
    propostaVisualizacoes: 7,
  },
  {
    id: "4",
    empresa: "E-commerce Omega",
    nomeContato: "Juliana Ferreira",
    telefone: "(11) 96666-4444",
    whatsapp: "(11) 96666-4444",
    email: "juliana@omegashop.com.br",
    segmento: "E-commerce",
    regiao: "SP Capital",
    origem: "site",
    responsavel: "Diego B.",
    tipoServico: "Last Mile",
    estagio: "lead_novo",
    urgencia: "media",
    temperatura: "morno",
    valorEstimadoMensal: 18000,
    probabilidadeFechamento: 25,
    diasNaEtapa: 1,
    timeline: [
      {
        id: "t1",
        data: new Date(2026, 3, 9),
        tipo: "criacao",
        descricao: "Lead via formulário no site",
        responsavel: "Sistema",
      },
    ],
    lembretes: [],
    criadoEm: new Date(2026, 3, 9),
    atualizadoEm: new Date(2026, 3, 9),
  },
  {
    id: "5",
    empresa: "Farmácia Delta Rede",
    nomeContato: "Paulo Rodrigues",
    telefone: "(41) 95555-5555",
    whatsapp: "(41) 95555-5555",
    email: "paulo@deltaredes.com.br",
    segmento: "Farmacêutico",
    regiao: "PR",
    origem: "evento",
    responsavel: "João S.",
    tipoServico: "Carga Refrigerada",
    estagio: "diagnostico",
    urgencia: "alta",
    temperatura: "quente",
    valorEstimadoMensal: 52000,
    probabilidadeFechamento: 60,
    qtdVeiculos: 6,
    tiposVeiculo: ["Van", "VUC"],
    regioes: ["PR", "SC"],
    volumeMensal: 150,
    timeline: [
      {
        id: "t1",
        data: new Date(2026, 3, 3),
        tipo: "criacao",
        descricao: "Captado em evento de logística em Curitiba",
        responsavel: "João S.",
      },
      {
        id: "t2",
        data: new Date(2026, 3, 5),
        tipo: "ligacao",
        descricao: "Qualificação por telefone - Paulo confirmou necessidade",
        responsavel: "João S.",
      },
      {
        id: "t3",
        data: new Date(2026, 3, 8),
        tipo: "reuniao",
        descricao: "Diagnóstico em andamento - entendendo volume e rotas",
        responsavel: "João S.",
      },
    ],
    lembretes: [
      {
        id: "l1",
        data: new Date(2026, 3, 14),
        tipo: "email",
        descricao: "Enviar relatório de diagnóstico para Paulo",
        responsavel: "João S.",
        status: "pendente",
      },
    ],
    criadoEm: new Date(2026, 3, 3),
    atualizadoEm: new Date(2026, 3, 8),
    diasNaEtapa: 2,
  },
];
