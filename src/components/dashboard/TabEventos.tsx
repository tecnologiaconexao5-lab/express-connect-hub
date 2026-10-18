import { Clock, Activity, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEventosRealtime } from "@/hooks/useEventosRealtime";
import { toDashboardEvent } from "@/services/eventBus/adapters/dashboardAdapter";

const severidadeIcone: Record<string, any> = {
  baixa: Activity,
  media: AlertTriangle,
  alta: XCircle,
  critica: AlertTriangle,
};

const severidadeCor: Record<string, string> = {
  baixa: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  media: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  alta: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critica: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function TabEventos() {
  const { eventos, loading, erro, lastEvento } = useEventosRealtime({
    limit: 30,
    enableRealtime: true,
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Eventos ao Vivo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando eventos...</span>
        </CardContent>
      </Card>
    );
  }

  if (erro) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Eventos ao Vivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Erro ao carregar eventos: {erro}</p>
        </CardContent>
      </Card>
    );
  }

  const eventosAdaptados = eventos.map(toDashboardEvent);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Eventos ao Vivo
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastEvento && (
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 animate-pulse">
                <Clock className="w-3 h-3 mr-1" />
                Ao vivo
              </Badge>
            )}
            <Badge variant="secondary">{eventos.length} eventos</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {eventosAdaptados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum evento recente.</p>
            <p className="text-xs text-muted-foreground mt-1">Eventos aparecerão aqui em tempo real.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {eventosAdaptados.map((ev) => {
              const Icone = severidadeIcone[ev.severidade] || Activity;
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`mt-0.5 p-1.5 rounded-full ${severidadeCor[ev.severidade] || "bg-gray-100"}`}>
                    <Icone className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{ev.resumo}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {ev.entity_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(ev.timestamp).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${severidadeCor[ev.severidade] || ""}`}
                  >
                    {ev.severidade}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
