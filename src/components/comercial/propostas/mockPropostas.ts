export interface Proposta {
  id: string;
  titulo: string;
  subtitulo?: string;
  descricao?: string;
  tipo: "modelo" | "personalizada";
  categoria: "institucional" | "comercial" | "tabela" | "apresentacao" | "modelo_base" | "personalizada";
  cliente?: string;
  contato?: string;
  email?: string;
  segmento: string;
  tipoServico: string;
  status: "rascunho" | "em_edicao" | "pronta" | "enviada" | "visualizada" | "aprovada" | "rejeitada" | "arquivada";
  favorita: boolean;
  arquivada?: boolean;
  versao: string;
  responsavel: string;
  tags: string[];
  versoes: PropostaVersao[];
  historico: PropostaHistorico[];
  anexos?: Anexo[];
  personalizada?: Personalizacao;
  modeloOrigemId?: string;
  criadoEm: string;
  atualizadoEm: string;
  visualizacoes?: number;
 /envios?: number;
}

export interface PropostaVersao {
  versao: string;
  data: string;
  responsavel: string;
  observacoes?: string;
}

export interface PropostaHistorico {
  id: string;
  acao: string;
  data: string;
  responsavel: string;
  detalhes?: string;
}

export interface Anexo {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  url?: string;
  dataUpload: string;
}

export interface Personalizacao {
  logoUrl?: string;
  nomeCliente: string;
  capaPersonalizada?: boolean;
  coresSecundarias?: string;
  textoIntroducao?: string;
  observacoes?: string;
  tabelaPrecos?: string;
}

export const CATEGORIAS = [
  { id: "institucional", label: "Institucionais", icon: "Building2", color: "bg-slate-500" },
  { id: "comercial", label: "Comerciais", icon: "Briefcase", color: "bg-blue-500" },
  { id: "tabela", label: "Tabelas", icon: "FileSpreadsheet", color: "bg-green-500" },
  { id: "apresentacao", label: "Apresentações", icon: "Presentation", color: "bg-purple-500" },
  { id: "modelo_base", label: "Modelos Base", icon: "LayoutTemplate", color: "bg-amber-500" },
  { id: "personalizada", label: "Personalizadas", icon: "User", color: "bg-emerald-500" },
] as const;

export const SEGMENTOS = [
  "E-commerce",
  "Varejo",
  "Industrial",
  "Farmacêutico",
  "Alimentício",
  "Automotivo",
  "Textil",
  "Eletrônicos",
  "Cosméticos",
  "Logística",
  "Atacado",
  "Outros",
] as const;

export const TIPOS_SERVICO = [
  "Carga Fechada",
  "Carga Fracionada",
  "Last Mile",
  "Carga Dedicada",
  "Logística Reversa",
  "Armazenagem",
  "Cross-docking",
  "Distribuição",
  "Transporte Expresso",
  "Operação Integrada",
] as const;

export const TIPOS_MODELO = [
  { id: "institucional", label: "Proposta Institucional", desc: "Apresentação institucional da empresa" },
  { id: "transporte_dedicado", label: "Transporte Dedicado", desc: "Proposta para operação dedicada" },
  { id: "last_mile", label: "Last Mile", desc: "Proposta para entrega final" },
  { id: "armazenagem", label: "Armazenagem", desc: "Proposta de armazenagem" },
  { id: "tabela_frete", label: "Tabela de Frete", desc: "Tabela de preços de frete" },
  { id: "cliente_recorrente", label: "Cliente Recorrente", desc: "Renovação ou adequação" },
  { id: "personalizada", label: "Personalizada", desc: "Proposta customizada" },
] as const;

