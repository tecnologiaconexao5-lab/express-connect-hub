import { motion } from "framer-motion";
import { Search, MessageSquare, Filter, ChevronDown, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore, type ConversationStatus } from "@/stores/whatsappCRMStore";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  nova: { label: "Nova", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/20" },
  em_analise: { label: "Em análise", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20" },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/20" },
  reprovado: { label: "Reprovado", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20" },
  bloqueado: { label: "Bloqueado", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20" },
  treinamento: { label: "Treinamento", color: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/20" },
  reativado: { label: "Reativado", color: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/20" },
};

const FILTROS: { value: ConversationStatus | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "nova", label: "Novas" },
  { value: "em_analise", label: "Em análise" },
  { value: "aprovado", label: "Aprovados" },
  { value: "bloqueado", label: "Bloqueados" },
  { value: "treinamento", label: "Treinamento" },
];

export default function ConversationList() {
  const { conversas, searchQuery, filtroStatus, conversaAtiva, setConversaAtiva, setSearchQuery, setFiltroStatus } = useWhatsAppCRMStore();

  const filtradas = conversas.filter((c) => {
    if (filtroStatus !== "todas" && c.status !== filtroStatus) return false;
    if (searchQuery && !c.nome.toLowerCase().includes(searchQuery.toLowerCase()) && !c.telefone.includes(searchQuery)) return false;
    return true;
  });

  return (
    <>
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar conversas..." className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTROS.map((f) => (
            <button key={f.value} onClick={() => setFiltroStatus(f.value)} className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap border transition-all", filtroStatus === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filtradas.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filtradas.map((contato) => {
            const config = STATUS_CONFIG[contato.status] || STATUS_CONFIG.nova;
            const isActive = conversaAtiva === contato.id;
            return (
              <motion.button key={contato.id} onClick={() => setConversaAtiva(contato.id)} initial={false} animate={{ backgroundColor: isActive ? "hsl(var(--muted))" : "transparent" }} className={cn("w-full px-3 py-3 flex items-start gap-3 text-left transition-colors hover:bg-muted/50", isActive && "bg-muted")}>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted">
                    <img src={contato.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background", contato.humanoAssumiu ? "bg-orange-500" : "bg-primary")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold text-foreground truncate">{contato.nome}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(contato.ultimaData)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{contato.ultimaMensagem}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium border", config.color)}>{config.label}</span>
                    {!contato.humanoAssumiu && contato.iaAtiva && <span className="flex items-center gap-0.5 text-[9px] text-primary font-medium"><Bot className="w-2.5 h-2.5" />IA</span>}
                    {contato.humanoAssumiu && <span className="flex items-center gap-0.5 text-[9px] text-orange-500 font-medium"><User className="w-2.5 h-2.5" />Humano</span>}
                    {contato.naoLidas > 0 && <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center ml-auto">{contato.naoLidas}</span>}
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
