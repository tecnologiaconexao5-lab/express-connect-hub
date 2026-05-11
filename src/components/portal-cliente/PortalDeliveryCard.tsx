import { LucideIcon, Truck, MapPin, Package, Clock, AlertTriangle, CheckCircle, Eye, Phone, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortalStatusBadge } from "./PortalStatusBadge";

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
  hasProof,
  hasSignature,
  onClick,
  onContactDriver,
}: PortalDeliveryCardProps) {
  const slaIndicator =
    sla === undefined
      ? null
      : sla >= 95
        ? { color: "text-emerald-700", bg: "bg-emerald-50", label: "Saudável" }
        : sla >= 80
          ? { color: "text-orange-700", bg: "bg-orange-50", label: "Atenção" }
          : { color: "text-red-700", bg: "bg-red-50", label: "Crítico" };

  const priorityConfig = {
    alta: { bg: "bg-red-50", text: "text-red-700", label: "Alta" },
    media: { bg: "bg-orange-50", text: "text-orange-700", label: "Média" },
    baixa: { bg: "bg-slate-50", text: "text-slate-600", label: "Baixa" },
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const getStatusVariant = () => {
    switch (status) {
      case "entregue":
        return "concluido";
      case "em_rota":
      case "saiu_para_rota":
        return "em_andamento";
      case "atrasada":
        return "atrasado";
      case "problema":
        return "critico";
      default:
        return status;
    }
  };

  return (
    <Card
      className="bg-white border-slate-200 rounded-2xl hover:border-orange-300 hover:shadow-lg cursor-pointer group transition-all duration-300"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold text-foreground">{osNumber}</span>
              {priority && priority !== "baixa" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityConfig[priority].bg} ${priorityConfig[priority].text} font-medium`}>
                  {priorityConfig[priority].label}
                </span>
              )}
              {hasProof && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-black uppercase tracking-tight" title="Comprovante anexado">
                  Comprov.
                </span>
              )}
              {hasSignature && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-black uppercase tracking-tight" title="Assinatura">
                  Assin.
                </span>
              )}
            </div>
            {clientName && <p className="text-xs font-bold text-slate-700 truncate mt-1">{clientName}</p>}
            {unit && <p className="text-[10px] font-medium text-slate-400 truncate">{unit}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <PortalStatusBadge status={getStatusVariant() as any} />
            {slaIndicator && (
              <div className={`flex items-center gap-1 text-xs ${slaIndicator.color}`}>
                {sla >= 95 ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                <span>{sla}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/70 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/80 truncate">
                {origin.neighborhood ? `${origin.neighborhood}, ` : ""}{origin.city}/{origin.uf}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/80 truncate">
                {destination.neighborhood ? `${destination.neighborhood}, ` : ""}{destination.city}/{destination.uf}
              </p>
            </div>
          </div>
        </div>

        {driver && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
                  {driver.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{driver.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    {driver.vehicle} • {driver.plate}
                  </p>
                </div>
              </div>
              {driver.phone && onContactDriver && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      onContactDriver();
                    }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {forecast && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Previsão: {formatDate(forecast)}</span>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary/70 hover:text-primary text-xs h-7 px-3 opacity-0 group-hover:opacity-100 transition-opacity font-medium"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            <Eye className="w-3 h-3 mr-1" />
            Ver detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}