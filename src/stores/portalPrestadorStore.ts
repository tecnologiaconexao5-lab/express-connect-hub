import { create } from "zustand";
import { calculateScore, type ScoreResult } from "@/services/scoreEngine";

export interface Notificacao {
  id: string;
  tipo: "operacao" | "documento" | "financeiro" | "treinamento" | "sistema";
  titulo: string;
  mensagem: string;
  lida: boolean;
  data: string;
}

export interface Operacao {
  id: string;
  origem: string;
  destino: string;
  carga: string;
  peso: string;
  valor: number;
  distancia: string;
  status: "pendente" | "aceita" | "recusada" | "em_andamento" | "concluida" | "cancelada";
  dataCriacao: string;
  dataColeta?: string;
  dataEntrega?: string;
  cliente: string;
  tipoCarga: string;
}

export interface DocumentoPrestador {
  id: string;
  tipo: string;
  nome: string;
  status: "aprovado" | "pendente" | "rejeitado" | "expirado";
  dataEnvio: string;
  dataVencimento?: string;
  observacao?: string;
  url?: string;
}

export interface Treinamento {
  id: string;
  titulo: string;
  tipo: "video" | "prova" | "certificado";
  status: "completo" | "em_andamento" | "pendente";
  progresso: number;
  duracao: string;
  imagem: string;
  concluidoEm?: string;
}

export interface Transacao {
  id: string;
  tipo: "recebido" | "repassado" | "taxa" | "bonus";
  descricao: string;
  valor: number;
  data: string;
  operacaoId?: string;
  comprovanteUrl?: string;
}

export interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  pix: string;
}

export interface PrestadorPerfil {
  nome: string;
  foto: string;
  email: string;
  telefone: string;
  cpf: string;
  dataCadastro: string;
  dadosBancarios: DadosBancarios;
  veiculos: { id: string; modelo: string; placa: string; tipo: string; ano: string }[];
  regioes: string[];
  horariosInicio: string;
  horariosFim: string;
  fazColeta: boolean;
  fazEntrega: boolean;
}

export interface PortalPrestadorState {
  perfil: PrestadorPerfil;
  score: ScoreResult;
  disponivel: boolean;
  ganhosMes: number;
  ganhosSemana: number;
  ranking: number;
  totalPrestadores: number;
  operacoesPendentes: number;
  operacoesAtivas: number;
  notificacoes: Notificacao[];
  operacoes: Operacao[];
  documentos: DocumentoPrestador[];
  treinamentos: Treinamento[];
  transacoes: Transacao[];

  toggleDisponivel: () => void;
  aceitarOperacao: (id: string) => void;
  recusarOperacao: (id: string) => void;
  iniciarOperacao: (id: string) => void;
  concluirOperacao: (id: string) => void;
  marcarNotificacaoLida: (id: string) => void;
  marcarTodasLidas: () => void;
  atualizarPerfil: (data: Partial<PrestadorPerfil>) => void;
  atualizarRegioes: (regioes: string[]) => void;
  atualizarDisponibilidade: (inicio: string, fim: string) => void;
  atualizarDocumento: (id: string, status: DocumentoPrestador["status"], obs?: string) => void;
  adicionarDocumento: (doc: DocumentoPrestador) => void;
  iniciarTreinamento: (id: string) => void;
  concluirTreinamento: (id: string) => void;
  recalcularScore: () => void;
}

const mockNotificacoes: Notificacao[] = [
  { id: "n1", tipo: "operacao", titulo: "Nova operação disponível", mensagem: "Carga de eletrônicos de SP para RJ — R$ 1.200", lida: false, data: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: "n2", tipo: "documento", titulo: "Documento aprovado", mensagem: "Seu CRLV foi validado com sucesso!", lida: false, data: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: "n3", tipo: "financeiro", titulo: "Pagamento recebido", mensagem: "R$ 890,00 da operação #OP-2026-0442", lida: true, data: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: "n4", tipo: "treinamento", titulo: "Novo treinamento disponível", mensagem: "Direção defensiva — complete e ganhe bonus no score", lida: true, data: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
];

const mockOperacoes: Operacao[] = [
  { id: "op1", origem: "São Paulo, SP", destino: "Rio de Janeiro, RJ", carga: "Eletrônicos", peso: "800 kg", valor: 1200, distancia: "430 km", status: "pendente", dataCriacao: new Date(Date.now() - 1000 * 60 * 30).toISOString(), cliente: "TechLog Ltda", tipoCarga: "Carga Seca" },
  { id: "op2", origem: "Campinas, SP", destino: "Belo Horizonte, MG", carga: "Alimentos refrigerados", peso: "1.200 kg", valor: 1850, distancia: "580 km", status: "pendente", dataCriacao: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), cliente: "FoodExpress", tipoCarga: "Carga Refrigerada" },
  { id: "op3", origem: "São Paulo, SP", destino: "Curitiba, PR", carga: "Peças automotivas", peso: "2.000 kg", valor: 2100, distancia: "410 km", status: "aceita", dataCriacao: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), dataColeta: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), cliente: "AutoPeças Sul", tipoCarga: "Carga Seca" },
  { id: "op4", origem: "São Bernardo, SP", destino: "São Paulo, SP", carga: "Móveis planejados", peso: "500 kg", valor: 680, distancia: "25 km", status: "em_andamento", dataCriacao: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), dataColeta: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), cliente: "Móveis Lux", tipoCarga: "Mudanças" },
  { id: "op5", origem: "Guarulhos, SP", destino: "São Paulo, SP", carga: "Medicamentos", peso: "300 kg", valor: 450, distancia: "30 km", status: "concluida", dataCriacao: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), dataColeta: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), dataEntrega: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), cliente: "Farmácia Total", tipoCarga: "Carga Seca" },
  { id: "op6", origem: "Osasco, SP", destino: "Barueri, SP", carga: "Documentos", peso: "50 kg", valor: 180, distancia: "15 km", status: "recusada", dataCriacao: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), cliente: "Escritório Central", tipoCarga: "Carga Seca" },
];

