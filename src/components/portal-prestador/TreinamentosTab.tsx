import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Play, CheckCircle2, Clock, FileQuestion, Award, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPrestadorStore, type Treinamento } from "@/stores/portalPrestadorStore";
import { Button } from "@/components/ui/button";

const MOCK_TREINAMENTOS: Treinamento[] = [
  { id: "t1", titulo: "Direção Defensiva", tipo: "video", status: "completo", progresso: 100, duracao: "45 min", imagem: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=300&fit=crop", concluidoEm: "2026-04-20" },
  { id: "t2", titulo: "Segurança no Transporte de Cargas", tipo: "video", status: "completo", progresso: 100, duracao: "30 min", imagem: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop", concluidoEm: "2026-04-25" },
  { id: "t3", titulo: "Primeiros Socorros", tipo: "video", status: "em_andamento", progresso: 60, duracao: "50 min", imagem: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop" },
  { id: "t4", titulo: "Avaliação de Direção Defensiva", tipo: "prova", status: "pendente", progresso: 0, duracao: "20 min", imagem: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop" },
  { id: "t5", titulo: "Certificação Transporte de Alimentos", tipo: "certificado", status: "completo", progresso: 100, duracao: "2h", imagem: "https://images.unsplash.com/photo-1553867745-7850eb3a3691?w=400&h=300&fit=crop", concluidoEm: "2026-05-01" },
];

const TIPO_CONFIG = {
  video: { icon: Play, label: "Vídeo", color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" },
  prova: { icon: FileQuestion, label: "Prova", color: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800" },
  certificado: { icon: Award, label: "Certificado", color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" },
};

export default function TreinamentosTab() {
  const { treinamentos, iniciarTreinamento, concluirTreinamento } = usePortalPrestadorStore();

  const listaTreinamentos = treinamentos.length > 0 ? treinamentos : MOCK_TREINAMENTOS;

  const completos = listaTreinamentos.filter((t) => t.status === "completo").length;
  const emAndamento = listaTreinamentos.filter((t) => t.status === "em_andamento").length;

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
            <p className="text-xs text-muted-foreground">{Math.round((completos / (listaTreinamentos.length || 1)) * 100)}% completo</p>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(completos / (listaTreinamentos.length || 1)) * 100}%` }}
            className="h-full rounded-full bg-primary"
          />
        </div>
      </div>

      {listaTreinamentos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum treinamento disponível</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listaTreinamentos.map((t, i) => (
            <TreinamentoCard key={t.id} treino={t} index={i} onStart={iniciarTreinamento} onComplete={concluirTreinamento} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreinamentoCard({ treino, index, onStart, onComplete }: { treino: Treinamento; index: number; onStart: (id: string) => void; onComplete: (id: string) => void }) {
  const config = TIPO_CONFIG[treino.tipo];
  const Icon = config.icon;
  const [imgErro, setImgErro] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn("rounded-2xl border overflow-hidden", treino.status === "completo" ? "border-green-200 opacity-70" : "border-border bg-card")}
    >
      <div className="relative h-28 bg-muted overflow-hidden flex items-center justify-center">
        {imgErro ? (
          <ImageOff className="w-8 h-8 text-muted-foreground/40" />
        ) : (
          <img src={treino.imagem} alt={treino.titulo} className="w-full h-full object-cover" onError={() => setImgErro(true)} />
        )}
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
