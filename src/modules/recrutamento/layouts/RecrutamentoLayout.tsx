import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Briefcase, Truck, MessageSquare, FileText,
  Bot, Zap, Users, HeartHandshake, Columns3, Menu, Bell, UserCircle, CheckCircle,
} from 'lucide-react'
import { useRecrutamentoUI } from '../hooks/useRecrutamentoUI'
import { cn } from '../utils/cn'
import { useState, type CSSProperties } from 'react'

interface TabItem {
  id: string
  label: string
  icon: React.ReactNode
}

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'operacoes', label: 'Operações', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'pipeline-kanban', label: 'Pipeline 17 Etapas', icon: <Columns3 className="w-4 h-4" /> },
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

const enterpriseTokens = {
  '--primary': '262 73% 23%',
  '--primary-foreground': '0 0% 100%',
  '--ring': '24 95% 53%',
} as CSSProperties

export function RecrutamentoLayout({ children }: RecrutamentoLayoutProps) {
  const { currentSection, navegar } = useRecrutamentoUI()
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false)
  const enterprise = currentSection !== 'dashboard'

  return (
    <div
      className={cn('flex flex-col h-full', enterprise && 'talent-enterprise')}
      style={enterprise ? enterpriseTokens : undefined}
    >
      <header
        className={cn(
          'h-14 flex items-center px-4 lg:px-6 gap-4 shrink-0 z-10 transition-colors',
          enterprise
            ? 'border-b-2 border-orange-500 bg-[#2E1065] text-white shadow-md'
            : 'border-b border-border/50 bg-card/50 backdrop-blur-sm',
        )}
      >
        <button
          onClick={() => setMobileTabsOpen(!mobileTabsOpen)}
          className={cn(
            'lg:hidden w-8 h-8 rounded-lg flex items-center justify-center',
            enterprise ? 'hover:bg-white/10 text-white' : 'hover:bg-muted text-muted-foreground',
          )}
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              enterprise ? 'bg-orange-500 text-white shadow-sm' : 'bg-primary/15 text-primary',
            )}
          >
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-bold">
              {enterprise ? 'Talent Intelligence Enterprise' : 'Recrutamento Inteligente'}
            </span>
            {enterprise && (
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200 sm:block">
                Conexão Express · People & Operations
              </span>
            )}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {enterprise && (
            <span className="hidden rounded-full border border-orange-400/40 bg-orange-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-200 md:inline-flex">
              Enterprise
            </span>
          )}
          <button
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center relative',
              enterprise ? 'hover:bg-white/10 text-white' : 'hover:bg-muted text-muted-foreground',
            )}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
          </button>
          <button
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              enterprise ? 'hover:bg-white/10 text-white' : 'hover:bg-muted text-muted-foreground',
            )}
          >
            <UserCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      <nav
        className={cn(
          'hidden lg:flex px-2 shrink-0 overflow-x-auto',
          enterprise
            ? 'border-b border-orange-200/70 bg-white'
            : 'border-b border-border/50 bg-card/30',
        )}
      >
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const isActive = currentSection === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => navegar(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap',
                  enterprise
                    ? isActive
                      ? 'border-[#2E1065] bg-violet-50 text-[#2E1065]'
                      : 'border-transparent text-slate-500 hover:border-orange-300 hover:bg-orange-50/60 hover:text-[#2E1065]'
                    : isActive
                      ? 'border-primary text-foreground bg-primary/5'
                      : 'border-transparent text-muted-foreground/70 hover:text-foreground hover:border-muted-foreground/30 hover:bg-muted/30',
                )}
              >
                {enterprise && isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                )}
                <span
                  className={cn(
                    'shrink-0',
                    enterprise
                      ? isActive
                        ? 'text-orange-500'
                        : 'text-slate-400'
                      : isActive
                        ? 'text-primary'
                        : 'text-muted-foreground/50',
                  )}
                >
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
          <div
            className={cn(
              'fixed top-14 left-0 right-0 z-30 border-b shadow-lg lg:hidden max-h-[60vh] overflow-y-auto',
              enterprise ? 'border-orange-200 bg-white' : 'border-border/50 bg-card',
            )}
          >
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
                      enterprise
                        ? isActive
                          ? 'bg-violet-50 text-[#2E1065] shadow-sm ring-1 ring-[#2E1065]/10'
                          : 'text-slate-500 hover:bg-orange-50 hover:text-[#2E1065]'
                        : isActive
                          ? 'bg-primary/10 text-primary shadow-sm'
                          : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    <span
                      className={cn(
                        'shrink-0',
                        enterprise ? (isActive ? 'text-orange-500' : 'text-slate-400') : isActive && 'text-primary',
                      )}
                    >
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

      <main
        className={cn(
          'flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar',
          enterprise && 'bg-gradient-to-br from-violet-50/40 via-background to-orange-50/40',
        )}
      >
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
