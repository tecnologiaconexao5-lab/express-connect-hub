import { LucideIcon, Truck, MapPin, Package, Clock, AlertTriangle, CheckCircle, Eye, Phone, MessageSquare, ArrowRight, Calendar, User, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortalStatusBadge } from "./PortalStatusBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PortalDeliveryCardProps {
  id: string;
  osNumber: string;
  clientName?: string;
  unit?: string;
  origin: {
    city: string;
    uf: string;
    neighborhood?: string;
  };
  destination: {
    city: string;
    uf: string;
    neighborhood?: string;
  };
  status: "programacao" | "coleta" | "saiu_para_rota" | "em_rota" | "entregue" | "atrasada" | "problema";
  statusLabel?: string;
  driver?: {
    name: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
  };
  sla?: number;
  priority?: "alta" | "media" | "baixa";
  forecast?: string;
  type?: string;
  hasProof?: boolean;
  hasSignature?: boolean;
  onClick?: () => void;
  onContactDriver?: () => void;
}

export function PortalDeliveryCard({
  osNumber,
  clientName,
  unit,
  origin,
  destination,
  status,
  statusLabel,
  driver,
  sla,
  priority,
  forecast,
  type,
  hasProof,
  hasSignature,
  onClick,
  onContactDriver,
}: PortalDeliveryCardProps) {
  const slaIndicator =
    sla === undefined
      ? null
      : sla >= 95
        ? { color: "text-emerald-600", bg: "bg-emerald-50", label: "Excelente" }
        : sla >= 80
          ? { color: "text-amber-600", bg: "bg-amber-50", label: "Regular" }
          : { color: "text-rose-600", bg: "bg-rose-50", label: "Abaixo" };

  const priorityConfig = {
    alta: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", label: "Alta Prioridade" },
    media: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-100", label: "Média" },
    baixa: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-100", label: "Padrão" },
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusVariant = () => {
    switch (status) {
      case "entregue": return "concluido";
      case "em_rota":
      case "saiu_para_rota": return "em_andamento";
      case "atrasada": return "atrasado";
      case "problema": return "critico";
      default: return status;
    }
  };

  return (
    <Card
      className="bg-white border-slate-200 rounded-2xl hover:border-orange-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group transition-all duration-500 overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Header do Card */}
        <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-white group-hover:bg-slate-50/30 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900 tracking-tight">{osNumber}</span>
              {priority && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full border ${priorityConfig[priority].bg} ${priorityConfig[priority].text} ${priorityConfig[priority].border} font-bold uppercase tracking-wider`}>
                  {priorityConfig[priority].label}
                </span>
              )}
            </div>
            {type && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                <Package className="w-3 h-3" />
                <span>{type}</span>
              </div>
            )}
          </div>
          <PortalStatusBadge status={getStatusVariant() as any} showIcon={true} />
        </div>

        {/* Corpo do Card - Rota */}
        <div className="p-5 space-y-5">
          <div className="relative">
            {/* Linha de conexão visual */}
            <div className="absolute left-[11px] top-[18px] bottom-[18px] w-0.5 border-l-2 border-dashed border-slate-100 group-hover:border-orange-100 transition-colors" />
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 w-6 h-6 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0 z-10 group-hover:bg-orange-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-orange-400 transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Origem</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{origin.city}/{origin.uf}</p>
                  {origin.neighborhood && <p className="text-[11px] text-slate-400 font-medium">{origin.neighborhood}</p>}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-1 w-6 h-6 rounded-full bg-orange-100 border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0 z-10">
                  <MapPin className="w-3 h-3 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Destino</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{destination.city}/{destination.uf}</p>
                  {destination.neighborhood && <p className="text-[11px] text-slate-400 font-medium">{destination.neighborhood}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Previsão</span>
              </div>
              <p className="text-xs font-black text-slate-900">
                {formatDate(forecast || "")} <span className="text-slate-400 font-medium ml-1">{formatTime(forecast || "")}</span>
              </p>
            </div>
            
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">SLA</span>
              </div>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-black ${slaIndicator?.color || 'text-slate-900'}`}>{sla || 100}%</p>
                <div className={`w-1.5 h-1.5 rounded-full ${slaIndicator?.bg?.replace('bg-', 'bg-').replace('-50', '-500')}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer do Card - Motorista & Ações */}
        <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-50 group-hover:bg-orange-50/20 transition-all">
          <div className="flex items-center justify-between">
            {driver ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-orange-600 font-black text-sm shadow-sm group-hover:border-orange-200 transition-all">
                    {driver.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate leading-none mb-1">{driver.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                    {driver.vehicle} • {driver.plate}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-9 h-9 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tight">Aguardando recurso</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {driver?.phone && onContactDriver && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-orange-600 hover:border-orange-200 hover:shadow-sm transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onContactDriver();
                        }}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Contato Motorista</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-400 group-hover:text-orange-600 group-hover:border-orange-200 group-hover:shadow-sm transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}