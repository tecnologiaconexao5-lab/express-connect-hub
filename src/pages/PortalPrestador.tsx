import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Package, FileText, GraduationCap, User,
  Bell, ChevronLeft, Clock, Wifi, Battery, Signal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPrestadorStore } from "@/stores/portalPrestadorStore";
import DashboardTab from "@/components/portal-prestador/DashboardTab";
import OperacoesTab from "@/components/portal-prestador/OperacoesTab";
import DocumentosTab from "@/components/portal-prestador/DocumentosTab";
import TreinamentosTab from "@/components/portal-prestador/TreinamentosTab";
import PerfilTab from "@/components/portal-prestador/PerfilTab";

const TABS = [
  { id: "dashboard", icon: LayoutDashboard, label: "Início" },
  { id: "operacoes", icon: Package, label: "Operações" },
  { id: "documentos", icon: FileText, label: "Documentos" },
  { id: "treinamentos", icon: GraduationCap, label: "Treinamentos" },
  { id: "perfil", icon: User, label: "Perfil" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_COMPONENTS: Record<TabId, () => JSX.Element> = {
  dashboard: DashboardTab,
  operacoes: OperacoesTab,
  documentos: DocumentosTab,
  treinamentos: TreinamentosTab,
  perfil: PerfilTab,
};

const TAB_TITLES: Record<TabId, string> = {
  dashboard: "Início",
  operacoes: "Operações",
  documentos: "Documentos",
  treinamentos: "Treinamentos",
  perfil: "Perfil",
};

export default function PortalPrestador() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [time, setTime] = useState(new Date());
  const notificacoes = usePortalPrestadorStore((s) => s.notificacoes.filter((n) => !n.lida).length);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-lg mx-auto relative">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Signal className="w-3.5 h-3.5 text-muted-foreground" />
          <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
          <Battery className="w-4 h-3.5 text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 scrollbar-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-2 pt-1 pb-3 border-t border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-around">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const hasNotification = tab.id === "dashboard" && notificacoes > 0;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-0"
              >
                <div className={cn(
                  "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  isActive && "bg-primary/10"
                )}>
                  <Icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  {hasNotification && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center"
                    >
                      {notificacoes}
                    </motion.span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-1 w-6 h-0.5 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
