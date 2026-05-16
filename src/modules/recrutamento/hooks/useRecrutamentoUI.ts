import { useCallback } from 'react'
import { useRecrutamentoStore } from '../store/recrutamentoStore'
import type { ViewMode, Section } from '../store/recrutamentoStore'

export function useRecrutamentoUI() {
  const store = useRecrutamentoStore()

  const navegar = useCallback((section: Section) => {
    store.setCurrentSection(section)
    store.setSelectedOperacaoId(null)
    store.setSelectedPrestadorId(null)
  }, [store])

  const alternarView = useCallback((view: ViewMode) => {
    store.setCurrentView(view)
  }, [store])

  return {
    currentSection: store.currentSection,
    currentView: store.currentView,
    sidebarOpen: store.sidebarOpen,
    navegar,
    alternarView,
    toggleSidebar: store.toggleSidebar,
    setSidebarOpen: store.setSidebarOpen,
  }
}