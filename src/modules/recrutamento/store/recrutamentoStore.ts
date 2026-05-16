import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Operacao, Prestador, MatchOperacao, MetricasRecrutamento, StatusOperacao, StatusPrestador } from '../types/recrutamento'

export type ViewMode = 'grid' | 'list' | 'kanban'
export type Section = 'dashboard' | 'pipeline-kanban' | 'operacoes' | 'nova-operacao' | 'prestadores' | 'crm' | 'documentos' | 'ia' | 'onboarding' | 'score' | 'automacoes' | 'portal' | 'talentos'

interface RecrutamentoState {
  currentSection: Section
  currentView: ViewMode
  selectedOperacaoId: string | null
  selectedPrestadorId: string | null
  operacoes: Operacao[]
  prestadores: Prestador[]
  matches: MatchOperacao[]
  metricas: MetricasRecrutamento | null
  operacoesLoading: boolean
  prestadoresLoading: boolean
  sidebarOpen: boolean

  setCurrentSection: (section: Section) => void
  setCurrentView: (view: ViewMode) => void
  setSelectedOperacaoId: (id: string | null) => void
  setSelectedPrestadorId: (id: string | null) => void
  setOperacoes: (ops: Operacao[]) => void
  setPrestadores: (prestadores: Prestador[]) => void
  setMatches: (matches: MatchOperacao[]) => void
  setMetricas: (metricas: MetricasRecrutamento) => void
  setOperacoesLoading: (loading: boolean) => void
  setPrestadoresLoading: (loading: boolean) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useRecrutamentoStore = create<RecrutamentoState>()(
  persist(
    (set) => ({
      currentSection: 'dashboard',
      currentView: 'grid',
      selectedOperacaoId: null,
      selectedPrestadorId: null,
      operacoes: [],
      prestadores: [],
      matches: [],
      metricas: null,
      operacoesLoading: false,
      prestadoresLoading: false,
      sidebarOpen: true,

      setCurrentSection: (section) => set({ currentSection: section }),
      setCurrentView: (view) => set({ currentView: view }),
      setSelectedOperacaoId: (id) => set({ selectedOperacaoId: id }),
      setSelectedPrestadorId: (id) => set({ selectedPrestadorId: id }),
      setOperacoes: (ops) => set({ operacoes: ops }),
      setPrestadores: (prestadores) => set({ prestadores }),
      setMatches: (matches) => set({ matches }),
      setMetricas: (metricas) => set({ metricas }),
      setOperacoesLoading: (loading) => set({ operacoesLoading: loading }),
      setPrestadoresLoading: (loading) => set({ prestadoresLoading: loading }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'recrutamento-store',
      partialize: (state) => ({
        currentSection: state.currentSection,
        currentView: state.currentView,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)