import { LucideIcon, Package, Truck, MapPin, CheckCircle, Clock, AlertTriangle, FileText, Camera, Signature, Navigation, Package2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TimelineEvent {
  id: string;
  step: string;
  label: string;
  description?: string;
  timestamp: string;
  status: "completed" | "current" | "pending" | "warning";
  icon?: LucideIcon;
}

interface PortalTimelineProps {
  events: TimelineEvent[];
  title?: string;
  emptyMessage?: string;
}

const stepIcons: Record<string, LucideIcon> = {
  pedido_criado: Package2,
  motorista_aceitou: Truck,
  coleta_iniciada: Package,
  coleta_concluida: Package,
  em_rota: Truck,
  proximo_destino: Navigation,
  entrega_concluida: CheckCircle,
  comprovante_anexado: Camera,
  assinatura_enviada: Signature,
  problema: AlertTriangle,
  atraso: Clock,
};

const statusConfig = {
  completed: {
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    line: "bg-gradient-to-b from-emerald-500 to-[#E5E7EB]",
  },
  current: {
    bg: "bg-orange-100",
    text: "text-[#F97316]",
    border: "border-orange-200",
    dot: "bg-[#F97316] animate-pulse",
    line: "bg-gradient-to-b from-[#F97316] to-[#E5E7EB]",
  },
  pending: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-300",
    line: "bg-[#E5E7EB]",
  },
  warning: {
    bg: "bg-amber-100",
    text: "text-amber-600",
    border: "border-amber-200",
    dot: "bg-amber-500 animate-pulse",
    line: "bg-gradient-to-b from-amber-500 to-[#E5E7EB]",
  },
};

export function PortalTimeline({ events, title = "Linha do Tempo", emptyMessage = "Histórico operacional ainda não disponível" }: PortalTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <Card className="bg-white border-[#E5E7EB] border-dashed">
        <CardContent className="p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] flex items-center justify-center mb-3">
            <Clock className="w-6 h-6 text-[#64748B]" />
          </div>
          <p className="text-sm text-[#64748B]">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return dateB - dateA;
  });

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  return (
    <Card className="bg-white border-[#E5E7EB] shadow-sm">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-[#111827] mb-4">{title}</h3>
        <div className="relative">
          <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-[#E5E7EB]" />
          {sortedEvents.map((event, idx) => {
            const config = statusConfig[event.status];
            const IconComponent = event.icon || stepIcons[event.step] || Clock;
            const { date, time } = formatDateTime(event.timestamp);
            const isLast = idx === sortedEvents.length - 1;

            return (
              <div key={event.id} className={`relative flex gap-4 pb-6 ${isLast ? "pb-0" : ""}`}>
                <div className="relative z-10 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center shadow-lg`}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  {!isLast && <div className={`w-0.5 flex-1 mt-2 ${config.line}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                          {event.label}
                        </span>
                        {event.status === "warning" && (
                          <span className="text-[10px] text-amber-400">⚠️ Atenção</span>
                        )}
                        {event.status === "current" && (
                          <span className="text-[10px] text-[#F97316]">● Em andamento</span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-[#64748B] mt-1">{event.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#475569]">{date}</p>
                      <p className="text-[10px] text-[#64748B]">{time}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export type { TimelineEvent };