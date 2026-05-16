import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain, Shield, AlertTriangle, CheckCircle2,
  Clock, BarChart3, FileText, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "./onboardingStore";
import { calculateScore } from "@/services/scoreEngine";
import {
  subscribe, getQueue, getTimeline,
  type QueueItem, type TimelineEvent,
} from "@/services/documentQueue";
import { getDocumentLabel } from "@/services/documentAI";
import ScoreGauge, { ScoreBreakdownBar } from "./ScoreGauge";

export default function AIDashboard() {
  const store = useOnboardingStore();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    setQueue(getQueue());
    setEvents(getTimeline());
    const unsub = subscribe(() => {
      setQueue([...getQueue()]);
      setEvents([...getTimeline()]);
    });
    return unsub;
  }, []);

  const score = calculateScore({
    nome: store.nome,
    cpf: store.cpf,
    selfieUrl: store.selfieUrl,
    cnhUrl: store.cnhUrl,
    tipoVeiculo: store.tipoVeiculo,
    modelo: store.modelo,
    placa: store.placa,
    ano: store.ano,
    capacidade: store.capacidade,
    fotosVeiculo: store.fotosVeiculo,
    crlvUrl: store.crlvUrl,
    comprovanteUrl: store.comprovanteUrl,
    anttUrl: store.anttUrl,
    moppUrl: store.moppUrl,
    seguroUrl: store.seguroUrl,
    chavePix: store.chavePix,
    banco: store.banco,
    regioes: store.regioes,
    horariosInicio: store.horariosInicio,
    horariosFim: store.horariosFim,
    tipoCarga: store.tipoCarga,
    tipoViagem: store.tipoViagem,
    fazColeta: store.fazColeta,
    fazEntrega: store.fazEntrega,
    distanciaMaxima: store.distanciaMaxima,
    documentValidations: {},
    stepsCompleted: [],
    isComplete: store.isComplete,
  });

  const blocked = queue.filter((i) => i.status === "blocked").length;
  const failed = queue.filter((i) => i.status === "failed").length;
  const completed = queue.filter((i) => i.status === "completed").length;
  const pending = queue.filter((i) => i.status === "pending" || i.status === "processing").length;
  const total = queue.length;

  const recentEvents = events.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Brain className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Score & IA Documental</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Análise inteligente do seu perfil
        </p>
      </div>

      <div className="p-6 rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center">
          <ScoreGauge score={score} size="lg" />
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Detalhamento
          </p>
          <ScoreBreakdownBar label="Documentação" value={Math.round(score.breakdown.documentacao)} max={25} color={score.color} />
          <ScoreBreakdownBar label="Experiência" value={Math.round(score.breakdown.experiencia)} max={15} color={score.color} />
          <ScoreBreakdownBar label="Região" value={Math.round(score.breakdown.regiao)} max={15} color={score.color} />
          <ScoreBreakdownBar label="Disponibilidade" value={Math.round(score.breakdown.disponibilidade)} max={15} color={score.color} />
          <ScoreBreakdownBar label="Veículo" value={Math.round(score.breakdown.veiculo)} max={15} color={score.color} />
          <ScoreBreakdownBar label="Histórico" value={Math.round(score.breakdown.historico)} max={10} color={score.color} />
          <ScoreBreakdownBar label="Perfil Operacional" value={Math.round(score.breakdown.perfilOperacional)} max={5} color={score.color} />
        </div>
      </div>

      {total > 0 && (
        <div className="p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Status da Análise</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatusCard
              icon={CheckCircle2}
              label="Aprovados"
              value={completed}
              color="text-green-600"
              bg="bg-green-50"
            />
            <StatusCard
              icon={Clock}
              label="Pendentes"
              value={pending}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <StatusCard
              icon={AlertTriangle}
              label="Falhos"
              value={failed}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <StatusCard
              icon={Ban}
              label="Bloqueados"
              value={blocked}
              color="text-red-600"
              bg="bg-red-50"
            />
          </div>
        </div>
      )}

      {recentEvents.length > 0 && (
        <div className="p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Atividades Recentes</h3>
          </div>

          <div className="space-y-2">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/30"
              >
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {getDocumentLabel(event.documentType)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.message}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
                  {new Date(event.timestamp).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof Shield;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-xl", bg)}>
      <Icon className={cn("w-5 h-5 shrink-0", color)} />
      <div>
        <p className={cn("text-lg font-bold", color)}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
