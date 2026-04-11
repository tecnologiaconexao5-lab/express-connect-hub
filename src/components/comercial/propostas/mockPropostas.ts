<<<<<<< HEAD
export const mockPropostas = [
=======
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
  envios?: number;
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
>>>>>>> b5942ea (feat: implement contract generation modal with PDF export and add new pages for Finance, Fiscal, and Integration monitoring.)
  {
    id: "1",
    titulo: "Proposta Logística SaaS - Modelo Padrão",
    subtitulo: "Apresentação de serviços dedicados",
    tipo: "modelo",
    cliente: null,
    segmento: "Logística B2B",
    tipoServico: "Carga Fechada",
    status: "aprovada",
    favorita: true,
    criadoEm: "2026-04-01T10:00:00Z",
    atualizadoEm: "2026-04-05T14:30:00Z",
  },
  {
    id: "2",
    titulo: "Operação Dedicada - Amazon",
    subtitulo: "Distribuição Capital",
    tipo: "personalizada",
    cliente: "Amazon Logística",
    segmento: "E-commerce",
    tipoServico: "Last Mile",
    status: "enviada",
    favorita: false,
    criadoEm: "2026-04-08T09:15:00Z",
    atualizadoEm: "2026-04-09T16:20:00Z",
    modeloOrigemId: "1",
  },
  {
    id: "3",
    titulo: "Proposta Spot - Indústria Química",
    subtitulo: "Transporte de Carga Perigosa",
    tipo: "personalizada",
    cliente: "Química ABC",
    segmento: "Químico",
    tipoServico: "Carga Fracionada",
    status: "rascunho",
    favorita: false,
    criadoEm: "2026-04-10T11:00:00Z",
    atualizadoEm: "2026-04-10T11:45:00Z",
  },
  {
    id: "4",
    titulo: "Logística Reversa Varejo - Base",
    subtitulo: "Template oficial de Logística Reversa",
    tipo: "modelo",
    cliente: null,
    segmento: "Varejo",
    tipoServico: "Logística Reversa",
    status: "aprovada",
    favorita: true,
    criadoEm: "2026-03-15T08:00:00Z",
    atualizadoEm: "2026-03-20T10:00:00Z",
  }
];
