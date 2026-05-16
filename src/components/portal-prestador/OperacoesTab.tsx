import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, MapPin, ArrowRight, Check, X, Clock, Search, Filter, Play, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPrestadorStore, type Operacao } from "@/stores/portalPrestadorStore";
import { Button } from "@/components/ui/button";

type FiltroStatus = "todas" | "pendente" | "aceita" | "em_andamento" | "concluida";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" },
  aceita: { label: "Aceita", color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" },
  em_andamento: { label: "Em andamento", color: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" },
  concluida: { label: "Concluída", color: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700" },
  recusada: { label: "Recusada", color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" },
  cancelada: { label: "Cancelada", color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" },
};

export default function OperacoesTab() {
  const { operacoes, aceitarOperacao, recusarOperacao, iniciarOperacao, concluirOperacao } = usePortalPrestadorStore();
  const [filtro, setFiltro] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");

  const filtradas = operacoes.filter((o) => {
    if (filtro !== "todas" && o.status !== filtro) return false;
    if (busca && !o.cliente.toLowerCase().includes(busca.toLowerCase()) && !o.carga.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Operações</h1>
        <p className="text-sm text-muted-foreground">{operacoes.filter((o) => o.status === "pendente").length} novas disponíveis</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar operações..."
          className="w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(["todas", "pendente", "aceita", "em_andamento", "concluida"] as FiltroStatus[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={cn("px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap border transition-all", filtro === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40")}>
            {f === "todas" ? "Todas" : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {filtradas.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma operação encontrada</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filtradas.map((op) => (
              <OperacaoCard key={op.id} op={op} onAccept={aceitarOperacao} onDecline={recusarOperacao} onStart={iniciarOperacao} onComplete={concluirOperacao} />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OperacaoCard({ op, onAccept, onDecline, onStart, onComplete }: { op: Operacao; onAccept: (id: string) => void; onDecline: (id: string) => void; onStart: (id: string) => void; onComplete: (id: string) => void }) {
  const config = STATUS_CONFIG[op.status] || STATUS_CONFIG.pendente;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="p-4 rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{op.cliente}</p>
          <p className="text-xs text-muted-foreground">{op.carga} · {op.peso}</p>
        </div>
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium border", config.color)}>{config.label}</span>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-foreground font-medium text-xs">{op.origem}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-foreground font-medium text-xs">{op.destino}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{op.distancia}</span>
          <span>·</span>
          <span>R$ {op.valor.toLocaleString("pt-BR")}</span>
          <span>·</span>
          <span>{op.tipoCarga}</span>
        </div>
      </div>

      <AnimatePresence>
        {op.status === "pendente" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex gap-2">
            <Button onClick={() => onAccept(op.id)} size="sm" className="flex-1 gap-1.5 rounded-xl h-10 text-sm">
              <Check className="w-4 h-4" /> Aceitar
            </Button>
            <Button onClick={() => onDecline(op.id)} variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl h-10 text-sm">
              <X className="w-4 h-4" /> Recusar
            </Button>
          </motion.div>
        )}
        {op.status === "aceita" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button onClick={() => onStart(op.id)} className="w-full gap-2 rounded-xl h-10 text-sm">
              <Play className="w-4 h-4" /> Iniciar Viagem
            </Button>
          </motion.div>
        )}
        {op.status === "em_andamento" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button onClick={() => onComplete(op.id)} className="w-full gap-2 rounded-xl h-10 text-sm bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4" /> Finalizar Entrega
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {op.status === "concluida" && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Concluída em {op.dataEntrega ? new Date(op.dataEntrega).toLocaleDateString("pt-BR") : "-"}
        </div>
      )}
    </motion.div>
  );
}