export const mockPropostas: Proposta[] = [
  {
    id: "1",
    titulo: "Proposta Institucional - Apresentação Corporate",
    subtitulo: "Apresentação institucional completa da Conexão Express",
    descricao: "Apresentação institucional padrão para novos clientes",
    tipo: "modelo",
    categoria: "institucional",
    cliente: null,
    segmento: "Geral",
    tipoServico: "Operação Integrada",
    status: "aprovada",
    favorita: true,
    arquivada: false,
    versao: "v2.3",
    responsável: "Diego Balbino",
    tags: ["institucional", "corporate", "Apresentação"],
    versoes: [
      { versao: "v2.3", data: "2026-04-01", responsavel: "Diego Balbino", observacoes: "Atualização de logos" },
      { versao: "v2.2", data: "2026-03-15", responsavel: "Maria Santos", observacoes: "Novo layout" },
      { versao: "v2.1", data: "2026-02-01", responsavel: "Diego Balbino", observacoes: "Atualização de serviços" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-01-10", responsavel: "Diego Balbino" },
      { id: "h2", acao: "Atualização", data: "2026-04-01", responsavel: "Diego Balbino", detalhes: "Atualização de logos e cores" },
    ],
    criadoEm: "2026-01-10T10:00:00Z",
    atualizadoEm: "2026-04-01T14:30:00Z",
    visualizacoes: 45,
    envios: 12,
  },
  {
    id: "2",
    titulo: "Proposta Comercial - Last Mile E-commerce",
    subtitulo: "Modelo para operações de last mile",
    descricao: "Proposta modelo para operações de entrega final",
    tipo: "modelo",
    categoria: "modelo_base",
    cliente: null,
    segmento: "E-commerce",
    tipoServico: "Last Mile",
    status: "aprovada",
    favorita: true,
    arquivada: false,
    versao: "v3.1",
    responsável: "Maria Santos",
    tags: ["last-mile", "e-commerce", "modelo"],
    versoes: [
      { versao: "v3.1", data: "2026-03-20", responsavel: "Maria Santos", observacoes: "Melhorias na abordagem comercial" },
      { versao: "v3.0", data: "2026-02-10", responsavel: "Carlos Oliveira", observacoes: "Nova estrutura" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2025-11-15", responsavel: "Maria Santos" },
      { id: "h2", acao: "Revisão", data: "2026-03-20", responsavel: "Maria Santos", detalhes: "Revisão completa do conteúdo" },
    ],
    criadoEm: "2025-11-15T09:00:00Z",
    atualizadoEm: "2026-03-20T16:00:00Z",
    visualizacoes: 89,
    envios: 28,
  },
  {
    id: "3",
    titulo: "Tabela de Frete - Região Sudeste",
    subtitulo: "Tabela padrão de preços Sudeste",
    descricao: "Tabela de preços de frete para região Sudeste",
    tipo: "modelo",
    categoria: "tabela",
    cliente: null,
    segmento: "Geral",
    tipoServico: "Carga Fracionada",
    status: "pronta",
    favorita: false,
    arquivada: false,
    versao: "v1.5",
    responsável: "Carlos Oliveira",
    tags: ["tabela", "sudeste", "preços"],
    versoes: [
      { versao: "v1.5", data: "2026-04-05", responsavel: "Carlos Oliveira", observacoes: "Reajuste de preços" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-01-01", responsavel: "Carlos Oliveira" },
    ],
    criadoEm: "2026-01-01T08:00:00Z",
    atualizadoEm: "2026-04-05T10:30:00Z",
    visualizacoes: 156,
    envios: 34,
  },
  {
    id: "4",
    titulo: "Proposta Comercial - Magazine Luiza",
    subtitulo: "Proposta de distribuição D+1 para Magazine Luiza",
    descricao: "Proposta personalizada para operação de distribuição",
    tipo: "personalizada",
    categoria: "personalizada",
    cliente: "Magazine Luiza",
    contato: "Roberto Alves",
    email: "roberto.alves@magazineluiza.com.br",
    segmento: "Varejo",
    tipoServico: "Last Mile",
    status: "enviada",
    favorita: true,
    arquivada: false,
    versao: "v1.2",
    responsável: "Diego Balbino",
    tags: ["magalu", "varejo", "distribuição"],
    versoes: [
      { versao: "v1.2", data: "2026-04-08", responsavel: "Diego Balbino", observacoes: "Ajustes após reunião" },
      { versao: "v1.1", data: "2026-04-05", responsavel: "Diego Balbino", observacoes: "Primera versão" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-04-05", responsavel: "Diego Balbino", detalhes: "Criado a partir do modelo Last Mile" },
      { id: "h2", acao: "Envio", data: "2026-04-08", responsavel: "Diego Balbino", detalhes: "Enviado por e-mail" },
      { id: "h3", acao: "Visualização", data: "2026-04-09", responsavel: "Sistema", detalhes: "Cliente visualizou a proposta" },
    ],
    modeloOrigemId: "2",
    personalizado: {
      nomeCliente: "Magazine Luiza",
      textoIntroducao: "Prezado Roberto, apresentamos nossa proposta especializada para operação de last mile.",
      observacoes: "Incluir plano de expansão para 2027",
    },
    criadoEm: "2026-04-05T14:00:00Z",
    atualizadoEm: "2026-04-08T11:20:00Z",
    visualizacoes: 8,
    envios: 1,
  },
  {
    id: "5",
    titulo: "Proposta Comercial - Amazon Logística Brasil",
    subtitulo: "Operação dedicada de cross-docking",
    descricao: "Proposta para operação de cross-docking",
    tipo: "personalizada",
    categoria: "personalizada",
    cliente: "Amazon Logística Brasil",
    contato: "Ana Costa",
    email: "ana.costa@amazon.com.br",
    segmento: "E-commerce",
    tipoServico: "Cross-docking",
    status: "aprovada",
    favorita: false,
    arquivada: false,
    versao: "v2.0",
    responsável: "Maria Santos",
    tags: ["amazon", "cross-docking", "dedicada"],
    versoes: [
      { versao: "v2.0", data: "2026-03-15", responsavel: "Maria Santos", observacoes: "Proposta aprovada com ajustes" },
      { versao: "v1.0", data: "2026-02-20", responsavel: "Maria Santos", observacoes: "Primera versão" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-02-20", responsavel: "Maria Santos" },
      { id: "h2", acao: "Envio", data: "2026-02-25", responsavel: "Maria Santos" },
      { id: "h3", acao: "Aprovação", data: "2026-03-15", responsavel: "Maria Santos", detalhes: "Aprovada com contrato de 2 anos" },
    ],
    modeloOrigemId: "1",
    personalizado: {
      nomeCliente: "Amazon Logística",
      capaPersonalizada: true,
      textoIntroducao: "Prezada Ana, temos prazer em apresentar nossa proposta para operação de cross-docking.",
    },
    criadoEm: "2026-02-20T09:00:00Z",
    atualizadoEm: "2026-03-15T15:00:00Z",
    visualizacoes: 23,
    envios: 2,
  },
  {
    id: "6",
    titulo: "Apresentação - Industrial Pharma",
    subtitulo: "Apresentação de capacidades para indústria farmacêutica",
    descricao: "Apresentação de capacidades para segmento farmacêutico",
    tipo: "modelo",
    categoria: "apresentacao",
    cliente: null,
    segmento: "Farmacêutico",
    tipoServico: "Operação Integrada",
    status: "aprovada",
    favorita: false,
    arquivada: false,
    versao: "v1.0",
    responsável: "Carlos Oliveira",
    tags: ["farmacêutico", "pharma", "apresentação"],
    versoes: [
      { versao: "v1.0", data: "2026-01-20", responsavel: "Carlos Oliveira", observacoes: "Versão inicial" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-01-20", responsavel: "Carlos Oliveira" },
    ],
    criadoEm: "2026-01-20T10:00:00Z",
    atualizadoEm: "2026-01-20T14:00:00Z",
    visualizacoes: 34,
    envios: 8,
  },
  {
    id: "7",
    titulo: "Proposta - Química ABC",
    subtitulo: "Transporte de carga perigosa",
    descricao: "Proposta para transporte de produtos químicos",
    tipo: "personalizada",
    categoria: "personalizada",
    cliente: "Química ABC",
    contato: "Juliano Silva",
    email: "juliano@quimicaabc.com.br",
    segmento: "Químico",
    tipoServico: "Carga Perigosa",
    status: "rascunho",
    favorita: false,
    arquivada: false,
    versao: "v0.1",
    responsável: "Diego Balbino",
    tags: ["química", "perigosa", "risco"],
    versoes: [],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-04-10", responsavel: "Diego Balbino", detalhes: "Criado a partir do modelo Carga Fracionada" },
    ],
    modeloOrigemId: "2",
    criadoEm: "2026-04-10T11:00:00Z",
    atualizadoEm: "2026-04-10T11:45:00Z",
    visualizacoes: 2,
    envios: 0,
  },
  {
    id: "8",
    titulo: "Proposta Institucional - Parceiros Estratégicos",
    subtitulo: "Apresentação para novos parceiros",
    descricao: "Apresentação institucional para parceamento",
    tipo: "modelo",
    categoria: "institucional",
    cliente: null,
    segmento: "Geral",
    tipoServico: "Parceria",
    status: "pronta",
    favorita: false,
    arquivada: false,
    versao: "v1.0",
    responsável: "Maria Santos",
    tags: ["parceiros", "parceria", "institucional"],
    versoes: [
      { versao: "v1.0", data: "2026-02-01", responsavel: "Maria Santos", observacoes: "Versão inicial" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-02-01", responsavel: "Maria Santos" },
    ],
    criadoEm: "2026-02-01T09:00:00Z",
    atualizadoEm: "2026-02-01T16:00:00Z",
    visualizacoes: 67,
    envios: 15,
  },
  {
    id: "9",
    titulo: "Tabela de Frete - Região Nordeste",
    subtitulo: "Tabela de preços Nordeste",
    descricao: "Tabela de preços de frete para região Nordeste",
    tipo: "modelo",
    categoria: "tabela",
    cliente: null,
    segmento: "Geral",
    tipoServico: "Carga Fracionada",
    status: "rascunho",
    favorita: false,
    arquivada: false,
    versao: "v0.5",
    responsável: "Carlos Oliveira",
    tags: ["tabela", "nordeste", "preços"],
    versoes: [],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-04-01", responsavel: "Carlos Oliveira" },
    ],
    criadoEm: "2026-04-01T08:00:00Z",
    atualizadoEm: "2026-04-01T12:00:00Z",
    visualizacoes: 5,
    envios: 0,
  },
  {
    id: "10",
    titulo: "Apresentação Corporate - Mercado Livre",
    subtitulo: "Apresentação para operação Marketplace",
    descricao: "Apresentação de capacidades para Mercado Livre",
    tipo: "personalizada",
    categoria: "personalizada",
    cliente: "Mercado Livre",
    contato: "Pedro Santos",
    email: "pedro.santos@mercadolivre.com",
    segmento: "E-commerce",
    tipoServico: "Operação Integrada",
    status: "visualizada",
    favorita: true,
    arquivada: false,
    versao: "v1.0",
    responsável: "Diego Balbino",
    tags: ["mercadolibre", "marketplace", "operação"],
    versoes: [
      { versao: "v1.0", data: "2026-04-02", responsavel: "Diego Balbino", observacoes: "Versão inicial" },
    ],
    historico: [
      { id: "h1", acao: "Criação", data: "2026-04-02", responsavel: "Diego Balbino" },
      { id: "h2", acao: "Envio", data: "2026-04-03", responsavel: "Diego Balbino" },
      { id: "h3", acao: "Visualização", data: "2026-04-04", responsavel: "Sistema", detalhes: "Visualizado 3 vezes" },
    ],
    modeloOrigemId: "1",
    personalizado: {
      nomeCliente: "Mercado Livre Brasil",
      textoIntroducao: "Prezado Pedro, apresentamos nossas capacidades logísticas.",
    },
    criadoEm: "2026-04-02T14:00:00Z",
    atualizadoEm: "2026-04-03T10:00:00Z",
    visualizacoes: 12,
    envios: 1,
  },
];

export const getStatusColor = (status: string) => {
  switch (status) {
    case "rascunho": return "bg-slate-100 text-slate-600 border-slate-300";
    case "em_edicao": return "bg-blue-100 text-blue-600 border-blue-300";
    case "pronta": return "bg-amber-100 text-amber-600 border-amber-300";
    case "enviada": return "bg-purple-100 text-purple-600 border-purple-300";
    case "visualizada": return "bg-cyan-100 text-cyan-600 border-cyan-300";
    case "aprovada": return "bg-green-100 text-green-600 border-green-300";
    case "rejeitada": return "bg-red-100 text-red-600 border-red-300";
    case "arquivada": return "bg-gray-100 text-gray-500 border-gray-300";
    default: return "bg-slate-100 text-slate-600";
  }
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case "rascunho": return "Rascunho";
    case "em_edicao": return "Em Edição";
    case "pronta": return "Pronta";
    case "enviada": return "Enviada";
    case "visualizada": return "Visualizada";
    case "aprovada": return "Aprovada";
    case "rejeitada": return "Rejeitada";
    case "arquivada": return "Arquivada";
    default: return status;
  }
};