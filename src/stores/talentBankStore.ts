import { create } from "zustand";

export type PerfilOperacional = "urbano" | "leve" | "pesado" | "emergencia" | "rota_fixa" | "coleta" | "viagem";
export type StatusDocumental = "completo" | "pendente" | "parcial" | "expirado";
export type NivelScore = "bronze" | "prata" | "ouro" | "diamante";
export type TagAutomatica = "alta_prioridade" | "noturno" | "documentacao_pendente" | "urbano" | "pesado" | "refrigerado";

export interface TalentoLogistico {
  id: string;
  nome: string;
  foto: string;
  telefone: string;
  email: string;
  cpf: string;
  dataCadastro: string;
  score: number;
  nivel: NivelScore;
  statusDocumental: StatusDocumental;
  disponivel: boolean;
  experienciaAnos: number;
  perfisOperacionais: PerfilOperacional[];
  tagsAutomaticas: TagAutomatica[];
  tagsPersonalizadas: string[];
  cidade: string;
  bairro: string;
  regiao: string;
  estado: string;
  veiculo: { tipo: string; modelo: string; placa: string; ano: number; capacidade: string; carroceria: string };
  regioesAtuacao: string[];
  horarios: { inicio: string; fim: string };
  fazColeta: boolean;
  fazEntrega: boolean;
  distanciaMaxima: number;
  cargaPreferida: string[];
  totalViagens: number;
  totalAceitas: number;
  taxaAceite: number;
  receitaTotal: number;
  receitaMediaMes: number;
  diasSemOperar: number;
  ultimaOperacao: string | null;
  documentos: { tipo: string; status: "aprovado" | "pendente" | "expirado"; vencimento: string }[];
  favorito: boolean;
  shortlistId: string | null;
  scoreCompatibilidade: number;
}

export interface Shortlist {
  id: string;
  nome: string;
  descricao: string;
  talentos: string[];
  criadaEm: string;
  cor: string;
}

export interface RegiaoCritica {
  id: string;
  nome: string;
  demanda: number;
  oferta: number;
  deficit: number;
  cor: string;
}

export interface FiltrosAvancados {
  busca: string;
  cidades: string[];
  bairros: string[];
  regioes: string[];
  estados: string[];
  tiposVeiculo: string[];
  scoreMin: number;
  scoreMax: number;
  disponivel: boolean | null;
  experienciaMin: number;
  experienciaMax: number;
  statusDocumental: StatusDocumental[];
  perfisOperacionais: PerfilOperacional[];
  tags: string[];
  cargasPreferidas: string[];
  fazColeta: boolean | null;
  fazEntrega: boolean | null;
  compatibilidadeMin: number;
  ordenarPor: "score" | "experiencia" | "taxaAceite" | "receita" | "compatibilidade" | "data";
  ordem: "asc" | "desc";
}

export interface MetricaConversao {
  etapa: string;
  total: number;
  convertidos: number;
  taxa: number;
}

export interface MetricaRetencao {
  mes: string;
  ativos: number;
  novos: number;
  perdidos: number;
  taxaRetencao: number;
}

export interface TalentBankState {
  talentos: TalentoLogistico[];
  shortlists: Shortlist[];
  filtros: FiltrosAvancados;
  modoExibicao: "grid" | "list";
  talentoAtivo: string | null;
  metricasConversao: MetricaConversao[];
  metricasRetencao: MetricaRetencao[];
  regioesCriticas: RegiaoCritica[];

  setTalentoAtivo: (id: string | null) => void;
  setModoExibicao: (modo: "grid" | "list") => void;
  atualizarFiltros: (filtros: Partial<FiltrosAvancados>) => void;
  limparFiltros: () => void;
  toggleFavorito: (id: string) => void;
  adicionarShortlist: (nome: string, descricao: string) => string;
  removerShortlist: (id: string) => void;
  adicionarTalentShortlist: (shortlistId: string, talentoId: string) => void;
  removerTalentShortlist: (shortlistId: string, talentoId: string) => void;
  adicionarTagPersonalizada: (talentoId: string, tag: string) => void;
  removerTagPersonalizada: (talentoId: string, tag: string) => void;
  recalcularCompatibilidade: (operacao: { tipoCarga: string; regiao: string; peso: string; distancia: number }) => void;
}

