import { useEffect, useState } from "react";
import { History, CheckCircle2, AlertCircle, Clock, XCircle, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

interface CteTimelineProps {
  cteId: string;
  cteMetadata?: Record<string, any> | null;
}

const fmtFin = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

export default function CteTimeline({ cteId, cteMetadata }: CteTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (cteId) fetchEvents();
  }, [cteId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fiscal_events")
        .select("*")
        .eq("documento_tipo", "CTE")
        .eq("documento_id", cteId)
        .order("data_evento", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error("Erro ao buscar eventos:", err);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case "autorizacao":
      case "autorizado":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "rejeicao":
      case "rejeitado":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "cancelamento":
      case "cancelado":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-blue-500" />;
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground p-4 text-center">Carregando eventos fiscais...</div>;
  }

  if (events.length === 0) {
    const meta = cteMetadata || {};
    const romaneioNumero = meta.romaneio_numero || null;
    const origemCte = meta.origem_cte || null;
    const nfeNumero = meta.nfe_numero || null;
    const valorRateado = meta.rateio?.valor_rateado || null;

    return (
      <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <History className="w-10 h-10 mb-2 opacity-20" />
        <p className="text-sm">Nenhum evento fiscal registrado para este CT-e.</p>
        <p className="text-xs mt-1">Os eventos aparecerao aqui assim que o documento for processado.</p>

        {(origemCte === "romaneio_faturamento" || romaneioNumero) && (
          <div className="mt-4 w-full">
            <div className="relative border-l border-blue-200 ml-3 space-y-4">
              <div className="relative pl-6">
                <span className="absolute -left-3 bg-blue-50 p-1 rounded-full border border-blue-200">
                  <FileText className="w-4 h-4 text-blue-500" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-blue-700">Rascunho local criado por romaneio/faturamento</span>
                  <span className="text-xs text-muted-foreground">
                    {meta.rateio?.data_criacao || new Date().toLocaleString("pt-BR")}
                  </span>
                  {romaneioNumero && (
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">Lote {romaneioNumero}</Badge>
                      {nfeNumero && (
                        <Badge variant="outline" className="text-[10px] font-mono">NF-e {nfeNumero}</Badge>
                      )}
                    </div>
                  )}
                  {valorRateado != null && (
                    <span className="text-xs text-muted-foreground mt-1">Valor rateado: {fmtFin(valorRateado)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 px-2">
      <div className="relative border-l border-muted-foreground/20 ml-3 space-y-8">
        {events.map((ev, idx) => (
          <div key={ev.id || idx} className="relative pl-6">
            <span className="absolute -left-3 bg-background p-1 rounded-full">
              {getEventIcon(ev.tipo_evento)}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{ev.descricao || ev.tipo_evento}</span>
              <span className="text-xs text-muted-foreground">
                {ev.data_evento ? new Date(ev.data_evento).toLocaleString() : "-"}
              </span>
              {ev.metadata?.motivo && (
                <div className="mt-2 text-xs bg-muted p-2 rounded-md border text-muted-foreground">
                  {ev.metadata.motivo}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
