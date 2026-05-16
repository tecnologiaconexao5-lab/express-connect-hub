import { create } from 'zustand'
import type { EnterpriseCandidate, PipelineStage, KanbanFilter } from './enterpriseKanbanTypes'

interface EnterpriseKanbanState {
  candidates: EnterpriseCandidate[]
  filteredCandidates: EnterpriseCandidate[]
  loading: boolean
  searchQuery: string
  filters: KanbanFilter
  selectedCandidateId: string | null
  draggingId: string | null
  showFilters: boolean
  page: number
  pageSize: number

  setCandidates: (candidates: EnterpriseCandidate[]) => void
  setFilteredCandidates: (candidates: EnterpriseCandidate[]) => void
  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<KanbanFilter>) => void
  resetFilters: () => void
  setSelectedCandidateId: (id: string | null) => void
  setDraggingId: (id: string | null) => void
  setShowFilters: (show: boolean) => void
  toggleShowFilters: () => void
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  moveCandidate: (id: string, stage: PipelineStage) => void
  updateCandidate: (id: string, data: Partial<EnterpriseCandidate>) => void
}

const DEFAULT_FILTERS: KanbanFilter = {
  busca: '',
  scoreMin: 0,
  scoreMax: 100,
  prioridade: [],
  statusDocumental: [],
  validadeCNH: [],
  tags: [],
  cidade: '',
  veiculo: '',
}

const PAGE_SIZE = 10

export const useEnterpriseKanbanStore = create<EnterpriseKanbanState>((set, get) => ({
  candidates: [],
  filteredCandidates: [],
  loading: true,
  searchQuery: '',
  filters: { ...DEFAULT_FILTERS },
  selectedCandidateId: null,
  draggingId: null,
  showFilters: false,
  page: 0,
  pageSize: PAGE_SIZE,

  setCandidates: (candidates) => set({ candidates, loading: false }),
  setFilteredCandidates: (filteredCandidates) => set({ filteredCandidates }),
  setLoading: (loading) => set({ loading }),
  setSearchQuery: (query) => set({ searchQuery: query, page: 0 }),
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters }, page: 0 })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS }, searchQuery: '', page: 0 }),
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),
  setDraggingId: (id) => set({ draggingId: id }),
  setShowFilters: (show) => set({ showFilters: show }),
  toggleShowFilters: () => set((s) => ({ showFilters: !s.showFilters })),
  setPage: (page) => set({ page }),
  nextPage: () => set((s) => ({ page: s.page + 1 })),
  prevPage: () => set((s) => ({ page: Math.max(0, s.page - 1) })),

  moveCandidate: (id, stage) => {
    const { candidates, filteredCandidates } = get()
    set({
      candidates: candidates.map(c => c.id === id ? { ...c, stage, dataAtualizacao: new Date().toISOString() } : c),
      filteredCandidates: filteredCandidates.map(c => c.id === id ? { ...c, stage, dataAtualizacao: new Date().toISOString() } : c),
    })
  },

  updateCandidate: (id, data) => {
    const { candidates, filteredCandidates } = get()
    set({
      candidates: candidates.map(c => c.id === id ? { ...c, ...data, dataAtualizacao: new Date().toISOString() } : c),
      filteredCandidates: filteredCandidates.map(c => c.id === id ? { ...c, ...data, dataAtualizacao: new Date().toISOString() } : c),
    })
  },
}))
