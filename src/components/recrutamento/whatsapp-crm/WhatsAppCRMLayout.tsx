import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Bot, Users, FileText, Settings, Send,
  PanelRight, PanelLeft, ChevronDown, Bell, Search, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore } from "@/stores/whatsappCRMStore";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import ContactDetails from "./ContactDetails";
import QueuePanel from "./QueuePanel";
import AIPanel from "./AIPanel";
import CampaignPanel from "./CampaignPanel";
import AutomationRules from "./AutomationRules";

type ViewMode = "chat" | "fila" | "ia" | "campanhas" | "automacoes";

export default function WhatsAppCRMLayout() {
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [showDetails, setShowDetails] = useState(true);
  const [showMobileList, setShowMobileList] = useState(true);
  const { conversaAtiva, iaGlobalAtiva, toggleIaGlobal, notificacoes, fila } = useWhatsAppCRMStore();

  const filaUrgentes = fila.filter((f) => f.prioridade === "urgente" && f.status === "aguardando").length;

  const navItems = [
    { id: "chat" as ViewMode, icon: MessageSquare, label: "Conversas", badge: 0 },
    { id: "fila" as ViewMode, icon: Users, label: "Fila", badge: filaUrgentes },
    { id: "ia" as ViewMode, icon: Bot, label: "IA", badge: 0 },
    { id: "campanhas" as ViewMode, icon: Send, label: "Campanhas", badge: 0 },
    { id: "automacoes" as ViewMode, icon: Settings, label: "Automações", badge: 0 },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">WhatsApp CRM</h1>
            <p className="text-[10px] text-muted-foreground">Recrutamento · IA Operacional</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleIaGlobal} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", iaGlobalAtiva ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20" : "bg-muted text-muted-foreground border-border")}>
            <div className={cn("w-2 h-2 rounded-full", iaGlobalAtiva ? "bg-green-500" : "bg-muted-foreground")} />
            IA {iaGlobalAtiva ? "Ativa" : "Inativa"}
          </button>
          <button className="relative w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Bell className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex flex-col w-12 border-r border-border bg-muted/30 items-center py-2 gap-1">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setViewMode(item.id)} className={cn("relative w-10 h-10 rounded-xl flex items-center justify-center transition-all", viewMode === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <item.icon className="w-4 h-4" />
              {item.badge > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">{item.badge}</span>}
            </button>
          ))}
        </div>

        <div className="flex lg:hidden h-10 border-b border-border bg-card">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setViewMode(item.id)} className={cn("flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border-b-2 transition-all", viewMode === item.id ? "text-primary border-primary" : "text-muted-foreground border-transparent")}>
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
              {item.badge > 0 && <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">{item.badge}</span>}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {viewMode === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 overflow-hidden">
              <div className={cn("w-80 border-r border-border flex flex-col shrink-0", showMobileList && conversaAtiva ? "hidden md:flex" : "flex")}>
                <ConversationList />
              </div>
              {conversaAtiva ? (
                <div className="flex-1 flex flex-col min-w-0">
                  <ChatWindow onToggleDetails={() => setShowDetails(!showDetails)} />
                </div>
              ) : (
                <div className="flex-1 hidden md:flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm">Selecione uma conversa</p>
                    <p className="text-xs">ou aguarde novas mensagens</p>
                  </div>
                </div>
              )}
              {conversaAtiva && showDetails && (
                <div className="hidden xl:flex w-72 border-l border-border flex-col overflow-y-auto">
                  <ContactDetails />
                </div>
              )}
            </motion.div>
          )}
          {viewMode === "fila" && <motion.div key="fila" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-4"><QueuePanel /></motion.div>}
          {viewMode === "ia" && <motion.div key="ia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-4"><AIPanel /></motion.div>}
          {viewMode === "campanhas" && <motion.div key="campanhas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-4"><CampaignPanel /></motion.div>}
          {viewMode === "automacoes" && <motion.div key="automacoes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto p-4"><AutomationRules /></motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}
