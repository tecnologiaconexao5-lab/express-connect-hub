import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useEnterpriseKanbanStore } from './enterpriseKanbanStore'
import { enterpriseKanbanService } from './enterpriseKanbanService'
import type { PipelineStage, EnterpriseCandidate } from './enterpriseKanbanTypes'

export function useEnterpriseKanban() {
  const store = useEnterpriseKanbanStore()
  const initialized = useRef(false)

  const load = useCallback(async () => {
    store.setLoading(true)
    const candidates = await enterpriseKanbanService.listar()
    store.setCandidates(candidates)
    applyFilters(candidates, store.searchQuery, store.filters)
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      load()
    }
  }, [load])

  const applyFilters = useCallback((
    candidates: EnterpriseCandidate[],
    query: string,
    filters: typeof store.filters,
  ) => {
    let filtered = [...candidates]

    if (query) {
      const q = query.toLowerCase()
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.cidade.toLowerCase().includes(q) ||
        c.veiculo.toLowerCase().includes(q) ||
        c.placa.toLowerCase().includes(q) ||
        c.telefone.includes(q)
      )
    }

    if (filters.scoreMin > 0) filtered = filtered.filter(c => c.score >= filters.scoreMin)
    if (filters.scoreMax < 100) filtered = filtered.filter(c => c.score <= filters.scoreMax)
    if (filters.prioridade.length) filtered = filtered.filter(c => filters.prioridade.includes(c.prioridade))
    if (filters.statusDocumental.length) filtered = filtered.filter(c => filters.statusDocumental.includes(c.statusDocumental))
    if (filters.validadeCNH.length) filtered = filtered.filter(c => filters.validadeCNH.includes(c.validadeCNH))
    if (filters.tags.length) filtered = filtered.filter(c => c.tags.some(t => filters.tags.includes(t)))
    if (filters.cidade) filtered = filtered.filter(c => c.cidade.toLowerCase().includes(filters.cidade.toLowerCase()))
    if (filters.veiculo) filtered = filtered.filter(c => c.veiculo.toLowerCase().includes(filters.veiculo.toLowerCase()))

    store.setFilteredCandidates(filtered)
  }, [])

  const handleSearchChange = useCallback((query: string) => {
    store.setSearchQuery(query)
    applyFilters(store.candidates, query, store.filters)
  }, [store.candidates, store.filters])

  const handleFilterChange = useCallback((filters: Partial<typeof store.filters>) => {
    const newFilters = { ...store.filters, ...filters }
    store.setFilters(newFilters)
    applyFilters(store.candidates, store.searchQuery, newFilters)
  }, [store.candidates, store.searchQuery, store.filters])

  const handleResetFilters = useCallback(() => {
    store.resetFilters()
    applyFilters(store.candidates, '', {
      busca: '',
      scoreMin: 0,
      scoreMax: 100,
      prioridade: [],
      statusDocumental: [],
      validadeCNH: [],
      tags: [],
      cidade: '',
      veiculo: '',
    })
  }, [store.candidates])

  const handleMoveCandidate = useCallback(async (id: string, stage: PipelineStage) => {
    store.moveCandidate(id, stage)
    await enterpriseKanbanService.mover(id, stage)
    const counts = await enterpriseKanbanService.getStageCounts()
    return counts
  }, [])

  const handleAddObservation = useCallback(async (id: string, obs: string) => {
    store.updateCandidate(id, { observacoesIA: obs })
    await enterpriseKanbanService.adicionarObservacao(id, obs)
  }, [])

  const columns = useMemo(() => {
    const map: Record<string, EnterpriseCandidate[]> = {}
    for (const c of store.filteredCandidates) {
      if (!map[c.stage]) map[c.stage] = []
      map[c.stage].push(c)
    }
    return map
  }, [store.filteredCandidates])

  const totalCount = store.candidates.length
  const filteredCount = store.filteredCandidates.length
  const hasActiveFilters = store.searchQuery !== '' ||
    store.filters.scoreMin > 0 ||
    store.filters.scoreMax < 100 ||
    store.filters.prioridade.length > 0 ||
    store.filters.statusDocumental.length > 0 ||
    store.filters.validadeCNH.length > 0 ||
    store.filters.tags.length > 0 ||
    store.filters.cidade !== '' ||
    store.filters.veiculo !== ''

  return {
    candidates: store.candidates,
    filteredCandidates: store.filteredCandidates,
    loading: store.loading,
    searchQuery: store.searchQuery,
    filters: store.filters,
    selectedCandidateId: store.selectedCandidateId,
    draggingId: store.draggingId,
    showFilters: store.showFilters,
    page: store.page,
    pageSize: store.pageSize,
    columns,
    totalCount,
    filteredCount,
    hasActiveFilters,

    setSelectedCandidateId: store.setSelectedCandidateId,
    setDraggingId: store.setDraggingId,
    toggleShowFilters: store.toggleShowFilters,
    setShowFilters: store.setShowFilters,
    nextPage: store.nextPage,
    prevPage: store.prevPage,
    setPage: store.setPage,

    handleSearchChange,
    handleFilterChange,
    handleResetFilters,
    handleMoveCandidate,
    handleAddObservation,
    reload: load,
  }
}
