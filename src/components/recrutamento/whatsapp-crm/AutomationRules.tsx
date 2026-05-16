import { motion } from "framer-motion";
import { Settings, Power, PowerOff, Zap, Clock, Trash2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore, type AutomationTrigger } from "@/stores/whatsappCRMStore";

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  novo_candidato: "Novo candidato",
  documento_pendente: "Documento pendente",
  documento_aprovado: "Documento aprovado",
  inativo: "Prestador inativo",
  aprovado_sem_ativar: "Aprovado sem ativar",
  treinamento_pendente: "Treinamento pendente",
  score_baixo: "Score baixo",
  aniversario_cadastro: "Aniversário cadastro",
  reativacao: "Reativação",
};

export default function AutomationRules() {
  const { automacoes, toggleAutomacao } = useWhatsAppCRMStore();

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Automações</h2>
          <p className="text-sm text-muted-foreground">{automacoes.filter((a) => a.ativa).length} regras ativas de {automacoes.length}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium">
          <Zap className="w-4 h-4" />
          Nova Regra
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Regras ativas", value: automacoes.filter((a) => a.ativa).length, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
          { label: "Total execuções", value: automacoes.reduce((a, r) => a + r.totalExecucoes, 0), color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
          { label: "Inativas", value: automacoes.filter((a) => !a.ativa).length, color: "text-muted-foreground", bg: "bg-muted" },
        ].map((s) => (
          <div key={s.label} className={cn("p-3 rounded-xl", s.bg)}>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {automacoes.map((regra, i) => (
          <motion.div
            key={regra.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn("p-4 rounded-xl border transition-all", regra.ativa ? "border-border bg-card" : "border-dashed border-border bg-muted/30 opacity-60")}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", regra.ativa ? "bg-primary/10" : "bg-muted")}>
                  <Zap className={cn("w-4 h-4", regra.ativa ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{regra.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border">
                      {TRIGGER_LABELS[regra.trigger] || regra.trigger}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {regra.totalExecucoes}x executada
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleAutomacao(regra.id)}
                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", regra.ativa ? "bg-green-100 text-green-700 dark:bg-green-950/30" : "bg-muted text-muted-foreground")}
              >
                {regra.ativa ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {regra.acoes.map((acao, j) => (
                <span key={j} className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-muted text-muted-foreground border border-border">
                  {acao.tipo.replace("_", " ")}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
