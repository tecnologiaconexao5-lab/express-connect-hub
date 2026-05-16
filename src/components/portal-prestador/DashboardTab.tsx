import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Award, Bell, Circle, ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPrestadorStore } from "@/stores/portalPrestadorStore";
import ScoreGauge from "@/components/onboarding/ScoreGauge";

const STATUS_COLORS = {
  Bronze: "from-amber-700 to-amber-500",
  Prata: "from-slate-400 to-slate-300",
  Ouro: "from-yellow-500 to-yellow-400",
  Diamante: "from-cyan-500 to-blue-500",
};

export default function DashboardTab() {
  const { score, ganhosMes, ganhosSemana, ranking, totalPrestadores, disponivel, operacoesPendentes, operacoesAtivas, perfil, notificacoes, toggleDisponivel, marcarTodasLidas } = usePortalPrestadorStore();

  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const recentes = notificacoes.slice(0, 3);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
          <h1 className="text-2xl font-bold text-foreground">{perfil.nome.split(" ")[0]}</h1>
        </div>
        <div className="relative">
          <button onClick={marcarTodasLidas} className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {naoLidas > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {naoLidas}
              </motion.span>
            )}
          </button>
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={toggleDisponivel} className={cn("w-full p-4 rounded-2xl border flex items-center justify-between transition-all", disponivel ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-muted/30 border-border")}>
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", disponivel ? "bg-green-500 shadow-lg shadow-green-500/30" : "bg-muted-foreground")}>
            {disponivel && <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-3 h-3 rounded-full bg-green-500" />}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">{disponivel ? "Disponível para viagens" : "Indisponível"}</p>
            <p className="text-xs text-muted-foreground">Toque para alternar</p>
          </div>
        </div>
        <div className={cn("px-3 py-1 rounded-full text-xs font-medium", disponivel ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100" : "bg-muted text-muted-foreground")}>
          {disponivel ? "ON" : "OFF"}
        </div>
      </motion.button>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <DollarSign className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold text-foreground">R$ {ganhosMes.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">Ganhos do mês</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-4 rounded-2xl bg-gradient-to-br from-green-50 to-green-50/30 border border-green-100 dark:from-green-950/20 dark:border-green-800">
          <TrendingUp className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-foreground">R$ {ganhosSemana.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">Esta semana</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-4 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">{score.classification}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{score.total}</p>
          <p className="text-xs text-muted-foreground">Score geral</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${score.total}%` }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${score.color}, ${score.color}88)` }} />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="p-4 rounded-2xl border border-border bg-card">
          <MapPin className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-foreground">#{ranking}</p>
          <p className="text-xs text-muted-foreground">de {totalPrestadores} prestadores</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="text-green-600 font-medium">Top {Math.round((1 - ranking / totalPrestadores) * 100)}%</span>
          </div>
        </motion.div>
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Operações</h3>
          <span className="text-xs text-muted-foreground">Ativas · {operacoesAtivas}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-800">
            <p className="text-lg font-bold text-amber-600">{operacoesPendentes}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-800">
            <p className="text-lg font-bold text-blue-600">{operacoesAtivas}</p>
            <p className="text-xs text-muted-foreground">Em andamento</p>
          </div>
        </div>
      </div>

      {recentes.length > 0 && (
        <div className="p-4 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
            {naoLidas > 0 && <button onClick={marcarTodasLidas} className="text-xs text-primary font-medium">Marcar todas</button>}
          </div>
          <div className="space-y-2">
            {recentes.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={cn("flex items-start gap-3 p-3 rounded-xl transition-colors", !n.lida && "bg-muted/50", n.lida && "opacity-60")}>
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", !n.lida ? "bg-primary" : "bg-transparent")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{n.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.mensagem}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(n.data)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Circle className="w-2 h-2 fill-green-500 text-green-500" />
          Sistema online
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
