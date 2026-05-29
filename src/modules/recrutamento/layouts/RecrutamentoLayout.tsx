import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Briefcase, Truck, MessageSquare, FileText,
  Bot, Zap, Users, HeartHandshake, Columns3, Menu, Bell, UserCircle, CheckCircle,
} from 'lucide-react'
import { useRecrutamentoUI } from '../hooks/useRecrutamentoUI'
import { cn } from '../utils/cn'
import { useState } from 'react'

interface TabItem {
  id: string
  label: string
  icon: React.ReactNode
}

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'operacoes', label: 'Operações', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'pipeline-kanban', label: 'Pipeline', icon: <Columns3 className="w-4 h-4" /> },
  { id: 'prestadores', label: 'Prestadores', icon: <Truck className="w-4 h-4" /> },
  { id: 'talentos', label: 'Banco de Talentos', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'crm', label: 'CRM', icon: <HeartHandshake className="w-4 h-4" /> },
  { id: 'documentos', label: 'Documentos', icon: <FileText className="w-4 h-4" /> },
  { id: 'ia', label: 'IA Operacional', icon: <Bot className="w-4 h-4" /> },
  { id: 'automacoes', label: 'Automações', icon: <Zap className="w-4 h-4" /> },
  { id: 'portal', label: 'Portal do Prestador', icon: <Users className="w-4 h-4" /> },
  { id: 'operacionais', label: 'Operacionais', icon: <CheckCircle className="w-4 h-4" /> },
]

interface RecrutamentoLayoutProps {
  children: React.ReactNode
}

export function RecrutamentoLayout({ children }: RecrutamentoLayoutProps) {
  const { currentSection, navegar } = useRecrutamentoUI()
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm flex items-center px-4 lg:px-6 gap-4 shrink-0 z-10">
        <button
          onClick={() => setMobileTabsOpen(!mobileTabsOpen)}
          className="lg:hidden w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground truncate">Recrutamento Inteligente</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <UserCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      <nav className="hidden lg:flex border-b border-border/50 bg-card/30 px-2 shrink-0 overflow-x-auto">
        <div className="flex gap-0.5">
          {tabs.map((tab) => {
            const isActive = currentSection === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => navegar(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap',
                  isActive
                    ? 'border-primary text-foreground bg-primary/5'
                    : 'border-transparent text-muted-foreground/70 hover:text-foreground hover:border-muted-foreground/30 hover:bg-muted/30'
                )}
              >
                <span className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/50')}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      {mobileTabsOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
            onClick={() => setMobileTabsOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 z-30 bg-card border-b border-border/50 shadow-lg lg:hidden max-h-[60vh] overflow-y-auto">
            <div className="p-2 space-y-0.5">
              {tabs.map((tab) => {
                const isActive = currentSection === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      navegar(tab.id as any)
                      setMobileTabsOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <span className={cn('shrink-0', isActive && 'text-primary')}>
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

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
  )
}
