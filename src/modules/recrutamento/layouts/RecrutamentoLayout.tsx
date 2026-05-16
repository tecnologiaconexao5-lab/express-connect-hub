import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Briefcase, PlusCircle, Truck, MessageSquare, FileText,
  Bot, GraduationCap, Award, Zap, Users, HeartHandshake, ChevronLeft,
  Menu, Search, Bell, UserCircle, Columns3,
} from 'lucide-react'
import { useRecrutamentoUI } from '../hooks/useRecrutamentoUI'
import { cn } from '../utils/cn'
import { useState } from 'react'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  description: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, description: 'Visão geral do recrutamento' },
  { id: 'pipeline-kanban', label: 'Pipeline Kanban', icon: <Columns3 className="w-4 h-4" />, description: 'Pipeline enterprise com drag-and-drop' },
  { id: 'operacoes', label: 'Operações', icon: <Briefcase className="w-4 h-4" />, description: 'Gerenciar vagas e captação' },
  { id: 'nova-operacao', label: 'Nova Operação', icon: <PlusCircle className="w-4 h-4" />, description: 'Criar nova vaga' },
  { id: 'prestadores', label: 'Prestadores', icon: <Truck className="w-4 h-4" />, description: 'Banco inteligente de agregados' },
  { id: 'crm', label: 'CRM Logístico', icon: <HeartHandshake className="w-4 h-4" />, description: 'Relacionamento com prestadores' },
  { id: 'documentos', label: 'Documentos', icon: <FileText className="w-4 h-4" />, description: 'Central documental antifraude' },
  { id: 'ia', label: 'IA Operacional', icon: <Bot className="w-4 h-4" />, description: 'Análise inteligente e automação' },
  { id: 'onboarding', label: 'Onboarding', icon: <GraduationCap className="w-4 h-4" />, description: 'Integração e homologação' },
  { id: 'score', label: 'Score', icon: <Award className="w-4 h-4" />, description: 'Métrica de talentos' },
  { id: 'automacoes', label: 'Automações', icon: <Zap className="w-4 h-4" />, description: 'Regras e triggers automáticos' },
  { id: 'portal', label: 'Portal', icon: <Users className="w-4 h-4" />, description: 'Portal do prestador' },
  { id: 'talentos', label: 'Talentos', icon: <MessageSquare className="w-4 h-4" />, description: 'Banco de talentos' },
]

interface RecrutamentoLayoutProps {
  children: React.ReactNode
}

export function RecrutamentoLayout({ children }: RecrutamentoLayoutProps) {
  const { currentSection, navegar, sidebarOpen, toggleSidebar } = useRecrutamentoUI()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentItem = navItems.find(i => i.id === currentSection)

  return (
    <div className="flex h-full gap-0">
      <aside
        className={cn(
          'fixed lg:relative z-30 flex flex-col h-full bg-card border-r border-border/60 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-60' : 'w-0 lg:w-16',
          mobileMenuOpen ? 'left-0' : '-left-full lg:left-0'
        )}
      >
        <div className={cn(
          'flex items-center h-14 px-4 border-b border-border/50 shrink-0 transition-opacity',
          !sidebarOpen && 'lg:justify-center lg:px-2'
        )}>
          <div className={cn('flex items-center gap-3 flex-1 min-w-0', !sidebarOpen && 'lg:hidden')}>
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground truncate">Recrutamento</span>
          </div>
          <button
            onClick={() => { toggleSidebar(); setMobileMenuOpen(false) }}
            className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground shrink-0"
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform', !sidebarOpen && 'lg:rotate-180')} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navegar(item.id as any)
                setMobileMenuOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                currentSection === item.id
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
              )}
            >
              <span className={cn(
                'shrink-0',
                currentSection === item.id && 'text-primary'
              )}>
                {item.icon}
              </span>
              <span className={cn(
                'truncate transition-opacity duration-200',
                !sidebarOpen && 'lg:opacity-0 lg:w-0 lg:overflow-hidden'
              )}>
                {item.label}
              </span>
              {currentSection === item.id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
            </button>
          ))}
        </nav>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm flex items-center px-4 lg:px-6 gap-4 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            {currentItem && (
              <motion.div
                key={currentItem.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <span className="text-sm font-medium text-foreground">{currentItem.label}</span>
                <span className="hidden sm:inline text-xs text-muted-foreground/50">·</span>
                <span className="hidden sm:inline text-xs text-muted-foreground/50 truncate">
                  {currentItem.description}
                </span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
              <Search className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
            </button>
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
              <UserCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}