import { motion } from "framer-motion";
import { User, MapPin, Truck, Tag, Shield, Brain, FileText, Star, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore } from "@/stores/whatsappCRMStore";
import ScoreGauge from "@/components/onboarding/ScoreGauge";
import { calculateScore } from "@/services/scoreEngine";

export default function ContactDetails() {
  const { conversas, conversaAtiva, logs, adicionarTag, removerTag } = useWhatsAppCRMStore();
  const contato = conversas.find((c) => c.id === conversaAtiva);

  if (!contato) return null;

  const score = calculateScore({
    nome: contato.nome, cpf: "", selfieUrl: null, cnhUrl: null,
    tipoVeiculo: contato.tipoVeiculo, modelo: "", placa: "", ano: "", capacidade: "", fotosVeiculo: [],
    crlvUrl: null, comprovanteUrl: null, anttUrl: null, moppUrl: null, seguroUrl: null, chavePix: "", banco: "",
    regioes: [contato.regiao], horariosInicio: "", horariosFim: "", tipoCarga: "", tipoViagem: [],
    fazColeta: false, fazEntrega: false, distanciaMaxima: "",
    documentValidations: { cnh: { approved: contato.score > 50, confidence: contato.score } },
    stepsCompleted: [contato.status !== "nova"], isComplete: contato.status === "aprovado",
  });

  const contatoLogs = logs.filter((l) => l.contatoId === contato.id).slice(0, 5);

  return (
    <div className="divide-y divide-border">
      <div className="p-4 text-center">
        <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-2 ring-2 ring-primary/20">
          <img src={contato.avatar} alt="" className="w-full h-full object-cover" />
        </div>
        <p className="text-sm font-bold text-foreground">{contato.nome}</p>
        <p className="text-[10px] text-muted-foreground">{contato.telefone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4")}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", score.classification === "Diamante" ? "bg-cyan-50 text-cyan-700 border-cyan-200" : score.classification === "Ouro" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : score.classification === "Prata" ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-amber-100 text-amber-800 border-amber-200")}>
            {score.classification}
          </span>
          <span className="text-[10px] text-muted-foreground">Score {score.total}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScoreGauge score={score} size="sm" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <User className="w-3 h-3" /> Perfil
        </p>
        <InfoRow icon={MapPin} label="Região" value={contato.regiao} />
        <InfoRow icon={Truck} label="Veículo" value={contato.tipoVeiculo} />
        <InfoRow icon={Activity} label="Origem" value={contato.origem} />
        {contato.intentClassificada && <InfoRow icon={Brain} label="Intenção" value={contato.intentClassificada} />}
        {contato.analiseSentimento && (
          <InfoRow icon={Star} label="Sentimento" value={contato.analiseSentimento} highlight={contato.analiseSentimento === "negativo" ? "text-red-600" : contato.analiseSentimento === "positivo" ? "text-green-600" : ""} />
        )}
      </div>

      <div className="p-4 space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Tag className="w-3 h-3" /> Tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {contato.tags.length === 0 && <span className="text-[10px] text-muted-foreground">Nenhuma tag</span>}
          {contato.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 text-primary border border-primary/20">
              {tag}
              <button onClick={() => removerTag(contato.id, tag)} className="hover:text-destructive">&times;</button>
            </span>
          ))}
          <button onClick={() => adicionarTag(contato.id, "nova_tag")} className="px-2 py-0.5 rounded-full text-[9px] font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40">
            + Tag
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Clock className="w-3 h-3" /> Atividades
        </p>
        {contatoLogs.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Nenhuma atividade registrada</p>
        ) : (
          <div className="space-y-1.5">
            {contatoLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1 shrink-0" />
                <div className="min-w-0">
                  <p className="text-foreground truncate">{log.descricao}</p>
                  <p className="text-muted-foreground">{new Date(log.timestamp).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, highlight }: { icon: typeof MapPin; label: string; value: string; highlight?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-medium text-foreground truncate", highlight)}>{value}</span>
    </div>
  );
}
