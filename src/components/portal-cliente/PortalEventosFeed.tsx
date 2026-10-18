import { Clock, CheckCircle, Truck, Package, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEventosRealtime } from "@/hooks/useEventosRealtime";

const eventTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  "os.ordem_servico.criada": {
    icon: Package,
    label: "Pedido criado",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  "os.ordem_servico.finalizada": {
    icon: CheckCircle,
    label: "Pedido finalizado",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  "escala.alocacao.aceita": {
    icon: Truck,
    label: "Motorista confirmou",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  "escala.alocacao.concluida": {
    icon: CheckCircle,
    label: "Entrega concluída",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  "os.ordem_servico.cancelada": {
    icon: AlertCircle,
    label: "Pedido cancelado",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface PortalEventosFeedProps {
  clienteId?: string;
  limit?: number;
}

export default function PortalEventosFeed({
  clienteId,
  limit = 20,
}: PortalEventosFeedProps) {
  const { eventos, loading, lastEvento } = useEventosRealtime({
    visibility: "public",
    entityType: clienteId ? undefined : undefined,
    limit,
    enableRealtime: true,
  });

  const eventosCliente = clienteId
    ? eventos.filter(
        (e) =>
          e.payload?.cliente_id === clienteId ||
          e.payload?.cliente_id === undefined
      )
    : eventos;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Atualizações
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Carregando...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (eventosCliente.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Atualizações
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma atualização recente.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Atualizações das suas entregas aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            Atualizações
          </CardTitle>
          {lastEvento && (
            <Badge
              variant="outline"
              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 animate-pulse text-xs"
            >
              <Clock className="w-3 h-3 mr-1" />
              Ao vivo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {eventosCliente.slice(0, limit).map((ev) => {
            const config = eventTypeConfig[ev.event_type] || {
              icon: Clock,
              label: ev.event_type,
              color:
                "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
            };
            const Icon = config.icon;
            const p = ev.payload || {};

            return (
              <div
                key={ev.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-full ${config.color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{config.label}</p>
                    {ev.entity_number && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {ev.entity_number}
                      </Badge>
                    )}
                  </div>
                  {p.origem && p.destino && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {p.origem} → {p.destino}
                    </p>
                  )}
                  {(p.prestador_nome || p.recebedor_nome) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.prestador_nome || p.recebedor_nome}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(ev.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