const CORES_SHORTLIST = ["#f97316", "#06b6d4", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b"];

function calcularNivel(score: number): NivelScore {
  if (score >= 86) return "diamante";
  if (score >= 66) return "ouro";
  if (score >= 41) return "prata";
  return "bronze";
}

function gerarTags(t: Partial<TalentoLogistico>): TagAutomatica[] {
  const tags: TagAutomatica[] = [];
  if ((t.score || 0) >= 80) tags.push("alta_prioridade");
  if (t.cargaPreferida?.some((c) => c.toLowerCase().includes("refrigerado"))) tags.push("refrigerado");
  if (t.veiculo?.tipo && ["Truck", "Bitrem", "Carreta", "Rodotrem"].includes(t.veiculo.tipo)) tags.push("pesado");
  if (t.regioesAtuacao?.some((r) => ["Grande SP", "ABC Paulista", "Litoral SP"].includes(r))) tags.push("urbano");
  return tags;
}

const mockTalentos: TalentoLogistico[] = [
  { id: "t1", nome: "Carlos Silva", foto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face", telefone: "(11) 99999-8888", email: "carlos.silva@email.com", cpf: "123.456.789-00", dataCadastro: "2025-06-15", score: 92, nivel: "diamante", statusDocumental: "completo", disponivel: true, experienciaAnos: 12, perfisOperacionais: ["pesado", "viagem", "rota_fixa"], tagsAutomaticas: ["alta_prioridade", "pesado"], tagsPersonalizadas: ["top_performer"], cidade: "São Paulo", bairro: "Barra Funda", regiao: "Grande SP", estado: "SP", veiculo: { tipo: "Carreta", modelo: "Volvo FH 460", placa: "BRA7E23", ano: 2023, capacidade: "20+ ton", carroceria: "Baú Fechado" }, regioesAtuacao: ["Grande SP", "Interior SP", "Rio de Janeiro", "Paraná"], horarios: { inicio: "05:00", fim: "20:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 1500, cargaPreferida: ["Carga Seca", "Eletrônicos", "Alimentos"], totalViagens: 342, totalAceitas: 328, taxaAceite: 96, receitaTotal: 542000, receitaMediaMes: 28400, diasSemOperar: 0, ultimaOperacao: "2026-05-11", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2028-06-15" }, { tipo: "CRLV", status: "aprovado", vencimento: "2027-03-31" }, { tipo: "ANTT", status: "aprovado", vencimento: "2026-12-31" }], favorito: true, shortlistId: null, scoreCompatibilidade: 94 },
  { id: "t2", nome: "Ana Oliveira", foto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face", telefone: "(11) 98888-7777", email: "ana.oliveira@email.com", cpf: "987.654.321-00", dataCadastro: "2025-08-20", score: 85, nivel: "ouro", statusDocumental: "completo", disponivel: true, experienciaAnos: 8, perfisOperacionais: ["pesado", "viagem", "emergencia"], tagsAutomaticas: ["pesado", "alta_prioridade"], tagsPersonalizadas: ["carga_perigosa"], cidade: "Campinas", bairro: "Cambuí", regiao: "Interior SP", estado: "SP", veiculo: { tipo: "Bitrem", modelo: "Scania R450", placa: "MER4B12", ano: 2022, capacidade: "10 - 20 ton", carroceria: "Baú Refrigerado" }, regioesAtuacao: ["Interior SP", "Belo Horizonte", "Paraná"], horarios: { inicio: "06:00", fim: "22:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 1200, cargaPreferida: ["Carga Refrigerada", "Alimentos", "Carga Perigosa"], totalViagens: 215, totalAceitas: 198, taxaAceite: 92, receitaTotal: 398000, receitaMediaMes: 22100, diasSemOperar: 2, ultimaOperacao: "2026-05-09", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2027-08-20" }, { tipo: "CRLV", status: "aprovado", vencimento: "2027-03-31" }, { tipo: "MOPP", status: "aprovado", vencimento: "2027-06-15" }], favorito: false, shortlistId: null, scoreCompatibilidade: 88 },
  { id: "t3", nome: "Roberto Santos", foto: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face", telefone: "(11) 97777-6666", email: "roberto.santos@email.com", cpf: "456.789.123-00", dataCadastro: "2025-03-10", score: 78, nivel: "ouro", statusDocumental: "parcial", disponivel: true, experienciaAnos: 15, perfisOperacionais: ["pesado", "viagem", "rota_fixa"], tagsAutomaticas: ["pesado"], tagsPersonalizadas: ["experiente"], cidade: "São Bernardo do Campo", bairro: "Rudge Ramos", regiao: "ABC Paulista", estado: "SP", veiculo: { tipo: "Truck", modelo: "Mercedes-Benz Actros", placa: "ABC1D23", ano: 2021, capacidade: "5 - 10 ton", carroceria: "Sider" }, regioesAtuacao: ["Grande SP", "ABC Paulista", "Interior SP"], horarios: { inicio: "07:00", fim: "19:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 800, cargaPreferida: ["Carga Seca", "Mudanças"], totalViagens: 456, totalAceitas: 401, taxaAceite: 88, receitaTotal: 612000, receitaMediaMes: 25600, diasSemOperar: 5, ultimaOperacao: "2026-05-06", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2027-03-10" }, { tipo: "CRLV", status: "aprovado", vencimento: "2027-03-31" }, { tipo: "ANTT", status: "pendente", vencimento: "2026-08-15" }], favorito: false, shortlistId: null, scoreCompatibilidade: 82 },
  { id: "t4", nome: "Maria Costa", foto: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face", telefone: "(13) 96666-5555", email: "maria.costa@email.com", cpf: "321.654.987-00", dataCadastro: "2025-11-01", score: 45, nivel: "prata", statusDocumental: "expirado", disponivel: false, experienciaAnos: 5, perfisOperacionais: ["urbano", "leve", "coleta"], tagsAutomaticas: ["documentacao_pendente", "urbano"], tagsPersonalizadas: [], cidade: "Santos", bairro: "Gonzaga", regiao: "Litoral SP", estado: "SP", veiculo: { tipo: "VUC", modelo: "Ford Transit", placa: "SANT0A1", ano: 2020, capacidade: "1 - 3 ton", carroceria: "Baú Fechado" }, regioesAtuacao: ["Litoral SP", "Grande SP"], horarios: { inicio: "08:00", fim: "18:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 200, cargaPreferida: ["Alimentos", "Documentos"], totalViagens: 89, totalAceitas: 72, taxaAceite: 81, receitaTotal: 98000, receitaMediaMes: 8200, diasSemOperar: 45, ultimaOperacao: "2026-03-28", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2027-11-01" }, { tipo: "CRLV", status: "expirado", vencimento: "2026-03-31" }, { tipo: "Seguro", status: "expirado", vencimento: "2026-04-15" }], favorito: false, shortlistId: null, scoreCompatibilidade: 55 },
  { id: "t5", nome: "João Pereira", foto: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face", telefone: "(11) 95555-4444", email: "joao.pereira@email.com", cpf: "654.321.987-00", dataCadastro: "2026-01-15", score: 58, nivel: "prata", statusDocumental: "pendente", disponivel: true, experienciaAnos: 3, perfisOperacionais: ["urbano", "leve", "coleta", "emergencia"], tagsAutomaticas: ["urbano", "documentacao_pendente"], tagsPersonalizadas: ["novato", "treinamento"], cidade: "São Paulo", bairro: "Vila Mariana", regiao: "Grande SP", estado: "SP", veiculo: { tipo: "Fiorino/Van", modelo: "Fiat Fiorino", placa: "JOA1P23", ano: 2022, capacidade: "Até 500 kg", carroceria: "Baú Fechado" }, regioesAtuacao: ["Grande SP", "ABC Paulista"], horarios: { inicio: "06:00", fim: "23:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 100, cargaPreferida: ["Documentos", "Alimentos", "Eletrônicos"], totalViagens: 34, totalAceitas: 28, taxaAceite: 82, receitaTotal: 28500, receitaMediaMes: 7100, diasSemOperar: 1, ultimaOperacao: "2026-05-10", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2028-01-15" }, { tipo: "CRLV", status: "pendente", vencimento: "2027-03-31" }], favorito: false, shortlistId: null, scoreCompatibilidade: 68 },
  { id: "t6", nome: "Patrícia Lima", foto: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face", telefone: "(21) 94444-3333", email: "patricia.lima@email.com", cpf: "789.123.456-00", dataCadastro: "2025-05-20", score: 72, nivel: "ouro", statusDocumental: "completo", disponivel: true, experienciaAnos: 7, perfisOperacionais: ["pesado", "viagem", "rota_fixa"], tagsAutomaticas: ["pesado"], tagsPersonalizadas: ["rota_longa"], cidade: "Rio de Janeiro", bairro: "Copacabana", regiao: "Rio de Janeiro", estado: "RJ", veiculo: { tipo: "Truck", modelo: "Volkswagen Constellation 19.330", placa: "RIO2E45", ano: 2022, capacidade: "5 - 10 ton", carroceria: "Baú Fechado" }, regioesAtuacao: ["Rio de Janeiro", "Grande SP", "Belo Horizonte"], horarios: { inicio: "04:00", fim: "22:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 1000, cargaPreferida: ["Carga Seca", "Eletrônicos", "Alimentos"], totalViagens: 178, totalAceitas: 162, taxaAceite: 91, receitaTotal: 285000, receitaMediaMes: 18900, diasSemOperar: 0, ultimaOperacao: "2026-05-11", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2027-05-20" }, { tipo: "CRLV", status: "aprovado", vencimento: "2027-03-31" }, { tipo: "ANTT", status: "aprovado", vencimento: "2027-12-31" }], favorito: true, shortlistId: null, scoreCompatibilidade: 86 },
  { id: "t7", nome: "Fernando Alves", foto: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face", telefone: "(41) 93333-2222", email: "fernando.alves@email.com", cpf: "147.258.369-00", dataCadastro: "2025-09-10", score: 62, nivel: "prata", statusDocumental: "parcial", disponivel: true, experienciaAnos: 10, perfisOperacionais: ["pesado", "viagem"], tagsAutomaticas: ["pesado"], tagsPersonalizadas: [], cidade: "Curitiba", bairro: "Batel", regiao: "Paraná", estado: "PR", veiculo: { tipo: "Rodotrem", modelo: "Scania R500", placa: "CUR1T3B", ano: 2021, capacidade: "20+ ton", carroceria: "Graneleiro" }, regioesAtuacao: ["Paraná", "Santa Catarina", "Rio Grande do Sul"], horarios: { inicio: "05:00", fim: "18:00" }, fazColeta: false, fazEntrega: true, distanciaMaxima: 2000, cargaPreferida: ["Carga Seca", "Grãos"], totalViagens: 289, totalAceitas: 251, taxaAceite: 87, receitaTotal: 425000, receitaMediaMes: 23600, diasSemOperar: 3, ultimaOperacao: "2026-05-08", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2027-09-10" }, { tipo: "CRLV", status: "aprovado", vencimento: "2027-03-31" }, { tipo: "ANTT", status: "pendente", vencimento: "2026-10-20" }], favorito: false, shortlistId: null, scoreCompatibilidade: 72 },
  { id: "t8", nome: "Lucia Mendes", foto: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=200&h=200&fit=crop&crop=face", telefone: "(31) 92222-1111", email: "lucia.mendes@email.com", cpf: "258.369.147-00", dataCadastro: "2025-07-05", score: 68, nivel: "ouro", statusDocumental: "completo", disponivel: true, experienciaAnos: 6, perfisOperacionais: ["pesado", "viagem", "emergencia"], tagsAutomaticas: ["pesado"], tagsPersonalizadas: ["carga_seca"], cidade: "Belo Horizonte", bairro: "Funcionários", regiao: "Belo Horizonte", estado: "MG", veiculo: { tipo: "Bitrem", modelo: "Volvo FH 440", placa: "BHT4M90", ano: 2023, capacidade: "10 - 20 ton", carroceria: "Sider" }, regioesAtuacao: ["Belo Horizonte", "Grande SP", "Rio de Janeiro", "Interior SP"], horarios: { inicio: "06:00", fim: "20:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 1200, cargaPreferida: ["Carga Seca", "Alimentos"], totalViagens: 145, totalAceitas: 131, taxaAceite: 90, receitaTotal: 210000, receitaMediaMes: 16800, diasSemOperar: 1, ultimaOperacao: "2026-05-10", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2027-07-05" }, { tipo: "CRLV", status: "aprovado", vencimento: "2027-03-31" }, { tipo: "ANTT", status: "aprovado", vencimento: "2027-06-30" }], favorito: false, shortlistId: null, scoreCompatibilidade: 78 },
  { id: "t9", nome: "Pedro Rocha", foto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face", telefone: "(11) 91111-0000", email: "pedro.rocha@email.com", cpf: "369.147.258-00", dataCadastro: "2026-02-01", score: 35, nivel: "bronze", statusDocumental: "pendente", disponivel: true, experienciaAnos: 1, perfisOperacionais: ["urbano", "leve", "coleta"], tagsAutomaticas: ["urbano", "documentacao_pendente"], tagsPersonalizadas: [], cidade: "Osasco", bairro: "Centro", regiao: "Grande SP", estado: "SP", veiculo: { tipo: "Fiorino/Van", modelo: "Renault Kangoo", placa: "PED5R67", ano: 2023, capacidade: "Até 500 kg", carroceria: "Baú Fechado" }, regioesAtuacao: ["Grande SP"], horarios: { inicio: "08:00", fim: "19:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 80, cargaPreferida: ["Documentos", "Alimentos"], totalViagens: 12, totalAceitas: 10, taxaAceite: 83, receitaTotal: 8900, receitaMediaMes: 4500, diasSemOperar: 0, ultimaOperacao: "2026-05-11", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2028-02-01" }, { tipo: "CRLV", status: "pendente", vencimento: "2027-03-31" }], favorito: false, shortlistId: null, scoreCompatibilidade: 42 },
  { id: "t10", nome: "Carla Souza", foto: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face", telefone: "(11) 90000-1111", email: "carla.souza@email.com", cpf: "951.753.852-00", dataCadastro: "2025-04-12", score: 88, nivel: "diamante", statusDocumental: "completo", disponivel: false, experienciaAnos: 9, perfisOperacionais: ["pesado", "viagem", "emergencia", "rota_fixa"], tagsAutomaticas: ["alta_prioridade", "pesado"], tagsPersonalizadas: ["multi_modal"], cidade: "Guarulhos", bairro: "Vila Augusta", regiao: "Grande SP", estado: "SP", veiculo: { tipo: "Carreta", modelo: "Scania R460", placa: "CAR4L5A", ano: 2024, capacidade: "20+ ton", carroceria: "Baú Refrigerado" }, regioesAtuacao: ["Grande SP", "Interior SP", "Rio de Janeiro", "Belo Horizonte", "Paraná"], horarios: { inicio: "04:00", fim: "23:00" }, fazColeta: true, fazEntrega: true, distanciaMaxima: 2000, cargaPreferida: ["Carga Refrigerada", "Alimentos", "Carga Perigosa", "Eletrônicos"], totalViagens: 312, totalAceitas: 296, taxaAceite: 95, receitaTotal: 498000, receitaMediaMes: 31200, diasSemOperar: 10, ultimaOperacao: "2026-05-01", documentos: [{ tipo: "CNH", status: "aprovado", vencimento: "2027-04-12" }, { tipo: "CRLV", status: "aprovado", vencimento: "2027-03-31" }, { tipo: "ANTT", status: "aprovado", vencimento: "2027-12-31" }, { tipo: "MOPP", status: "aprovado", vencimento: "2027-08-15" }], favorito: true, shortlistId: null, scoreCompatibilidade: 91 },
];

const mockShortlists: Shortlist[] = [
  { id: "s1", nome: "Top Performers", descricao: "Melhores prestadores com score > 85", talentos: ["t1", "t6", "t10"], criadaEm: "2026-03-01", cor: "#f97316" },
  { id: "s2", nome: "Urgente - Refrigerado", descricao: "Prestadores com disponibilidade para carga refrigerada", talentos: ["t2"], criadaEm: "2026-04-15", cor: "#06b6d4" },
  { id: "s3", nome: "Nova Região - RJ", descricao: "Expandir operações no Rio de Janeiro", talentos: ["t6"], criadaEm: "2026-05-01", cor: "#8b5cf6" },
];

const mockRegioesCriticas: RegiaoCritica[] = [
  { id: "r1", nome: "Grande SP", demanda: 450, oferta: 320, deficit: -130, cor: "#ef4444" },
  { id: "r2", nome: "Rio de Janeiro", demanda: 280, oferta: 190, deficit: -90, cor: "#f97316" },
  { id: "r3", nome: "Interior SP", demanda: 200, oferta: 180, deficit: -20, cor: "#eab308" },
  { id: "r4", nome: "Belo Horizonte", demanda: 180, oferta: 120, deficit: -60, cor: "#f97316" },
  { id: "r5", nome: "ABC Paulista", demanda: 150, oferta: 140, deficit: -10, cor: "#22c55e" },
  { id: "r6", nome: "Paraná", demanda: 120, oferta: 90, deficit: -30, cor: "#eab308" },
];

const FILTROS_PADRAO: FiltrosAvancados = {
  busca: "", cidades: [], bairros: [], regioes: [], estados: [],
  tiposVeiculo: [], scoreMin: 0, scoreMax: 100, disponivel: null,
  experienciaMin: 0, experienciaMax: 50, statusDocumental: [],
  perfisOperacionais: [], tags: [], cargasPreferidas: [],
  fazColeta: null, fazEntrega: null, compatibilidadeMin: 0,
  ordenarPor: "score", ordem: "desc",
};

const metricasConversao: MetricaConversao[] = [
  { etapa: "Novos Leads", total: 450, convertidos: 320, taxa: 71 },
  { etapa: "Documentação", total: 320, convertidos: 245, taxa: 77 },
  { etapa: "Treinamento", total: 245, convertidos: 210, taxa: 86 },
  { etapa: "Homologação", total: 210, convertidos: 185, taxa: 88 },
  { etapa: "Ativação", total: 185, convertidos: 165, taxa: 89 },
  { etapa: "Primeira Operação", total: 165, convertidos: 150, taxa: 91 },
];

const metricasRetencao: MetricaRetencao[] = [
  { mes: "Jan", ativos: 120, novos: 15, perdidos: 8, taxaRetencao: 93 },
  { mes: "Fev", ativos: 127, novos: 12, perdidos: 5, taxaRetencao: 96 },
  { mes: "Mar", ativos: 134, novos: 18, perdidos: 11, taxaRetencao: 92 },
  { mes: "Abr", ativos: 141, novos: 20, perdidos: 13, taxaRetencao: 91 },
  { mes: "Mai", ativos: 148, novos: 22, perdidos: 15, taxaRetencao: 90 },
];

export const useTalentBankStore = create<TalentBankState>()((set) => ({
  talentos: mockTalentos,
  shortlists: mockShortlists,
  filtros: { ...FILTROS_PADRAO },
  modoExibicao: "grid",
  talentoAtivo: null,
  metricasConversao: metricasConversao,
  metricasRetencao: metricasRetencao,
  regioesCriticas: mockRegioesCriticas,

  setTalentoAtivo: (id) => set({ talentoAtivo: id }),
  setModoExibicao: (modo) => set({ modoExibicao: modo }),

  atualizarFiltros: (filtros) => set((s) => ({ filtros: { ...s.filtros, ...filtros } })),
  limparFiltros: () => set({ filtros: { ...FILTROS_PADRAO } }),

  toggleFavorito: (id) => set((s) => ({ talentos: s.talentos.map((t) => t.id === id ? { ...t, favorito: !t.favorito } : t) })),

  adicionarShortlist: (nome, descricao) => {
    const id = crypto.randomUUID();
    const cor = CORES_SHORTLIST[Math.floor(Math.random() * CORES_SHORTLIST.length)];
    set((s) => ({ shortlists: [...s.shortlists, { id, nome, descricao, talentos: [], criadaEm: new Date().toISOString().split("T")[0], cor }] }));
    return id;
  },

  removerShortlist: (id) => set((s) => ({
    shortlists: s.shortlists.filter((sl) => sl.id !== id),
    talentos: s.talentos.map((t) => t.shortlistId === id ? { ...t, shortlistId: null } : t),
  })),

  adicionarTalentShortlist: (shortlistId, talentoId) => set((s) => ({
    shortlists: s.shortlists.map((sl) => sl.id === shortlistId ? { ...sl, talentos: [...sl.talentos, talentoId] } : sl),
    talentos: s.talentos.map((t) => t.id === talentoId ? { ...t, shortlistId } : t),
  })),

  removerTalentShortlist: (shortlistId, talentoId) => set((s) => ({
    shortlists: s.shortlists.map((sl) => sl.id === shortlistId ? { ...sl, talentos: sl.talentos.filter((tid) => tid !== talentoId) } : sl),
    talentos: s.talentos.map((t) => t.id === talentoId ? { ...t, shortlistId: null } : t),
  })),

  adicionarTagPersonalizada: (talentoId, tag) => set((s) => ({
    talentos: s.talentos.map((t) => t.id === talentoId ? { ...t, tagsPersonalizadas: [...new Set([...t.tagsPersonalizadas, tag])] } : t),
  })),

  removerTagPersonalizada: (talentoId, tag) => set((s) => ({
    talentos: s.talentos.map((t) => t.id === talentoId ? { ...t, tagsPersonalizadas: t.tagsPersonalizadas.filter((tg) => tg !== tag) } : t),
  })),

  recalcularCompatibilidade: (operacao) => set((s) => ({
    talentos: s.talentos.map((t) => {
      let score = 0;
      if (t.cargaPreferida.some((c) => c.toLowerCase().includes(operacao.tipoCarga.toLowerCase()) || operacao.tipoCarga.toLowerCase().includes(c.toLowerCase()))) score += 30;
      if (t.regioesAtuacao.some((r) => operacao.regiao.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(operacao.regiao.toLowerCase()))) score += 25;
      if (t.disponivel) score += 20;
      if (t.distanciaMaxima >= operacao.distancia) score += 15;
      if (t.statusDocumental === "completo") score += 10;
      return { ...t, scoreCompatibilidade: Math.min(score, 100) };
    }),
  })),
}));
