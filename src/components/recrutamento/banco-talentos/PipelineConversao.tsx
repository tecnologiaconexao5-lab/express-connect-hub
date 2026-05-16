import { motion } from "framer-motion";
import { TrendingUp, Users, Target, ArrowRight, CheckCircle2, UserPlus, UserMinus, Activity, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentBankStore } from "@/stores/talentBankStore";

export default function PipelineConversao() {
  const { metricasConversao, metricasRetencao, talentos } = useTalentBankStore();

  const taxaConversaoGeral = Math.round((metricasConversao[metricasConversao.length - 1].convertidos / metricasConversao[0].total) * 100);
  const retencaoMedia = Math.round(metricasRetencao.reduce((a, m) => a + m.taxaRetencao, 0) / metricasRetencao.length);
  const taxaCrescimento = metricasRetencao.length >= 2 ? Math.round(((metricasRetencao[metricasRetencao.length - 1].ativos - metricasRetencao[0].ativos) / metricasRetencao[0].ativos) * 100) : 0;

  const ganhoPorTalento = Math.round(talentos.reduce((a, t) => a + t.receitaMediaMes, 0) / talentos.length);
  const expansaoPotencial = talentos.filter((t) => !t.disponivel && t.statusDocumental !== "expirado").length;

  return (
    <div className="p-5 space-y-5 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground">Pipeline de Conversão & Retenção</h2>
        <p className="text-sm text-muted-foreground">Análise completa do funil de talentos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Target, label: "Conversão Geral", value: `${taxaConversaoGeral}%`, sub: `${metricasConversao[0].total} → ${metricasConversao[metricasConversao.length - 1].convertidos}`, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
          { icon: Activity, label: "Retenção Média", value: `${retencaoMedia}%`, sub: `${metricasRetencao.length} meses`, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
          { icon: TrendingUp, label: "Crescimento", value: `${taxaCrescimento}%`, sub: `${metricasRetencao[metricasRetencao.length - 1].ativos} ativos`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
          { icon: DollarSign, label: "Ganho/Talento", value: `R$ ${ganhoPorTalento.toLocaleString("pt-BR")}`, sub: "receita média mensal", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
        ].map((s) => (
          <div key={s.label} className={cn("p-3 rounded-xl", s.bg)}>
            <s.icon className={cn("w-4 h-4 mb-1", s.color)} />
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className="text-[9px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Funil de Conversão
          </h3>
          <div className="space-y-0">
            {metricasConversao.map((m, i) => (
              <div key={m.etapa} className="relative">
                <div className="flex items-center gap-3 p-2.5">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", m.taxa >= 85 ? "bg-green-100" : m.taxa >= 70 ? "bg-amber-100" : "bg-red-100")}>
                    <span className={cn("text-[9px] font-bold", m.taxa >= 85 ? "text-green-700" : m.taxa >= 70 ? "text-amber-700" : "text-red-700")}>{m.taxa}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{m.etapa}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{m.convertidos} convertidos</span>
                      <span>·</span>
                      <span>{m.total} total</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                <div className="absolute left-3.5 top-10 bottom-0 w-0.5 bg-border" style={{ display: i < metricasConversao.length - 1 ? "block" : "none" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Retenção Mensal
            </h3>
            <div className="space-y-2.5">
              {metricasRetencao.map((m, i) => (
                <div key={m.mes} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{m.mes}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-green-600 font-medium">+{m.novos}</span>
                      <span className="text-red-600 font-medium">-{m.perdidos}</span>
                      <span className="text-foreground font-bold">{m.ativos}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${m.taxaRetencao}%` }}
                      transition={{ delay: i * 0.05 }}
                      className={cn("h-full rounded-full", m.taxaRetencao >= 93 ? "bg-green-500" : m.taxaRetencao >= 90 ? "bg-amber-500" : "bg-red-500")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Oportunidades de Expansão
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20">
                <p className="text-lg font-bold text-amber-600">{expansaoPotencial}</p>
                <p className="text-[10px] text-muted-foreground">Disponíveis para reativação</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20">
                <p className="text-lg font-bold text-green-600">{talentos.filter((t) => t.statusDocumental === "pendente").length}</p>
                <p className="text-[10px] text-muted-foreground">Docs pendentes (follow-up)</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                <p className="text-lg font-bold text-blue-600">{talentos.filter((t) => t.nivel === "diamante" || t.nivel === "ouro").length}</p>
                <p className="text-[10px] text-muted-foreground">Talentos premium</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20">
                <p className="text-lg font-bold text-purple-600">{talentos.filter((t) => t.favorito).length}</p>
                <p className="text-[10px] text-muted-foreground">Favoritos estratégicos</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
