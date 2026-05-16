import { motion } from "framer-motion";
import { MapIcon, TrendingUp, TrendingDown, Users, AlertTriangle, Target, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentBankStore } from "@/stores/talentBankStore";

export default function RegioesCriticas() {
  const { regioesCriticas, talentos } = useTalentBankStore();

  const deficitTotal = regioesCriticas.reduce((a, r) => a + Math.abs(r.deficit), 0);
  const demandaTotal = regioesCriticas.reduce((a, r) => a + r.demanda, 0);
  const ofertaTotal = regioesCriticas.reduce((a, r) => a + r.oferta, 0);
  const coberturaMedia = Math.round((ofertaTotal / demandaTotal) * 100);

  return (
    <div className="p-5 space-y-5 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground">Regiões Críticas</h2>
        <p className="text-sm text-muted-foreground">Análise de oferta e demanda por região</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Target, label: "Demanda Total", value: demandaTotal, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
          { icon: Users, label: "Oferta Total", value: ofertaTotal, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
          { icon: AlertTriangle, label: "Déficit Total", value: deficitTotal, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" },
          { icon: TrendingUp, label: "Cobertura", value: `${coberturaMedia}%`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
        ].map((s) => (
          <div key={s.label} className={cn("p-3 rounded-xl", s.bg)}>
            <div className="flex items-center justify-between mb-1">
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {regioesCriticas
          .sort((a, b) => a.deficit - b.deficit)
          .map((regiao, i) => {
            const cobertura = Math.round((regiao.oferta / regiao.demanda) * 100);
            const talentosRegiao = talentos.filter((t) => t.regioesAtuacao.includes(regiao.nome));

            return (
              <motion.div key={regiao.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", regiao.deficit <= -50 ? "bg-red-50" : regiao.deficit <= -20 ? "bg-amber-50" : "bg-green-50")}>
                      {regiao.deficit <= -50 ? <TrendingDown className="w-5 h-5 text-red-500" /> : regiao.deficit <= -20 ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <TrendingUp className="w-5 h-5 text-green-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{regiao.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{talentosRegiao.length} talentos cadastrados</p>
                    </div>
                  </div>
                  <div className={cn("text-right", regiao.deficit < 0 ? "text-red-600" : "text-green-600")}>
                    <p className="text-lg font-bold">{regiao.deficit}</p>
                    <p className="text-[9px] text-muted-foreground">déficit</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Demanda", value: regiao.demanda, color: "text-blue-600" },
                    { label: "Oferta", value: regiao.oferta, color: "text-green-600" },
                    { label: "Cobertura", value: `${cobertura}%`, color: cobertura >= 80 ? "text-green-600" : cobertura >= 50 ? "text-amber-600" : "text-red-600" },
                  ].map((m) => (
                    <div key={m.label} className="p-2 rounded-lg bg-muted/30 text-center">
                      <p className={cn("text-sm font-bold", m.color)}>{m.value}</p>
                      <p className="text-[9px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Cobertura</span>
                    <span className={cn("font-medium", cobertura >= 80 ? "text-green-600" : cobertura >= 50 ? "text-amber-600" : "text-red-600")}>{cobertura}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cobertura}%` }}
                      className={cn("h-full rounded-full", cobertura >= 80 ? "bg-green-500" : cobertura >= 50 ? "bg-amber-500" : "bg-red-500")}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
      </div>
    </div>
  );
}
