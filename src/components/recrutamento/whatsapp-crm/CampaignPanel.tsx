import { motion } from "framer-motion";
import { Send, BarChart3, Plus, CheckCircle2, Clock, Eye, MessageCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore, type CampaignStatus } from "@/stores/whatsappCRMStore";

const STATUS_CAMPANHA: Record<CampaignStatus, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-700 border-slate-200" },
  agendada: { label: "Agendada", color: "bg-blue-100 text-blue-700 border-blue-200" },
  enviando: { label: "Enviando", color: "bg-amber-100 text-amber-700 border-amber-200" },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700 border-green-200" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700 border-red-200" },
};

export default function CampaignPanel() {
  const { campanhas, templates, criarCampanha } = useWhatsAppCRMStore();

  const totalEnviadas = campanhas.reduce((a, c) => a + c.enviadas, 0);
  const totalEntregues = campanhas.reduce((a, c) => a + c.entregues, 0);
  const totalLidas = campanhas.reduce((a, c) => a + c.lidas, 0);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Campanhas WhatsApp</h2>
          <p className="text-sm text-muted-foreground">{campanhas.length} campanhas · {totalEnviadas} mensagens enviadas</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium">
          <Plus className="w-4 h-4" />
          Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Enviadas", value: totalEnviadas, icon: Send, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
          { label: "Entregues", value: totalEntregues, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
          { label: "Lidas", value: totalLidas, icon: Eye, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
          { label: "Conversões", value: campanhas.reduce((a, c) => a + c.respondidas, 0), icon: MessageCircle, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
        ].map((s) => (
          <div key={s.label} className={cn("p-3 rounded-xl", s.bg)}>
            <div className="flex items-center justify-between mb-1">
              <s.icon className={cn("w-4 h-4", s.color)} />
              <span className={cn("text-xs font-bold", s.color)}>{totalEnviadas > 0 ? Math.round((s.value / totalEnviadas) * 100) : 0}%</span>
            </div>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {campanhas.map((camp, i) => {
          const config = STATUS_CAMPANHA[camp.status] || STATUS_CAMPANHA.rascunho;
          const taxaEntrega = camp.enviadas > 0 ? Math.round((camp.entregues / camp.enviadas) * 100) : 0;
          const taxaLida = camp.entregues > 0 ? Math.round((camp.lidas / camp.entregues) * 100) : 0;

          return (
            <motion.div key={camp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{camp.nome}</p>
                  <p className="text-xs text-muted-foreground">Template: {templates.find((t) => t.id === camp.templateId)?.nome || "N/A"}</p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border", config.color)}>{config.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Metric label="Enviadas" value={camp.enviadas} color="text-blue-600" />
                <Metric label="Entregues" value={camp.entregues} color="text-green-600" />
                <Metric label="Respondidas" value={camp.respondidas} color="text-purple-600" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Taxa de entrega</span>
                  <span className="font-medium text-foreground">{taxaEntrega}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${taxaEntrega}%` }} className="h-full rounded-full bg-blue-500" />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Taxa de leitura</span>
                  <span className="font-medium text-foreground">{taxaLida}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${taxaLida}%` }} className="h-full rounded-full bg-green-500" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/30">
      <p className={cn("text-sm font-bold", color)}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
