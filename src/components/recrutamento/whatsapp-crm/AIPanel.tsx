import { motion } from "framer-motion";
import { Bot, Brain, MessageSquare, TrendingUp, Shield, Activity, Sparkles, Lightbulb, Zap, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore, type IntentClassification } from "@/stores/whatsappCRMStore";

const INTENT_COLORS: Record<IntentClassification, string> = {
  duvida: "bg-blue-100 text-blue-700 border-blue-200",
  interesse: "bg-green-100 text-green-700 border-green-200",
  documentacao: "bg-amber-100 text-amber-700 border-amber-200",
  reclamacao: "bg-red-100 text-red-700 border-red-200",
  cancelamento: "bg-red-100 text-red-700 border-red-200",
  parceria: "bg-purple-100 text-purple-700 border-purple-200",
  operacao: "bg-teal-100 text-teal-700 border-teal-200",
  treinamento: "bg-indigo-100 text-indigo-700 border-indigo-200",
  outro: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function AIPanel() {
  const { conversas, logs, iaGlobalAtiva, toggleIaGlobal, classificarIntencao } = useWhatsAppCRMStore();

  const comIntencao = conversas.filter((c) => c.intentClassificada);
  const porIntencao = comIntencao.reduce((acc, c) => {
    const intent = c.intentClassificada || "outro";
    acc[intent] = (acc[intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const iaLogs = logs.filter((l) => l.tipo === "ia_resposta" || l.tipo === "automacao").slice(0, 6);

  const stats = [
    { label: "Conversas com IA", value: conversas.filter((c) => c.iaAtiva).length, total: conversas.length, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
    { label: "Automações ativas", value: 3, total: 5, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "Respostas IA hoje", value: 47, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
    { label: "Fallback humano", value: 8, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20" },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">IA Operacional</h2>
          <p className="text-sm text-muted-foreground">Análise inteligente das conversas</p>
        </div>
        <button onClick={toggleIaGlobal} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", iaGlobalAtiva ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border")}>
          <div className={cn("w-2 h-2 rounded-full", iaGlobalAtiva ? "bg-green-500" : "bg-muted-foreground")} />
          IA {iaGlobalAtiva ? "Ativa" : "Inativa"}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={cn("p-3 rounded-xl", s.bg)}>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            {"total" in s && <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${((s as any).total ? s.value / (s as any).total * 100 : 0)}%` }} className="h-full rounded-full bg-current opacity-60" /></div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-foreground">Intenções Classificadas</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(porIntencao).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma intenção classificada ainda</p>
            ) : (
              Object.entries(porIntencao).sort(([, a], [, b]) => b - a).map(([intent, count]) => (
                <div key={intent} className="flex items-center justify-between">
                  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-medium border", INTENT_COLORS[intent as IntentClassification] || INTENT_COLORS.outro)}>
                    {intent}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(count / comIntencao.length) * 100}%` }} className="h-full rounded-full bg-purple-500" />
                    </div>
                    <span className="text-xs font-medium text-foreground">{count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Sentimento das Conversas</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Positivo", value: conversas.filter((c) => c.analiseSentimento === "positivo").length, color: "bg-green-500" },
              { label: "Neutro", value: conversas.filter((c) => c.analiseSentimento === "neutro").length, color: "bg-blue-500" },
              { label: "Negativo", value: conversas.filter((c) => c.analiseSentimento === "negativo").length, color: "bg-red-500" },
              { label: "Não analisado", value: conversas.filter((c) => !c.analiseSentimento).length, color: "bg-muted-foreground" },
            ].map((s) => {
              const total = conversas.length || 1;
              return (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{s.label}</span>
                    <span className="text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(s.value / total) * 100}%` }} className={cn("h-full rounded-full", s.color)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Sugestões da IA</h3>
        </div>
        <div className="space-y-2">
          {[
            { icon: Lightbulb, text: "Carlos Silva (novo) → Enviar template de boas-vindas e onboarding automático", action: "Ação: onboarding automático" },
            { icon: Zap, text: "Maria Costa (bloqueado) → Documento expirado há 3 dias. Priorizar contato humano.", action: "Ação: prioridade urgente" },
            { icon: TrendingUp, text: "Roberto Santos (aprovado) → Score 91, perfil ideal para operações de longa distância.", action: "Ação: oferecer operação" },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30">
              <s.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-foreground">{s.text}</p>
                <p className="text-[10px] text-primary font-medium mt-0.5">{s.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Atividades Recentes da IA</h3>
        </div>
        <div className="space-y-1">
          {iaLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-foreground">{log.descricao}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
