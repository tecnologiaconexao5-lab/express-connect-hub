import { motion } from "framer-motion";
import { GraduationCap, Play, CheckCircle2, Clock, FileQuestion, Award, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPrestadorStore, type Treinamento } from "@/stores/portalPrestadorStore";
import { Button } from "@/components/ui/button";

const TIPO_CONFIG = {
  video: { icon: Play, label: "Vídeo", color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" },
  prova: { icon: FileQuestion, label: "Prova", color: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800" },
  certificado: { icon: Award, label: "Certificado", color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" },
};

export default function TreinamentosTab() {
  const { treinamentos, iniciarTreinamento, concluirTreinamento } = usePortalPrestadorStore();

  const completos = treinamentos.filter((t) => t.status === "completo").length;
  const emAndamento = treinamentos.filter((t) => t.status === "em_andamento").length;

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Treinamentos</h1>
        <p className="text-sm text-muted-foreground">{completos} concluídos · {emAndamento} em andamento</p>
      </div>

      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
        <div className="flex items-center gap-3 mb-3">
          <GraduationCap className="w-6 h-6 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Progresso Geral</p>
            <p className="text-xs text-muted-foreground">{Math.round((completos / treinamentos.length) * 100)}% completo</p>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(completos / treinamentos.length) * 100}%` }}
            className="h-full rounded-full bg-primary"
          />
        </div>
      </div>

      <div className="space-y-3">
        {treinamentos.map((t, i) => (
          <TreinamentoCard key={t.id} treino={t} index={i} onStart={iniciarTreinamento} onComplete={concluirTreinamento} />
        ))}
      </div>
    </div>
  );
}

function TreinamentoCard({ treino, index, onStart, onComplete }: { treino: Treinamento; index: number; onStart: (id: string) => void; onComplete: (id: string) => void }) {
  const config = TIPO_CONFIG[treino.tipo];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn("rounded-2xl border overflow-hidden", treino.status === "completo" ? "border-green-200 opacity-70" : "border-border bg-card")}
    >
      <div className="relative h-28 bg-muted overflow-hidden">
        <img src={treino.imagem} alt={treino.titulo} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-start justify-between">
          <span className="text-xs text-white/80 font-medium truncate">{treino.duracao}</span>
          <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", config.color)}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        </div>
        {treino.status === "completo" && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-semibold text-foreground">{treino.titulo}</p>

        {treino.status === "em_andamento" && (
          <div className="mt-2 space-y-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${treino.progresso}%` }} className="h-full rounded-full bg-primary" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{treino.progresso}%</span>
              <Button onClick={() => onComplete(treino.id)} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <CheckCircle2 className="w-3 h-3" /> Concluir
              </Button>
            </div>
          </div>
        )}

        {treino.status === "pendente" && (
          <Button onClick={() => onStart(treino.id)} size="sm" className="mt-2 w-full gap-1.5 rounded-xl h-9 text-xs">
            <Play className="w-3.5 h-3.5" /> Iniciar
          </Button>
        )}

        {treino.status === "completo" && treino.concluidoEm && (
          <p className="text-[10px] text-green-600 mt-1">Concluído em {new Date(treino.concluidoEm).toLocaleDateString("pt-BR")}</p>
        )}
      </div>
    </motion.div>
  );
}
