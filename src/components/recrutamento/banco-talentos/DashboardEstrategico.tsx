import { motion } from "framer-motion";
import { Users, TrendingUp, Star, Target, DollarSign, Activity, UserPlus, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentBankStore } from "@/stores/talentBankStore";

export default function DashboardEstrategico() {
  const { talentos, metricasRetencao, metricasConversao, regioesCriticas } = useTalentBankStore();

  const ativos = talentos.filter((t) => t.disponivel).length;
  const diamante = talentos.filter((t) => t.nivel === "diamante").length;
  const ouro = talentos.filter((t) => t.nivel === "ouro").length;
  const prata = talentos.filter((t) => t.nivel === "prata").length;
  const bronze = talentos.filter((t) => t.nivel === "bronze").length;
  const scoreMedio = Math.round(talentos.reduce((a, t) => a + t.score, 0) / talentos.length);
  const receitaTotal = talentos.reduce((a, t) => a + t.receitaTotal, 0);
  const receitaMedia = Math.round(talentos.reduce((a, t) => a + t.receitaMediaMes, 0) / talentos.length);
  const viagensTotal = talentos.reduce((a, t) => a + t.totalViagens, 0);

  const topTalentos = [...talentos].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="p-5 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground">Dashboard Estratégico</h2>
        <p className="text-sm text-muted-foreground">Visão completa do banco de talentos logísticos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Total Talentos", value: talentos.length, sub: `${ativos} disponíveis`, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
          { icon: Star, label: "Score Médio", value: scoreMedio, sub: `Máx ${Math.max(...talentos.map((t) => t.score))}`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
          { icon: DollarSign, label: "Receita Média/Mês", value: `R$ ${receitaMedia.toLocaleString("pt-BR")}`, sub: `Total R$ ${(receitaTotal / 1000).toFixed(0)}k`, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
          { icon: Activity, label: "Viagens Realizadas", value: viagensTotal.toLocaleString("pt-BR"), sub: `${Math.round(viagensTotal / talentos.length)} por talento`, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn("p-4 rounded-xl", card.bg)}>
            <div className="flex items-center justify-between mb-2">
              <card.icon className={cn("w-5 h-5", card.color)} />
            </div>
            <p className={cn("text-xl font-bold", card.color)}>{card.value}</p>
            <p className="text-xs text-foreground font-medium">{card.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-3">Pipeline de Conversão</h3>
          <div className="space-y-2">
            {metricasConversao.map((m, i) => (
              <div key={m.etapa} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold", m.taxa >= 85 ? "bg-green-100 text-green-700" : m.taxa >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                      {m.taxa}%
                    </span>
                    <span className="text-foreground font-medium">{m.etapa}</span>
                  </div>
                  <span className="text-muted-foreground">{m.convertidos}/{m.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${m.taxa}%` }} transition={{ delay: i * 0.05 }} className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Distribuição por Nível</h3>
          <div className="space-y-3">
            {[
              { nivel: "Diamante", count: diamante, color: "bg-cyan-500", text: "text-cyan-600" },
              { nivel: "Ouro", count: ouro, color: "bg-yellow-500", text: "text-yellow-600" },
              { nivel: "Prata", count: prata, color: "bg-slate-400", text: "text-slate-500" },
              { nivel: "Bronze", count: bronze, color: "bg-amber-700", text: "text-amber-800" },
            ].map((n) => (
              <div key={n.nivel} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={cn("font-medium", n.text)}>{n.nivel}</span>
                  <span className="text-muted-foreground">{n.count} ({Math.round((n.count / talentos.length) * 100)}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(n.count / talentos.length) * 100}%` }} className={cn("h-full rounded-full", n.color)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top 5 Talentos</h3>
          <div className="space-y-2">
            {topTalentos.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img src={t.foto} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{t.veiculo.tipo} · {t.regiao}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{t.score}</p>
                  <p className="text-[9px] uppercase font-medium" style={{ color: t.nivel === "diamante" ? "#06b6d4" : t.nivel === "ouro" ? "#f59e0b" : t.nivel === "prata" ? "#94a3b8" : "#cd7f32" }}>{t.nivel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Retenção de Talentos</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { icon: UserPlus, label: "Novos (Mai)", value: metricasRetencao[metricasRetencao.length - 1].novos, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
                { icon: UserMinus, label: "Perdidos (Mai)", value: metricasRetencao[metricasRetencao.length - 1].perdidos, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
                { icon: TrendingUp, label: "Retenção", value: `${metricasRetencao[metricasRetencao.length - 1].taxaRetencao}%`, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
              ].map((s) => (
                <div key={s.label} className={cn("p-2 rounded-lg text-center", s.bg)}>
                  <p className={cn("text-sm font-bold", s.color)}>{s.value}</p>
                  <p className="text-[9px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {metricasRetencao.map((m, i) => (
                <div key={m.mes} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-muted-foreground font-medium">{m.mes}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${m.taxaRetencao}%` }} transition={{ delay: i * 0.05 }} className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                  </div>
                  <span className="w-8 text-right font-medium text-foreground">{m.taxaRetencao}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Status Documental</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Completo", count: talentos.filter((t) => t.statusDocumental === "completo").length, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
            { label: "Parcial", count: talentos.filter((t) => t.statusDocumental === "parcial").length, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
            { label: "Pendente", count: talentos.filter((t) => t.statusDocumental === "pendente").length, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
            { label: "Expirado", count: talentos.filter((t) => t.statusDocumental === "expirado").length, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
          ].map((s) => (
            <div key={s.label} className={cn("p-3 rounded-xl text-center", s.bg)}>
              <p className={cn("text-lg font-bold", s.color)}>{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
