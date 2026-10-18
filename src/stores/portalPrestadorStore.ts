import { create } from "zustand";
import * as portalPrestadorService from "@/services/portal-prestador/portalPrestadorService";
import type { Notificacao, Operacao, DocumentoPrestador, Treinamento, Transacao, PrestadorPerfil } from "@/services/portal-prestador/portalPrestadorService";
import { calculateScore, type ScoreResult } from "@/services/scoreEngine";

export type { Notificacao, Operacao, DocumentoPrestador, Treinamento, Transacao, PrestadorPerfil };

export interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  pix: string;
}

export interface PortalPrestadorState {
  prestadorId: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  perfil: PrestadorPerfil;
  score: ScoreResult | null;
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

  initialize: (prestadorId: string) => Promise<void>;
  refreshDashboard: () => Promise<void>;
  refreshOperacoes: () => Promise<void>;
  refreshDocumentos: () => Promise<void>;
  refreshTransacoes: () => Promise<void>;
  refreshNotificacoes: () => Promise<void>;

  toggleDisponivel: () => void;
  aceitarOperacao: (id: string) => Promise<void>;
  recusarOperacao: (id: string) => Promise<void>;
  iniciarOperacao: (id: string) => Promise<void>;
  concluirOperacao: (id: string) => Promise<void>;
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

export const usePortalPrestadorStore = create<PortalPrestadorState>()((set, get) => ({
  prestadorId: null,
  loading: false,
  error: null,
  initialized: false,

  perfil: {
    nome: "", foto: "", email: "", telefone: "", cpf: "",
    dataCadastro: "", dadosBancarios: { banco: "", agencia: "", conta: "", pix: "" },
    veiculos: [], regioes: [], horariosInicio: "", horariosFim: "",
    fazColeta: false, fazEntrega: false,
  },
  score: null,
  disponivel: true,
  ganhosMes: 0,
  ganhosSemana: 0,
  ranking: 0,
  totalPrestadores: 0,
  operacoesPendentes: 0,
  operacoesAtivas: 0,
  notificacoes: [],
  operacoes: [],
  documentos: [],
  treinamentos: [],
  transacoes: [],

  initialize: async (prestadorId: string) => {
    set({ loading: true, error: null, prestadorId });
    try {
      const dashboard = await portalPrestadorService.buscarDashboardCompleto(prestadorId);
      if (dashboard) {
        set({
          perfil: dashboard.perfil,
          score: dashboard.score,
          ganhosMes: dashboard.ganhosMes,
          ganhosSemana: dashboard.ganhosSemana,
          ranking: dashboard.ranking,
          totalPrestadores: dashboard.totalPrestadores,
          operacoesPendentes: dashboard.operacoesPendentes,
          operacoesAtivas: dashboard.operacoesAtivas,
          disponivel: dashboard.disponivel,
          notificacoes: dashboard.notificacoes,
          loading: false,
          initialized: true,
        });
      }
      const [operacoes, documentos, transacoes] = await Promise.all([
        portalPrestadorService.buscarOperacoes(prestadorId),
        portalPrestadorService.buscarDocumentos(prestadorId),
        portalPrestadorService.buscarTransacoes(prestadorId),
      ]);
      set({ operacoes, documentos, transacoes, loading: false, initialized: true, error: null });
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      console.error("[PortalPrestador] Erro ao inicializar:", msg);
      set({ loading: false, error: msg, initialized: true });
    }
  },

  refreshDashboard: async () => {
    const { prestadorId } = get();
    if (!prestadorId) return;
    try {
      const dashboard = await portalPrestadorService.buscarDashboardCompleto(prestadorId);
      if (dashboard) {
        set({
          perfil: dashboard.perfil,
          score: dashboard.score,
          ganhosMes: dashboard.ganhosMes,
          ganhosSemana: dashboard.ganhosSemana,
          ranking: dashboard.ranking,
          totalPrestadores: dashboard.totalPrestadores,
          operacoesPendentes: dashboard.operacoesPendentes,
          operacoesAtivas: dashboard.operacoesAtivas,
          disponivel: dashboard.disponivel,
          notificacoes: dashboard.notificacoes,
        });
      }
    } catch (err) {
      console.warn("[PortalPrestador] refreshDashboard:", err);
    }
  },

  refreshOperacoes: async () => {
    const { prestadorId } = get();
    if (!prestadorId) return;
    try {
      const operacoes = await portalPrestadorService.buscarOperacoes(prestadorId);
      set({ operacoes });
    } catch (err) {
      console.warn("[PortalPrestador] refreshOperacoes:", err);
    }
  },

  refreshDocumentos: async () => {
    const { prestadorId } = get();
    if (!prestadorId) return;
    try {
      const documentos = await portalPrestadorService.buscarDocumentos(prestadorId);
      set({ documentos });
    } catch (err) {
      console.warn("[PortalPrestador] refreshDocumentos:", err);
    }
  },

  refreshTransacoes: async () => {
    const { prestadorId } = get();
    if (!prestadorId) return;
    try {
      const transacoes = await portalPrestadorService.buscarTransacoes(prestadorId);
      set({ transacoes });
    } catch (err) {
      console.warn("[PortalPrestador] refreshTransacoes:", err);
    }
  },

  refreshNotificacoes: async () => {
    const { prestadorId } = get();
    if (!prestadorId) return;
    try {
      const notificacoes = await portalPrestadorService.buscarNotificacoes(prestadorId);
      set({ notificacoes });
    } catch (err) {
      console.warn("[PortalPrestador] refreshNotificacoes:", err);
    }
  },

  toggleDisponivel: () => set((s) => ({ disponivel: !s.disponivel })),

  aceitarOperacao: async (id) => {
    const { prestadorId, operacoes } = get();
    if (!prestadorId) return;
    await portalPrestadorService.aceitarOperacao(id, prestadorId);
    set({
      operacoes: operacoes.map((o) => o.id === id ? { ...o, status: "aceita" as const } : o),
      operacoesPendentes: Math.max(0, get().operacoesPendentes - 1),
      operacoesAtivas: get().operacoesAtivas + 1,
    });
  },

  recusarOperacao: async (id) => {
    const { prestadorId, operacoes } = get();
    if (!prestadorId) return;
    await portalPrestadorService.recusarOperacao(id, prestadorId);
    set({
      operacoes: operacoes.map((o) => o.id === id ? { ...o, status: "recusada" as const } : o),
      operacoesPendentes: Math.max(0, get().operacoesPendentes - 1),
    });
  },

  iniciarOperacao: async (id) => {
    const { prestadorId, operacoes } = get();
    if (!prestadorId) return;
    await portalPrestadorService.iniciarOperacao(id, prestadorId);
    set({
      operacoes: operacoes.map((o) => o.id === id ? { ...o, status: "em_andamento" as const, dataColeta: new Date().toISOString() } : o),
    });
  },

  concluirOperacao: async (id) => {
    const { prestadorId, operacoes } = get();
    if (!prestadorId) return;
    await portalPrestadorService.concluirOperacao(id, prestadorId);
    set({
      operacoes: operacoes.map((o) => o.id === id ? { ...o, status: "concluida" as const, dataEntrega: new Date().toISOString() } : o),
      operacoesAtivas: Math.max(0, get().operacoesAtivas - 1),
    });
  },

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
  recalcularScore: () => {
    const { perfil } = get();
    set({ score: calculateScore({
      nome: perfil.nome, cpf: perfil.cpf, selfieUrl: perfil.foto || null, cnhUrl: null,
      tipoVeiculo: perfil.veiculos[0]?.tipo || "", modelo: perfil.veiculos[0]?.modelo || "",
      placa: perfil.veiculos[0]?.placa || "", ano: perfil.veiculos[0]?.ano || "",
      capacidade: "", fotosVeiculo: [], crlvUrl: null, comprovanteUrl: null,
      anttUrl: null, moppUrl: null, seguroUrl: null,
      chavePix: perfil.dadosBancarios.pix, banco: perfil.dadosBancarios.banco,
      regioes: perfil.regioes, horariosInicio: perfil.horariosInicio,
      horariosFim: perfil.horariosFim, tipoCarga: "Carga Seca",
      tipoViagem: perfil.regioes.length > 1 ? ["Estadual"] : ["Municipal"],
      fazColeta: perfil.fazColeta, fazEntrega: perfil.fazEntrega,
      distanciaMaxima: "500", documentValidations: {},
      stepsCompleted: [true, true, true, true, true], isComplete: true,
    }) });
  },
}));
