import { motion } from "framer-motion";
import { Clock, AlertTriangle, User, CheckCircle2, ArrowRight, ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore, type QueuePriority } from "@/stores/whatsappCRMStore";

const PRIORITY_CONFIG: Record<QueuePriority, { label: string; color: string; icon: typeof Clock }> = {
  baixa: { label: "Baixa", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900", icon: Clock },
  media: { label: "Média", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/20", icon: Clock },
  alta: { label: "Alta", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20", icon: AlertTriangle },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20", icon: AlertTriangle },
};

export default function QueuePanel() {
  const { fila, conversas, atenderFila, transferirFila, setConversaAtiva } = useWhatsAppCRMStore();

  const getContato = (id: string) => conversas.find((c) => c.id === id);

  const agrupado = {
    urgentes: fila.filter((f) => f.prioridade === "urgente" && f.status === "aguardando"),
    pendentes: fila.filter((f) => f.prioridade !== "urgente" && f.status === "aguardando"),
    atendimento: fila.filter((f) => f.status === "em_atendimento"),
    resolvidos: fila.filter((f) => f.status === "resolvido").slice(0, 3),
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground">Fila de Atendimento</h2>
        <p className="text-sm text-muted-foreground">{fila.filter((f) => f.status === "aguardando").length} aguardando · {fila.filter((f) => f.status === "em_atendimento").length} em atendimento</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Aguardando", value: fila.filter((f) => f.status === "aguardando").length, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
          { label: "Em atendimento", value: fila.filter((f) => f.status === "em_atendimento").length, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
          { label: "Tempo médio", value: "4min", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20", isTime: true },
        ].map((s) => (
          <div key={s.label} className={cn("p-3 rounded-xl text-center", s.bg)}>
            <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {agrupado.urgentes.length > 0 && (
        <Section title="🔴 Urgentes" count={agrupado.urgentes.length}>
          {agrupado.urgentes.map((item) => {
            const contato = getContato(item.contatoId);
            return <QueueItem key={item.id} item={item} contato={contato} onAtender={atenderFila} onConversa={setConversaAtiva} />;
          })}
        </Section>
      )}

      <Section title="⏳ Pendentes" count={agrupado.pendentes.length}>
        {agrupado.pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item pendente</p>
        ) : (
          agrupado.pendentes.map((item) => {
            const contato = getContato(item.contatoId);
            return <QueueItem key={item.id} item={item} contato={contato} onAtender={atenderFila} onConversa={setConversaAtiva} />;
          })
        )}
      </Section>

      {agrupado.atendimento.length > 0 && (
        <Section title="👤 Em Atendimento" count={agrupado.atendimento.length}>
          {agrupado.atendimento.map((item) => {
            const contato = getContato(item.contatoId);
            return <QueueItem key={item.id} item={item} contato={contato} onAtender={atenderFila} onConversa={setConversaAtiva} />;
          })}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{count} itens</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function QueueItem({ item, contato, onAtender, onConversa }: { item: any; contato: any; onAtender: (id: string) => void; onConversa: (id: string) => void }) {
  const config = PRIORITY_CONFIG[item.prioridade as QueuePriority] || PRIORITY_CONFIG.media;
  const Icon = config.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted shrink-0">
            {contato && <img src={contato.avatar} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{contato?.nome || "Desconhecido"}</p>
            <p className="text-xs text-muted-foreground">{item.motivo}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border", config.color)}>
                <Icon className="w-2.5 h-2.5" />
                {config.label}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {item.tempoEspera > 60 ? `${Math.floor(item.tempoEspera / 60)}h` : `${item.tempoEspera}min`} de espera
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { onConversa(item.contatoId); onAtender(item.id); }} className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90">
            Atender
          </button>
        </div>
      </div>
    </motion.div>
  );
}