const mockDocumentos: DocumentoPrestador[] = [
  { id: "d1", tipo: "CNH", nome: "CNH Frente", status: "aprovado", dataEnvio: "2026-04-10", dataVencimento: "2028-05-15" },
  { id: "d2", tipo: "CRLV", nome: "CRLV 2026", status: "aprovado", dataEnvio: "2026-04-12", dataVencimento: "2027-03-31" },
  { id: "d3", tipo: "ANTT", nome: "Registro ANTT", status: "pendente", dataEnvio: "2026-05-01", dataVencimento: "2026-12-31" },
  { id: "d4", tipo: "Comprovante", nome: "Comprovante Residência", status: "aprovado", dataEnvio: "2026-04-10" },
  { id: "d5", tipo: "Seguro", nome: "Apolice Seguro Carga", status: "expirado", dataEnvio: "2025-06-01", dataVencimento: "2026-05-01", observacao: "Renove o seguro para continuar operando" },
  { id: "d6", tipo: "MOPP", nome: "Curso MOPP", status: "pendente", dataEnvio: "2026-05-05" },
];

const mockTreinamentos: Treinamento[] = [
  { id: "t1", titulo: "Direção Defensiva", tipo: "video", status: "completo", progresso: 100, duracao: "45 min", imagem: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=300&fit=crop", concluidoEm: "2026-04-20" },
  { id: "t2", titulo: "Segurança no Transporte de Cargas", tipo: "video", status: "completo", progresso: 100, duracao: "30 min", imagem: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop", concluidoEm: "2026-04-25" },
  { id: "t3", titulo: "Primeiros Socorros", tipo: "video", status: "em_andamento", progresso: 60, duracao: "50 min", imagem: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop" },
  { id: "t4", titulo: "Avaliação de Direção Defensiva", tipo: "prova", status: "pendente", progresso: 0, duracao: "20 min", imagem: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop" },
  { id: "t5", titulo: "Certificação Transporte de Alimentos", tipo: "certificado", status: "completo", progresso: 100, duracao: "2h", imagem: "https://images.unsplash.com/photo-1553867745-7850eb3a3691?w=400&h=300&fit=crop", concluidoEm: "2026-05-01" },
];

const mockTransacoes: Transacao[] = [
  { id: "tr1", tipo: "recebido", descricao: "Operação #OP-2026-0442", valor: 890, data: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), operacaoId: "op5" },
  { id: "tr2", tipo: "bonus", descricao: "Bonus por pontualidade - Maio", valor: 150, data: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: "tr3", tipo: "taxa", descricao: "Taxa administrativa (2%)", valor: -25, data: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), operacaoId: "op5" },
  { id: "tr4", tipo: "recebido", descricao: "Operação #OP-2026-0440", valor: 1200, data: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), operacaoId: "op4" },
  { id: "tr5", tipo: "repassado", descricao: "Repasse semanal", valor: -3500, data: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString() },
];

function buildScore(): ScoreResult {
  return calculateScore({
    nome: "Carlos Silva", cpf: "123.456.789-00", selfieUrl: "mock", cnhUrl: "mock",
    tipoVeiculo: "Truck", modelo: "Mercedes-Benz Actros", placa: "ABC1D23",
    ano: "2022", capacidade: "5 - 10 ton", fotosVeiculo: ["foto1", "foto2"],
    crlvUrl: "mock", comprovanteUrl: "mock", anttUrl: "mock", moppUrl: null,
    seguroUrl: "mock", chavePix: "carlos@email.com", banco: "Nubank",
    regioes: ["Grande SP", "ABC Paulista", "Interior SP", "Rio de Janeiro"],
    horariosInicio: "06:00", horariosFim: "18:00", tipoCarga: "Carga Seca",
    tipoViagem: ["Municipal", "Estadual"], fazColeta: true, fazEntrega: true,
    distanciaMaxima: "500",
    documentValidations: {
      cnh: { approved: true, confidence: 92 },
      crlv: { approved: true, confidence: 88 },
      comprovante: { approved: true, confidence: 75 },
      antt: { approved: false, confidence: 45 },
      seguro: { approved: true, confidence: 80 },
    },
    stepsCompleted: [true, true, true, true, true],
    isComplete: true,
  });
}

export const usePortalPrestadorStore = create<PortalPrestadorState>()((set) => ({
  perfil: {
    nome: "Carlos Silva",
    foto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    email: "carlos.silva@email.com",
    telefone: "(11) 99999-8888",
    cpf: "123.456.789-00",
    dataCadastro: "2026-03-15",
    dadosBancarios: { banco: "Nubank", agencia: "0001", conta: "12345-6", pix: "carlos.silva@email.com" },
    veiculos: [{ id: "v1", modelo: "Mercedes-Benz Actros", placa: "ABC1D23", tipo: "Truck", ano: "2022" }],
    regioes: ["Grande SP", "ABC Paulista", "Interior SP", "Rio de Janeiro"],
    horariosInicio: "06:00", horariosFim: "18:00",
    fazColeta: true, fazEntrega: true,
  },
  score: buildScore(),
  disponivel: true,
  ganhosMes: 12450,
  ganhosSemana: 3240,
  ranking: 42,
  totalPrestadores: 1250,
  operacoesPendentes: 2,
  operacoesAtivas: 2,
  notificacoes: mockNotificacoes,
  operacoes: mockOperacoes,
  documentos: mockDocumentos,
  treinamentos: mockTreinamentos,
  transacoes: mockTransacoes,

  toggleDisponivel: () => set((s) => ({ disponivel: !s.disponivel })),
  aceitarOperacao: (id) => set((s) => ({
    operacoes: s.operacoes.map((o) => o.id === id ? { ...o, status: "aceita" as const } : o),
    operacoesPendentes: s.operacoesPendentes - 1,
    operacoesAtivas: s.operacoesAtivas + 1,
  })),
  recusarOperacao: (id) => set((s) => ({
    operacoes: s.operacoes.map((o) => o.id === id ? { ...o, status: "recusada" as const } : o),
    operacoesPendentes: s.operacoesPendentes - 1,
  })),
  iniciarOperacao: (id) => set((s) => ({
    operacoes: s.operacoes.map((o) => o.id === id ? { ...o, status: "em_andamento" as const, dataColeta: new Date().toISOString() } : o),
  })),
  concluirOperacao: (id) => set((s) => ({
    operacoes: s.operacoes.map((o) => o.id === id ? { ...o, status: "concluida" as const, dataEntrega: new Date().toISOString() } : o),
    operacoesAtivas: s.operacoesAtivas - 1,
  })),
  marcarNotificacaoLida: (id) => set((s) => ({
    notificacoes: s.notificacoes.map((n) => n.id === id ? { ...n, lida: true } : n),
  })),
  marcarTodasLidas: () => set((s) => ({
    notificacoes: s.notificacoes.map((n) => ({ ...n, lida: true })),
  })),
  atualizarPerfil: (data) => set((s) => ({ perfil: { ...s.perfil, ...data } })),
  atualizarRegioes: (regioes) => set((s) => ({ perfil: { ...s.perfil, regioes } })),
  atualizarDisponibilidade: (inicio, fim) => set((s) => ({ perfil: { ...s.perfil, horariosInicio: inicio, horariosFim: fim } })),
  atualizarDocumento: (id, status, obs) => set((s) => ({
    documentos: s.documentos.map((d) => d.id === id ? { ...d, status, observacao: obs || d.observacao } : d),
  })),
  adicionarDocumento: (doc) => set((s) => ({ documentos: [...s.documentos, doc] })),
  iniciarTreinamento: (id) => set((s) => ({
    treinamentos: s.treinamentos.map((t) => t.id === id && t.status === "pendente" ? { ...t, status: "em_andamento" as const, progresso: 10 } : t),
  })),
  concluirTreinamento: (id) => set((s) => ({
    treinamentos: s.treinamentos.map((t) => t.id === id ? { ...t, status: "completo" as const, progresso: 100, concluidoEm: new Date().toISOString().split("T")[0] } : t),
  })),
  recalcularScore: () => set({ score: buildScore() }),
}));
