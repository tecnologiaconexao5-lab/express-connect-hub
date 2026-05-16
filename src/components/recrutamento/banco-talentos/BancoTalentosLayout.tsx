import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Users, Star, MapIcon, TrendingUp, GitMerge, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardEstrategico from "./DashboardEstrategico";
import TalentList from "./TalentList";
import TalentProfile from "./TalentProfile";
import ShortlistPanel from "./ShortlistPanel";
import RegioesCriticas from "./RegioesCriticas";
import PipelineConversao from "./PipelineConversao";
import AdvancedFilters from "./AdvancedFilters";

type ViewMode = "talentos" | "dashboard" | "shortlists" | "regioes" | "pipeline";

export default function BancoTalentosLayout() {
  const [view, setView] = useState<ViewMode>("talentos");
  const [showFilters, setShowFilters] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const navItems = [
    { id: "talentos" as ViewMode, icon: Users, label: "Talentos", desc: "Banco inteligente" },
    { id: "dashboard" as ViewMode, icon: BarChart3, label: "Dashboard", desc: "Métricas estratégicas" },
    { id: "shortlists" as ViewMode, icon: Star, label: "Shortlists", desc: "Listas inteligentes" },
    { id: "regioes" as ViewMode, icon: MapIcon, label: "Regiões", desc: "Análise geográfica" },
    { id: "pipeline" as ViewMode, icon: TrendingUp, label: "Pipeline", desc: "Conversão & retenção" },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Search className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Banco de Talentos Logísticos</h1>
            <p className="text-[10px] text-muted-foreground">Sistema inteligente de recrutamento enterprise</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === "talentos" && (
            <button onClick={() => setShowFilters(!showFilters)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/40")}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-border bg-muted/20">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => { setView(item.id); setShowProfile(false); }} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium border-b-2 transition-all", view === item.id ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30")}>
            <item.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "talentos" && (
            <motion.div key="talentos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex overflow-hidden">
              {showFilters && (
                <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="border-r border-border overflow-hidden shrink-0">
                  <AdvancedFilters onClose={() => setShowFilters(false)} />
                </motion.div>
              )}
              <div className="flex-1 flex overflow-hidden">
                <div className={cn("flex-1 overflow-y-auto", showProfile && "hidden lg:block")}>
                  <TalentList onSelectProfile={() => setShowProfile(true)} />
                </div>
                {showProfile && (
                  <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 400, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="border-l border-border overflow-y-auto shrink-0">
                    <TalentProfile onClose={() => setShowProfile(false)} />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
          {view === "dashboard" && <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto"><DashboardEstrategico /></motion.div>}
          {view === "shortlists" && <motion.div key="shortlists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto"><ShortlistPanel /></motion.div>}
          {view === "regioes" && <motion.div key="regioes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto"><RegioesCriticas /></motion.div>}
          {view === "pipeline" && <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto"><PipelineConversao /></motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}
